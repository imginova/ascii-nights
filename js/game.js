/* =====================================================================
   game.js: the RULES. How the night plays out, moment to moment.

   Everything about one night lives in a single object called G
   (time, power, doors, camera, where every character is...). The rules
   change G; render.js then draws whatever G says.

   The heart is update(dt), which main.js calls about 60 times a second.
   `dt` ("delta time") is how many seconds passed since the last call,
   for example 0.016. Multiplying every speed by dt keeps the game
   running at the same pace on fast and slow computers:
       power -= drainPerSecond * dt
   ===================================================================== */

// ---------- saved between nights ----------
// The level picked for each character in SETUP. Loaded from the browser; missing ones default to 0.
let levels = (store.get('levels', []) || []).slice(0, SETUP.length);
while (levels.length < SETUP.length) levels.push(0);
levels = levels.map(clampLevel);
if (levels.every(l => l === 0)) levels = PRESETS[0].levels.slice();   // first visit: start on Warm-up

let best = store.get('best', null);   // hardest night survived: { sum, levels } or null

// How many times each character has got you, by its id: { fre: 3, bon: 1, ... }, plus `heat` for
// passing out. Saved in the browser and shown on the game over and custom night screens (on request).
let kills = store.get('kills', {}) || {};
// Add one to `id`'s tally, save it, and return a line for the game over screen like
// "Bonnie has got you 3 times." (`name` is what the line calls it.)
function countKill(id, name) {
  kills[id] = (kills[id] || 0) + 1;
  store.set('kills', kills);
  const n = kills[id];
  return `<br><span class="dim">${name} has got you ${n === 1 ? 'once' : n + ' times'}.</span>`;
}

// The challenges (from PRESETS) you've survived, saved by clearKey (name plus version, see data.js).
// RULE: the only saved ✓s ever deleted are those of challenges that got harder, which shows as their
// version going up. Everything else stays saved, even a ✓ this version of the game doesn't recognise.
// So there are two lists:
//   savedTicks: everything saved, minus outdated versions; this is the one written back;
//   cleared:    the ones that count today (a ✓ is shown only for these).
// outdated(key) is true for a key like "Bedtime v1" when Bedtime is now on a higher version.
const outdated = key => {
  const m = /^(.*) v(\d+)$/.exec(key);   // m[1] is the name, m[2] the version number
  const p = m && PRESETS.find(p => p.name === m[1]);
  return !!p && (p.v || 1) > Number(m[2]);
};
const savedTicks = [...new Set(store.get('cleared', []) || [])].filter(key => !outdated(key));
store.set('cleared', savedTicks);
let cleared = savedTicks.filter(key => PRESETS.some(p => clearKey(p) === key));

// Which challenge matches tonight's levels EXACTLY, or null if none does.
// (Picking a challenge and then changing a level doesn't count.)
const matchingPreset = () => PRESETS.find(p => p.levels.every((lv, i) => lv === levels[i])) || null;

// A night's score: every level added up. The most is 12 x 20 = 240.
const nightScore = () => levels.reduce((total, lv) => total + lv, 0);
const MAX_SCORE = SETUP.length * MAX_LEVEL;

// ---------- the current night ----------
let G = null;        // all the state of the night in progress (built by newGame)
let dirty = true;    // "something changed, redraw now" (render.js also redraws 15x a second anyway)

// The flashlight shines while F, the right mouse button or the Flashlight button is held down.
let flashKey = false, flashMouse = false, flashButton = false;
// Where the mouse pointer is aiming, worked out by input.js:
//   where  'L' or 'R' (over that doorway), 'office' (over the middle of the office) or null
//   r, c   the row and column of the character under the pointer, in that picture
//   x, y   the pointer's position in pixels inside the view (for drawing the light)
const aim = { where: null, r: 0, c: 0, x: 0, y: 0 };

// Is there power to use things right now? Not after a power-out.
const powered = () => !G.powerOut;
// Is the flashlight on? It needs power, and you have to be looking at the office (monitor down).
const flashOn = () => (flashKey || flashMouse || flashButton) && powered() && !G.cam;
// Is the flashlight shining on the character at row r, column c of the office?
// The lit patch is an oval around the pointer: BEAM_COLS across and BEAM_ROWS up and down.
// (dx / BEAM_COLS)² + (dy / BEAM_ROWS)² <= 1 is the maths for "inside that oval".
const beamOn = (r, c) => {
  if (!flashOn() || aim.where !== 'office') return false;
  const dx = (aim.c - c) / BEAM_COLS, dy = (aim.r - r) / BEAM_ROWS;
  return dx * dx + dy * dy <= 1;
};
// Is the flashlight shining into the doorway on `side`? Aiming at the doorway itself counts, and so
// does aiming at the edge of the office right next to it. A shut door blocks the light.
const beamOnDoor = side => flashOn() && !G.doors[side] && (aim.where === side ||
  (aim.where === 'office' && (side === 'L' ? aim.c < BEAM_COLS : aim.c > 35 - BEAM_COLS)));
// Are you looking at camera `room` right now?
const onCam = room => G.cam && G.camRoom === room;
const otherSide = side => side === 'L' ? 'R' : 'L';

// Turn seconds into the clock: with 30-second hours, 0-29s is 12 AM, 30-59s is 1 AM, and so on.
const hourOf = t => Math.min(NIGHT_HOURS, Math.floor(t / HOUR_SECONDS));
const hourLabel = h => (h === 0 ? 12 : h) + ' AM';

// How hard character c plays tonight (c is one of the descriptions in data.js, like BONNIE):
// its level from the setup screen, eased by effLevel (config.js).
const levelOf = c => effLevel(levels[SETUP.indexOf(c)]);

// Build a fresh night.
function newGame() {
  G = {
    t: 0,                          // seconds since 12 AM
    power: 100,                    // percent
    doors: { L: false, R: false }, // true = closed
    cam: false,                    // is the monitor raised?
    camRoom: 'cove',               // which camera you are looking at
    mask: false,                   // are you wearing the mask?
    fan: false,                    // is the fan on?
    powerOut: false, outTimer: 0, outBy: null,
    over: false, paused: false,
    staticUntil: 0,                // camera shows static until this time (milliseconds)

    // Freddy: `step` counts his laughs. At FREDDY_LAUGHS he's at the right door.
    fre: { level: levelOf(FREDDY), step: 0, timer: FREDDY_INTERVAL * rand(0.7, 1.3), deadline: 0 },
    // Bonnie: walks one of his routes; the last step is the doorway.
    bon: { level: levelOf(BONNIE), route: pick(BONNIE.routes), step: 0, timer: BONNIE_INTERVAL * rand(0.7, 1.3), deadline: 0 },
    // Golden Freddy: only there right after you flip the monitor down.
    gol: { level: levelOf(GOLDEN), present: false, deadline: 0 },
    // Phantom Chica: the cupcakes still to find ([row, column] each) and when she gives up waiting.
    pch: { level: levelOf(PCHICA), active: false, cups: [], deadline: 0, scareUntil: 0 },
    // Bonnet: her position (x = column of her left edge, y = row of her top), and which way she runs.
    bnt: { level: levelOf(BONNET), active: false, x: 0, y: 13, dir: 1, speed: 0, timer: bonnetWait(levelOf(BONNET)) },
    // Withered Bonnie: his appearance timer, and how long the mask has been on while he's here.
    wbn: { level: levelOf(WBONNIE), present: false, maskT: 0, deadline: 0, timer: witheredWait(levelOf(WBONNIE)) },
    // The Puppet's music box: how wound it is (percent), and the countdown once it's empty.
    pup: { level: levelOf(PUPPET), wind: 100, out: false, outTimer: 0, warnT: 0 },
    // The staff bot: whether it's blinking, which door its arrow points to, and whether it's waiting
    // for you to open that door (stalled).
    stf: { level: levelOf(STAFF), active: false, side: 'L', stalled: false, deadline: 0, blinkT: 0, timer: staffWait(levelOf(STAFF)) },
    // Nightmare Freddy: which of the 3 desk spots have a Freddle, how long each has been lit, how long
    // all 3 have been there, and Nightmare Freddy himself.
    nfr: { level: levelOf(NFREDDY), freddles: [false, false, false], shine: [0, 0, 0], timer: freddleWait(levelOf(NFREDDY)),
      fullT: 0, present: false, maskT: 0, deadline: 0 },
    // Withered Foxy: where he is in his routine (see updateFoxy), his cove stage (0 curtain shut,
    // 1 peeking, 2 half out) and his timers.
    wfx: { level: levelOf(WFOXY), phase: 'cove', stage: 0, timer: FOXY_INTERVAL * rand(0.7, 1.3), runT: 0, waitT: 0,
      stompT: 0, flashT: 0, deadline: 0 },
    // Sleepy Moon: which camera he's on (null while he's away), the sleep meter (0 wide awake,
    // 100 asleep), how many yawns have played, and the countdown to his next visit.
    mon: { level: levelOf(MOON), room: null, sleep: 0, yawns: 0, timer: moonWait(levelOf(MOON)) },
    // The Flamethrower endo: whether he's here and how much longer he stays.
    end: { level: levelOf(ENDO), present: false, stayT: 0, crackleT: 0, timer: endoWait(levelOf(ENDO)) },
    // Nightmare Foxy: which way he's coming, how far along (0 Dining, 1 a hall, 2 the door), how long
    // he's been in the hall, and, once inside, his stage (1 far ... 3 close) and timers.
    nfx: { level: levelOf(NFOXY), route: pick(NFOXY.routes), step: 0, timer: NFOXY_INTERVAL * rand(0.7, 1.3), hallT: 0,
      inside: false, stage: 0, creepT: 0, pushT: 0 },
    // Funtime Freddy: whether he's out, which hall (side), whether BonBon is on his hand, when you first
    // saw him on the cameras (null until you do), and how long BonBon has been in the light.
    fun: { level: levelOf(FUNFRED), active: false, side: 'L', bonbon: false, seenAt: null, flashT: 0, deadline: 0,
      timer: funWait(levelOf(FUNFRED)) },
    // Chica: how far along her walk she is (CHICA.route), and her timers.
    chi: { level: levelOf(CHICA), step: 0, timer: CHICA_INTERVAL * rand(0.7, 1.3), hallT: 0 },
    // Plushtrap: where he's hiding in the office (null when he isn't), and his timers.
    plu: { level: levelOf(PLUSH), spot: null, deadline: 0, timer: plushWait(levelOf(PLUSH)) },
    // Nightmare Chica: which camera her cupcake is hidden on (null when it isn't) and where on it.
    nch: { level: levelOf(NCHICA), room: null, spot: null, deadline: 0, timer: nchicaWait(levelOf(NCHICA)) },
    shutAt: { L: -1, R: -1 },      // when each door was last shut (Funtime Freddy checks you looked first)
    heat: 0,                       // the office heat in percent (see updateHeat); 100 = you pass out
    hotWarns: 0,                   // how many of the HOT_WARN marks the heat is past (for the warning breaths)
  };
}

// ---------- the main rule loop ----------
function update(dt) {
  G.t += dt;
  if (G.t >= HOUR_SECONDS * NIGHT_HOURS) return win();   // made it to 6 AM

  updatePuppet(dt);   // the music box keeps unwinding even in a power-out
  if (G.over) return;

  if (G.powerOut) {
    // Power is out: nothing to do but wait in the dark. (With Moon on, the darkness grows too.)
    if (G.mon.level > 0) G.mon.sleep = Math.min(100, G.mon.sleep + 15 * dt);
    G.outTimer -= dt;
    if (G.outTimer <= 0) lose(G.outBy, null, true);
    return;
  }

  updatePower(dt);
  // Each character in turn. `for...of` runs the function for each one; we stop as soon as one ends the night.
  for (const step of [updateFreddy, updateBonnie, updateGolden, updateChica, updateBonnet, updateWithered,
    updateStaff, updateNightmare, updateFoxy, updateMoon, updateEndo, updateNightmareFoxy, updateFuntime,
    updateChicaWalk, updatePlushtrap, updateNightmareChica, updateHeat]) {
    if (G.over || G.powerOut) return;
    step(dt);
  }
}

// How many things are using power right now (0 to 5): the monitor, each closed door, the flashlight, the fan.
// true counts as 1 and false as 0 when you add them up.
const powerUnits = () => G.cam + G.doors.L + G.doors.R + flashOn() + G.fan;

function updatePower(dt) {
  G.power -= UNIT_DRAIN * powerUnits() * dt;
  if (G.power <= 0) powerOutStart();
}

// ---------- Freddy ----------
// Every so often he may move, and each move is a laugh. After the third laugh he's at the right
// door: shut it in time and he bonks and goes back. He's never on the cameras.
function updateFreddy(dt) {
  const F = G.fre;
  if (F.level === 0) return;
  if (F.step === FREDDY_LAUGHS) {
    if (G.doors.R) { sfx.bonk('R'); F.step = 0; F.timer = FREDDY_INTERVAL * rand(0.7, 1.3); }
    else if (G.t >= F.deadline) lose(FREDDY, 'R');
    return;
  }
  F.timer -= dt;
  if (F.timer > 0) return;
  F.timer = FREDDY_INTERVAL * rand(0.7, 1.3);
  if (Math.random() >= moveChance(F.level)) return;   // this time he stays put
  F.step++;
  sfx.laugh(F.step);
  if (F.step === FREDDY_LAUGHS) F.deadline = G.t + reactWindow(F.level);
}

// ---------- Bonnie ----------
// Walks his route a room at a time; the last step is a doorway. Shut that door and he goes back.
const bonnieAtDoor = () => G.bon.step === G.bon.route.length - 1;
const bonnieSide = () => G.bon.route[G.bon.route.length - 1];
function updateBonnie(dt) {
  const B = G.bon;
  if (B.level === 0) return;
  if (bonnieAtDoor()) {
    if (G.doors[bonnieSide()]) bonnieHome();
    else if (G.t >= B.deadline) lose(BONNIE, bonnieSide());
    return;
  }
  B.timer -= dt;
  if (B.timer > 0) return;
  B.timer = BONNIE_INTERVAL * rand(0.7, 1.3);
  if (Math.random() >= moveChance(B.level)) return;
  B.step++;
  if (onCam(B.route[B.step - 1]) || onCam(B.route[B.step])) camStatic(0.5);   // static when he leaves or enters the room you're watching
  if (bonnieAtDoor()) {
    sfx.arrive(bonnieSide(), 140);
    if (G.doors[bonnieSide()]) bonnieHome();   // already shut: he gives up at once
    else B.deadline = G.t + reactWindow(B.level);
  } else {
    sfx.step(B.step / (B.route.length - 1), bonnieSide(), 120);
  }
  dirty = true;
}
// Shut out: a bonk, and he's back on the stage, picking a new way to come next time.
function bonnieHome() {
  const B = G.bon;
  sfx.bonk(bonnieSide());
  B.route = pick(BONNIE.routes);
  B.step = 0;
  B.timer = BONNIE_INTERVAL * rand(0.7, 1.3);
  dirty = true;
}

// ---------- Golden Freddy and Phantom Chica (both turn up when you flip the monitor down) ----------
function lookedBack() {
  const Go = G.gol, C = G.pch;
  if (Go.level > 0 && !Go.present && Math.random() < goldenChance(Go.level)) {
    Go.present = true;
    Go.deadline = G.t + goldenWindow(Go.level);
    sfx.goldenIn();
  }
  if (C.level > 0 && !C.active && Math.random() < chicaChance(C.level)) {
    // Pick different cupcake spots: shuffle a copy of the list and take the first few.
    C.cups = CUPCAKE_SPOTS.slice().sort(() => Math.random() - 0.5).slice(0, cupcakeCount(C.level));
    C.active = true;
    C.deadline = G.t + chicaTime(C.level, C.cups.length);
    sfx.chicaIn();
  }
}

// Golden Freddy leaves the moment the mask goes on. Too slow, and he gets you.
function updateGolden() {
  const Go = G.gol;
  if (!Go.present) return;
  if (G.mask) { Go.present = false; sfx.goldenOut(); dirty = true; }
  else if (G.t >= Go.deadline) lose(GOLDEN);
}

// Phantom Chica: find every cupcake before time runs out, or she jumpscares you and takes power.
// It doesn't end the night (unless that was the last of your power).
function updateChica() {
  const C = G.pch;
  if (!C.active || G.t < C.deadline) return;
  C.active = false;
  C.cups = [];
  C.scareUntil = performance.now() + 900;   // render.js shows her face until then
  sfx.miniScream();
  G.power -= CHICA_COST;
  if (G.power <= 0) powerOutStart();
  dirty = true;
}

// Clicking cupcake number i (input.js).
function clickCupcake(i) {
  const C = G && G.pch;
  if (!C || G.over || G.paused || !C.active || G.cam) return;
  C.cups.splice(i, 1);   // splice(i, 1) removes the i-th item from the list
  sfx.pop();
  if (C.cups.length === 0) { C.active = false; sfx.chicaOut(); }
  dirty = true;
}

// ---------- Bonnet ----------
// She runs along the floor from one side of the office to the other. If the mouse pointer gets
// close she dodges: up or down out of its way, or, if the pointer is behind her, forward. The
// office is only a few rows tall, so she soon runs out of room to dodge: come at her from the
// front and boop her nose.
function updateBonnet(dt) {
  const N = G.bnt;
  if (N.level === 0) return;
  if (!N.active) {
    N.timer -= dt;
    if (N.timer > 0) return;
    N.active = true;
    N.dir = Math.random() < 0.5 ? 1 : -1;
    N.x = N.dir > 0 ? -5 : 36;   // start just outside the side she comes from
    N.y = rand(BONNET_ROWS[0], BONNET_ROWS[1]);
    N.speed = 41 / bonnetTime(N.level);   // 41 columns: all the way across, plus her own width
    sfx.bonnetIn(N.dir > 0 ? -0.7 : 0.7);
    return;
  }
  N.x += N.dir * N.speed * dt;
  // Dodging. dx and dy are how far the pointer is from the middle of her.
  if (aim.where === 'office' && !G.cam) {
    const dx = aim.c - (N.x + 2), dy = aim.r - (N.y + 0.5);
    if (Math.abs(dx) < 6 && Math.abs(dy) < 3) {
      N.y -= Math.sign(dy || 1) * BONNET_DODGE * 0.6 * dt;       // step up or down, away from it
      if (dx * N.dir < 0) N.x += N.dir * BONNET_DODGE * dt;      // pointer behind her: run on faster
      N.y = Math.max(BONNET_ROWS[0], Math.min(BONNET_ROWS[1], N.y));
    }
  }
  if ((N.dir > 0 && N.x >= 36) || (N.dir < 0 && N.x <= -5)) lose(BONNET);
}

// Clicking her nose (input.js): boop! She runs off, and comes back later.
function boopBonnet() {
  const N = G && G.bnt;
  if (!N || G.over || G.paused || !N.active || G.cam) return;
  N.active = false;
  N.timer = bonnetWait(N.level);
  sfx.boop();
  dirty = true;
}

// ---------- Withered Bonnie ----------
// His timer counts down all the time, but with the monitor up it can't reach 0: he appears only
// once the monitor is down. Then put the mask on in time and keep it on for MASK_HOLD seconds.
function updateWithered(dt) {
  const W = G.wbn;
  if (W.level === 0) return;
  if (!W.present) {
    W.timer -= dt;
    if (W.timer <= 0 && !G.cam) {
      W.present = true;
      W.maskT = 0;
      W.deadline = G.t + reactWindow(W.level);
      sfx.witheredIn();
      dirty = true;
    }
    return;
  }
  if (G.mask) {
    W.maskT += dt;
    if (W.maskT >= MASK_HOLD) {
      W.present = false;
      W.timer = witheredWait(W.level);
      sfx.witheredOut();
      dirty = true;
    }
    return;
  }
  // Mask off. Took it off too early? Then the count starts again, with a fresh chance to react.
  if (W.maskT > 0) { W.maskT = 0; W.deadline = G.t + reactWindow(W.level); }
  if (G.t >= W.deadline) lose(WBONNIE);
}

// ---------- the Puppet's music box ----------
function updatePuppet(dt) {
  const P = G.pup;
  if (P.level === 0) return;
  if (P.out) {
    P.outTimer -= dt;
    if (P.outTimer <= 0) lose(PUPPET);
    return;
  }
  P.wind -= boxDrain(P.level) * dt;
  if (P.wind < BOX_LOW) {
    P.warnT -= dt;
    if (P.warnT <= 0) { sfx.boxWarn(); P.warnT = 4; }
  }
  if (P.wind <= 0) {
    P.wind = 0;
    P.out = true;
    P.outTimer = PUPPET_DELAY;
    sfx.boxTune();
    dirty = true;
  }
}

// One tap of Wind (the button, or W while you're on CAM 7) winds the box all the way up at once.
// It only works while you're watching the box.
function windBox() {
  const P = G && G.pup;
  if (!P || G.over || G.paused) return;
  if (!onCam('prize') || P.out || P.level === 0) { sfx.deny(); return; }
  P.wind = 100;
  sfx.windTick();
  dirty = true;
}

// ---------- the Nightmare staff bot ----------
// Every so often it blinks and points its arrow at a door: shut that door in time and it bonks.
// If that door is already shut when it starts, it waits ("stalled") until you open it, and then you
// get a fresh chance to shut it again.
function updateStaff(dt) {
  const S = G.stf;
  if (S.level === 0) return;
  if (!S.active) {
    S.timer -= dt;
    if (S.timer > 0) return;
    S.active = true;
    S.side = pick(['L', 'R']);
    S.stalled = G.doors[S.side];
    S.deadline = G.t + staffWindow(S.level);
    S.blinkT = 0;
    dirty = true;
  }
  S.blinkT -= dt;
  if (S.blinkT <= 0) { sfx.blink(S.side); S.blinkT = BLINK_EVERY; }
  if (S.stalled) {
    if (!G.doors[S.side]) { S.stalled = false; S.deadline = G.t + staffWindow(S.level); }
    return;
  }
  if (G.doors[S.side]) {
    sfx.bonk(S.side);
    S.active = false;
    S.timer = staffWait(S.level);
    dirty = true;
  } else if (G.t >= S.deadline) {
    lose(STAFF, S.side);
  }
}

// ---------- Nightmare Freddy ----------
// Freddles turn up on the desk one at a time. Keeping the flashlight on one for FREDDLE_SHINE
// seconds sends it off. If all 3 sit there for too long, he comes, and once he's in your office he
// NEVER leaves (on request: that was the owner's design; he used to leave after 5 seconds of mask).
// Put the mask on in time and keep it on for the rest of the night: taking it off is deadly. So keep
// those Freddles off the desk!
function updateNightmare(dt) {
  const N = G.nfr;
  if (N.level === 0) return;
  if (N.present) {
    if (G.mask) N.maskT += dt;   // how long the mask has been on since he came (more than 0 = it went on)
    else if (N.maskT > 0 || G.t >= N.deadline) lose(NFREDDY);   // took the mask off, or never put it on
    return;
  }
  // The light shooing Freddles away. Each Freddle needs its own steady light.
  N.freddles.forEach((here, i) => {
    if (!here) return;
    const [r, c] = FREDDLE_SPOTS[i];
    if (beamOn(r, c + 1.5)) {   // + 1.5: the middle of the 4-wide Freddle
      N.shine[i] += dt;
      if (N.shine[i] >= FREDDLE_SHINE) { N.freddles[i] = false; N.shine[i] = 0; sfx.freddleOff(); dirty = true; }
    } else {
      N.shine[i] = 0;
    }
  });
  // A new Freddle every so often, on a free spot.
  const free = [0, 1, 2].filter(i => !N.freddles[i]);
  if (free.length) {
    N.timer -= dt;
    if (N.timer <= 0) {
      N.freddles[pick(free)] = true;
      N.timer = freddleWait(N.level);
      sfx.freddle();
      dirty = true;
    }
  }
  // All three on the desk: he's on his way.
  if (N.freddles.every(Boolean)) {
    N.fullT += dt;
    if (N.fullT >= nightmareArrive(N.level)) {
      N.present = true;
      N.fullT = 0;
      N.maskT = 0;
      N.deadline = G.t + reactWindow(N.level);
      sfx.nightmareIn();
      dirty = true;
    }
  } else {
    N.fullT = 0;
  }
}

// ---------- Withered Foxy ----------
// His routine, one `phase` at a time:
//   'cove'    getting ready in Pirate Cove (stage 0 curtain shut, 1 peeking, 2 half out); then he runs.
//             While the monitor is up (on any camera) he's stalled: his countdown stops (on request,
//             to give a reason to use the cameras)
//   'run'     sprinting down the West Hall to the left door
//   'door'    in the open doorway: shut the door in time!
//   'wait'    shut out; waiting behind the door. Opening it now just brings him back to 'door'
//   'ready'   he stomped: now open the door...
//   'open'    ...and flash him with the light until he leaves (FOXY_FLASH seconds of light in all;
//             it doesn't have to be in one go). Then he goes back to the cove. No second door shut
//             (simplified on request: it used to be flash, then shut the door again).
// Shutting the door in 'open' before he's had enough light just puts him back to 'wait'.
const foxyInDoorway = () => ['door', 'open'].includes(G.wfx.phase);
function updateFoxy(dt) {
  const X = G.wfx;
  if (X.level === 0) return;
  const shut = G.doors.L;
  switch (X.phase) {
    case 'cove':
      if (G.cam) return;   // being watched on the cameras: he can't get ready
      X.timer -= dt;
      if (X.timer > 0) return;
      X.timer = FOXY_INTERVAL * rand(0.7, 1.3);
      if (Math.random() >= moveChance(X.level)) return;
      if (X.stage < 2) { X.stage++; if (onCam('cove')) camStatic(0.4); dirty = true; return; }
      X.phase = 'run';
      X.runT = FOXY_RUN;
      sfx.run();
      dirty = true;
      return;
    case 'run':
      X.runT -= dt;
      if (X.runT > 0) return;
      if (shut) foxyShutOut();
      else { X.phase = 'door'; X.deadline = G.t + reactWindow(X.level); sfx.arrive('L', 90); }
      dirty = true;
      return;
    case 'door':
      if (shut) foxyShutOut();
      else if (G.t >= X.deadline) lose(WFOXY, 'L');
      return;
    case 'wait':
      if (!shut) { X.phase = 'door'; X.deadline = G.t + reactWindow(X.level); sfx.arrive('L', 90); dirty = true; return; }
      X.waitT -= dt;
      if (X.waitT <= 0) { X.phase = 'ready'; X.stompT = 0; }
      return;
    case 'ready':
      if (!shut) { X.phase = 'open'; X.flashT = 0; X.deadline = G.t + reactWindow(X.level) + 1; dirty = true; return; }
      X.stompT -= dt;
      if (X.stompT <= 0) { sfx.stomp(); X.stompT = STOMP_EVERY; }   // stomps until you open up
      return;
    case 'open':
      if (shut) { foxyShutOut(); return; }   // shut before he's had enough light: back to waiting
      if (beamOnDoor('L')) {
        X.flashT += dt;
        if (X.flashT >= FOXY_FLASH) {
          // Enough light: he gives up and goes back to the cove. The zap ends in a ding-ding.
          X.phase = 'cove';
          X.stage = 0;
          X.timer = FOXY_INTERVAL * rand(0.7, 1.3);
          sfx.zap();
          sfx.retreat();
          dirty = true;
          return;
        }
      }
      if (G.t >= X.deadline) lose(WFOXY, 'L');
  }
}
// The left door is shut on him: a bang, and he waits behind it until his stomp.
function foxyShutOut() {
  const X = G.wfx;
  X.phase = 'wait';
  X.waitT = rand(...FOXY_WAIT);   // ...FOXY_WAIT spreads the [lowest, highest] pair into rand(lowest, highest)
  sfx.bang();
  dirty = true;
}

// ---------- Sleepy Moon ----------
// Every so often he turns up on a random camera (M.room) with a lullaby. While he's out you drift
// off: the sleep meter fills and the view darkens. Find him on the cameras and click him (clickMoon)
// to send him away and wake up. If the meter fills, you fell asleep.
function updateMoon(dt) {
  const M = G.mon;
  if (M.level === 0) return;
  if (!M.room) {
    M.timer -= dt;
    if (M.timer > 0) return;
    M.room = pick(CAM_ORDER);
    if (onCam(M.room)) camStatic(0.5);   // static if he turns up on the camera you're watching
    sfx.lullaby();
    dirty = true;
    return;
  }
  M.sleep += moonRate(M.level) * dt;
  // A yawn when you pass 50% and again at 80%: you're drifting off.
  const yawns = M.sleep >= 80 ? 2 : M.sleep >= 50 ? 1 : 0;
  if (yawns > M.yawns) sfx.yawn();
  M.yawns = yawns;
  if (M.sleep >= 100) lose(MOON);
}

// Clicking Moon on his camera (input.js): he leaves, you wake right up, and he's back later.
function clickMoon() {
  const M = G && G.mon;
  if (!M || !ready() || !M.room || !onCam(M.room)) return;
  M.room = null;
  M.sleep = 0;
  M.yawns = 0;
  M.timer = moonWait(M.level);
  sfx.pop();
  sfx.wakeUp();
  dirty = true;
}

// ---------- the Flamethrower endo ----------
// He only comes and goes here; the heat he adds is worked out in updateHeat below.
function updateEndo(dt) {
  const E = G.end;
  if (E.level === 0) return;
  if (E.present) {
    E.stayT -= dt;
    E.crackleT -= dt;
    if (E.crackleT <= 0) { sfx.crackle(); E.crackleT = 0.6; }
    if (E.stayT <= 0) { E.present = false; E.timer = endoWait(E.level); sfx.flameOff(); dirty = true; }
  } else {
    E.timer -= dt;
    if (E.timer <= 0) { E.present = true; E.stayT = endoStay(E.level); sfx.flameOn(); dirty = true; }
  }
}

// ---------- the office heat ----------
// Every night the office slowly heats up (AMBIENT_HEAT), and much faster while the endo is here.
// The fan cools it down, except while the endo is here: then it only slows the heating.
// At 100% you pass out (or, if the endo is in the room, he gets the blame).
function updateHeat(dt) {
  const E = G.end;
  const rise = AMBIENT_HEAT + (E.present ? endoHeat(E.level) : 0);
  if (!G.fan) G.heat += rise * dt;
  else if (E.present) G.heat += rise * FAN_SLOW * dt;
  else G.heat = Math.max(0, G.heat - FAN_COOL * dt);
  // A heavy breath each time it passes one of the HOT_WARN marks (filter counts how many it's past).
  const warns = HOT_WARN.filter(mark => G.heat >= mark).length;
  if (warns > G.hotWarns) sfx.hot();
  G.hotWarns = warns;
  if (G.heat >= 100) E.present ? lose(ENDO) : passOut();
}

// ---------- Nightmare Foxy ----------
// Silent. He moves Dining area -> West or East hall -> that door, and you can only see it coming on
// the cameras. Shut the door before he reaches it: a bonk, and he goes back to the Dining area.
// If the door's open he gets inside, and he NEVER leaves (on request): he sits in the middle of the
// office and creeps closer in 3 stages. Flashlight on him pushes him back a stage (never out).
// Past stage 3 he gets you.
function updateNightmareFoxy(dt) {
  const X = G.nfx;
  if (X.level === 0) return;
  if (X.inside) {
    const [r, c] = NFOXY_STAGES[X.stage].aim;   // the middle of his drawing at this stage (art.js)
    if (beamOn(r, c)) {
      X.pushT += dt;
      if (X.pushT >= NFOXY_PUSH) { X.pushT = 0; if (X.stage > 1) { X.stage--; sfx.shove(); dirty = true; } }
    } else {
      X.pushT = 0;
    }
    X.creepT -= dt;
    if (X.creepT <= 0) {
      X.creepT = NFOXY_CREEP * rand(0.8, 1.2);
      if (Math.random() < moveChance(X.level)) {
        X.stage++;
        dirty = true;
        if (X.stage > 3) return lose(NFOXY);
        sfx.creep();   // a scrape: he's a step closer
      }
    }
    return;
  }
  if (X.step === 1) X.hallT += dt;
  X.timer -= dt;
  if (X.timer > 0) return;
  X.timer = NFOXY_INTERVAL * rand(0.7, 1.3);
  if (X.step === 1 && X.hallT < NFOXY_HALL_MIN) return;   // always gives you a moment in the hall
  if (Math.random() >= moveChance(X.level)) return;
  if (onCam(X.route[X.step])) camStatic(0.4);
  X.step++;
  if (X.step === 1) { X.hallT = 0; if (onCam(X.route[1])) camStatic(0.4); }
  if (X.step === 2) {
    const side = X.route[2];
    if (G.doors[side]) { sfx.bonk(side); nfoxyHome(); }
    else { X.inside = true; X.stage = 1; X.creepT = NFOXY_CREEP; X.pushT = 0; sfx.slip(); }   // a soft thud: he's in
  }
  dirty = true;
}
// Shut out: back to the Dining area, picking a new hall for next time.
function nfoxyHome() {
  const X = G.nfx;
  X.route = pick(NFOXY.routes);
  X.step = 0;
  X.timer = NFOXY_INTERVAL * rand(0.7, 1.3);
}

// ---------- Funtime Freddy and BonBon ----------
// He makes his sound and waits in the West or East hall. You must LOOK at him on the cameras first
// (seenAt): actions before that don't count, so you can't guess blindly. Then:
//   BonBon on his hand  -> shut the door on his side (after looking);
//   no BonBon           -> she's at the other door: shine the flashlight there for FUN_FLASH seconds.
// A wrong move just doesn't count (on request). Too slow, and they get you.
function updateFuntime(dt) {
  const F = G.fun;
  if (F.level === 0) return;
  if (!F.active) {
    F.timer -= dt;
    if (F.timer > 0) return;
    F.active = true;
    F.side = pick(['L', 'R']);
    F.bonbon = Math.random() < 0.5;
    F.seenAt = null;
    F.flashT = 0;
    F.deadline = G.t + funWindow(F.level);
    sfx.funIn();
    dirty = true;
    return;
  }
  const other = otherSide(F.side);
  if (F.seenAt == null && onCam(F.side === 'L' ? 'whall' : 'ehall')) F.seenAt = G.t;
  if (F.seenAt != null) {
    if (F.bonbon && G.doors[F.side] && G.shutAt[F.side] >= F.seenAt) return funtimeDone(F.side);
    if (!F.bonbon && beamOnDoor(other)) {
      F.flashT += dt;
      if (F.flashT >= FUN_FLASH) return funtimeDone(other);
    }
  }
  if (G.t >= F.deadline) lose(FUNFRED, F.bonbon ? F.side : other);
}
function funtimeDone(side) {
  const F = G.fun;
  F.active = false;
  F.timer = funWait(F.level);
  sfx.bonk(side);
  dirty = true;
}

// ---------- Chica ----------
// She walks CHICA.route (Backstage, Dining area, West hall) slowly and silently: the only way to know
// where she is is to check the cameras. Clicking her (pushChica) sends her back a room. From the West
// hall her next move gets you (on request), but she always waits there CHICA_HALL_MIN seconds first.
const chicaRoom = () => CHICA.route[G.chi.step];
const chicaLast = () => G.chi.step === CHICA.route.length - 1;   // is she in the West hall?
function updateChicaWalk(dt) {
  const C = G.chi;
  if (C.level === 0) return;
  if (chicaLast()) C.hallT += dt;
  C.timer -= dt;
  if (C.timer > 0) return;
  C.timer = CHICA_INTERVAL * rand(0.7, 1.3);
  if (chicaLast() && C.hallT < CHICA_HALL_MIN) return;
  if (Math.random() >= moveChance(C.level)) return;
  if (chicaLast()) return lose(CHICA);
  if (onCam(chicaRoom())) camStatic(0.4);
  C.step++;
  C.hallT = 0;
  if (onCam(chicaRoom())) camStatic(0.4);
  dirty = true;
}
// Clicking her on her camera (input.js).
function pushChica() {
  const C = G && G.chi;
  if (!C || !ready() || C.step === 0 || !onCam(chicaRoom())) return;
  C.step--;
  C.timer = CHICA_INTERVAL * rand(0.7, 1.3);
  sfx.shoo();
  dirty = true;
}

// ---------- Plushtrap ----------
// He giggles and hides somewhere in the office (PLUSH_SPOTS). Any flashlight on him sends him away at
// once, but his timer is short.
function updatePlushtrap(dt) {
  const P = G.plu;
  if (P.level === 0) return;
  if (!P.spot) {
    P.timer -= dt;
    if (P.timer > 0) return;
    P.spot = pick(PLUSH_SPOTS);
    P.deadline = G.t + plushTime(P.level);
    sfx.giggle((P.spot[1] - 18) / 18);   // the giggle leans toward where he's hiding
    dirty = true;
    return;
  }
  const [r, c] = P.spot;
  if (beamOn(r + 0.5, c + 1.5)) {   // + 0.5 and + 1.5: the middle of his 4 x 2 drawing
    P.spot = null;
    P.timer = plushWait(P.level);
    sfx.pop();
    dirty = true;
  } else if (G.t >= P.deadline) {
    lose(PLUSH);
  }
}

// ---------- Nightmare Chica ----------
// A strange noise, and her cupcake is HIDDEN on one of the cameras (small and dim, tucked into the
// room's picture, see NCHICA_SPOTS in art.js). Find it and click it before nchicaTime runs out.
function updateNightmareChica(dt) {
  const N = G.nch;
  if (N.level === 0) return;
  if (!N.room) {
    N.timer -= dt;
    if (N.timer > 0) return;
    N.room = pick(CAM_ORDER);
    N.spot = pick(NCHICA_SPOTS[N.room]);
    N.deadline = G.t + nchicaTime(N.level);
    sfx.nchicaIn();
    dirty = true;
    return;
  }
  if (G.t >= N.deadline) lose(NCHICA);
}
// Clicking her cupcake on its camera (input.js).
function clickCupcakeCam() {
  const N = G && G.nch;
  if (!N || !ready() || !N.room || !onCam(N.room)) return;
  N.room = null;
  N.timer = nchicaWait(N.level);
  sfx.pop();
  dirty = true;
}

// ---------- power-out ----------
// Power hit 0%: doors open, the monitor, the flashlight and the fan die, everyone else gives up,
// and one character comes for you in the dark: Sleepy Moon if he's on tonight, otherwise Freddy.
function powerOutStart() {
  G.power = 0;
  G.powerOut = true;
  G.doors.L = G.doors.R = false;
  G.cam = false;
  G.fan = false;
  G.outTimer = rand(...POWER_OUT_WAIT);
  G.outBy = G.mon.level > 0 ? MOON : FREDDY;
  G.gol.present = false;
  G.pch.active = false;
  G.bnt.active = false;
  G.wbn.present = false;
  G.stf.active = false;
  G.nfr.present = false;
  G.end.present = false;
  G.mon.room = null;   // the cameras are off, so Moon leaves them (but he's still coming, see outBy)
  if (G.nfx.inside) { G.nfx.inside = false; nfoxyHome(); }   // Nightmare Foxy slinks off in the dark too
  G.fun.active = false;
  G.plu.spot = null;
  G.nch.room = null;
  sfx.humOff();
  sfx.powerDown();
  dirty = true;
}

// Show static on the camera for `sec` seconds.
// performance.now() is the time in milliseconds since the page opened.
function camStatic(sec) {
  G.staticUntil = performance.now() + sec * 1000;
  if (G.cam) sfx.stat();
}

// ---------- things the player does (called from input.js) ----------
// `ready()` is true when the night is running and not paused.
const ready = () => G && !G.over && !G.paused;

function toggleDoor(side) {
  if (!ready()) return;
  if (!powered()) { sfx.deny(); return; }
  G.doors[side] = !G.doors[side];   // flip: open becomes closed, closed becomes open
  if (G.doors[side]) G.shutAt[side] = G.t;   // remember when it was shut (see updateFuntime)
  sfx.door(side);
  dirty = true;
}

// Raise or lower the monitor. Lowering it is when Golden Freddy and Phantom Chica can be waiting.
function toggleCam() {
  if (!ready()) return;
  if (!powered() || G.mask) { sfx.deny(); return; }   // no monitor without power, or with the mask on
  G.cam = !G.cam;
  sfx.cam();
  if (G.cam) camStatic(0.2);
  else lookedBack();
  dirty = true;
}

// Jump to a camera (raising the monitor first if needed).
function setCam(room) {
  if (!ready()) return;
  if (!powered() || G.mask) { sfx.deny(); return; }
  G.cam = true;
  G.camRoom = room;
  sfx.cam();
  camStatic(0.22);
  dirty = true;
}

// Put the mask on or take it off. It can't be worn with the monitor up, and with it on the
// monitor can't be raised. It needs no power.
function toggleMask() {
  if (!ready()) return;
  if (G.cam) { sfx.deny(); return; }
  G.mask = !G.mask;
  sfx.mask(G.mask);
  dirty = true;
}

function toggleFan() {
  if (!ready()) return;
  if (!powered()) { sfx.deny(); return; }
  G.fan = !G.fan;
  sfx.fan(G.fan);
  dirty = true;
}

function setPaused(p) {
  if (!G || G.over) return;
  G.paused = p;
  showPause(p);
  if (p) sfx.humOff();
  else if (!G.powerOut) sfx.humOn();
  if (!p) wakeLoop();   // the loop stops while paused (main.js), so start it again
}

function startNight() {
  sfx.init();
  store.set('levels', levels);
  flashKey = flashMouse = flashButton = false;
  newGame();
  hideScare();
  showPause(false);
  show('game');
  sfx.humOn();
  dirty = true;
  wakeLoop();   // start the game loop (main.js); it stops by itself when the night ends
}

// ---------- how a night ends ----------
function win() {
  G.over = true;
  sfx.humOff();
  sfx.chime();
  const sum = nightScore();
  const isBest = !best || sum > best.sum;
  if (isBest) {
    best = { sum, levels: levels.slice() };
    store.set('best', best);
  }
  // Was tonight one of the challenges? Then it earns its ✓ (if it didn't have one already).
  const challenge = matchingPreset();
  const firstTime = !!challenge && !cleared.includes(clearKey(challenge));
  if (firstTime) {
    cleared.push(clearKey(challenge));
    savedTicks.push(clearKey(challenge));
    store.set('cleared', savedTicks);   // the full list, so nothing saved earlier is lost
  }
  showWin(sum, isBest, challenge, firstTime);
}

// Character c (from data.js) got you. `side` is 'L' or 'R' when it came through a door, or null when
// it got you in your office. `dark` is true when the power had run out.
function lose(c, side = null, dark = false) {
  G.over = true;
  sfx.humOff();
  sfx.scream();
  const when = hourLabel(hourOf(G.t));
  const who = `<b class="c-${c.id}">${c.name}</b>`;
  let message;
  if (dark) message = c === MOON
    ? `The power ran out and you drifted off. ${who} got you at ${when}.`
    : `The power ran out. ${who} found you in the dark at ${when}.`;
  else if (c === PUPPET) message = `The music box ran down. ${who} got out at ${when}.`;
  else if (side) message = `${who} came through the ${side === 'L' ? 'LEFT' : 'RIGHT'} door at ${when}.`;
  else message = `${who} ${c.how} at ${when}.`;
  message += countKill(c.id, c.name);   // a power-out death counts for whoever came in the dark
  // The jumpscare: the character's big drawing, shaking (see showScare in screens.js).
  const big = SPRITES[c.id].scare;
  const g = blank(Math.max(...big.map(l => l.length)), big.length);
  sprite(g, 0, 0, big, 'c-' + c.id);
  showScare(message, toHtml(g));
}

// The office got too hot and you passed out. No one jumps out: the screen just shows a woozy face
// (PASSED_OUT in art.js), without the shake.
function passOut() {
  G.over = true;
  sfx.humOff();
  sfx.faint();
  const g = blank(Math.max(...PASSED_OUT.map(l => l.length)), PASSED_OUT.length);
  sprite(g, 0, 0, PASSED_OUT, 'c-end');
  showScare(`It got too hot in the office. You passed out at ${hourLabel(hourOf(G.t))}.` + countKill('heat', 'The heat'), toHtml(g), false);
}
