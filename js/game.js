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
// Levels are saved BY CHARACTER, like { fre: 5, bon: 3, ... }, so the roster (SETUP) can be put in any
// order. Older versions saved a plain list in the order the characters were added (LEGACY_ORDER below);
// such a save is converted when it's loaded, so nothing is lost (the roster was put in game order on
// request, which would otherwise have shifted everyone's saved levels onto the wrong characters).
const LEGACY_ORDER = ['fre', 'bon', 'gol', 'pch', 'bnt', 'wbn', 'pup', 'stf', 'nfr', 'wfx', 'mon', 'end', 'nfx', 'fun', 'chi', 'plu', 'nch'];
// A saved list (old style) or { id: level } object (new style), as an { id: level } object.
const savedById = saved => Array.isArray(saved)
  ? Object.fromEntries(saved.map((lv, i) => [LEGACY_ORDER[i], lv]).filter(([id]) => id))
  : (saved || {});
// The levels in roster order, as a list: what the rest of the game uses.
const loadLevels = saved => { const byId = savedById(saved); return SETUP.map(c => clampLevel(byId[c.id] ?? 0)); };
// The other way: a list in roster order, as an { id: level } object for saving.
const levelsById = list => Object.fromEntries(SETUP.map((c, i) => [c.id, list[i]]));
function saveLevels() { store.set('levels', levelsById(levels)); }

// The level picked for each character in SETUP. Missing ones default to 0.
let levels = loadLevels(store.get('levels', []));
if (levels.every(l => l === 0)) levels = PRESETS[0].levels.slice();   // first visit: start on Warm-up

// The hardest night survived: { sum, levels: { id: level } } or null. An old-style save (a list of
// levels) is converted the same way. A character that didn't exist yet back then has no level in it
// (shown as – on the custom night screen).
let best = store.get('best', null);
if (best && Array.isArray(best.levels)) best = { ...best, levels: savedById(best.levels) };

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
//   vx, vy the pointer's position anywhere on the page, measured in widths of the view from its top left
//          corner (Chica's Magic Rainbow chases this); vh is the view's height in view widths
const aim = { where: null, r: 0, c: 0, x: 0, y: 0, vx: 0.5, vy: 0.3, vh: 0.6 };

// Is there power to use things right now? Not after a power-out.
const powered = () => !G.powerOut;
// Is the flashlight lit? It needs power and mustn't be broken (White Tiger). Normally it only works
// with the monitor down, but while Shadow Bonnie makes it dark it lights the cameras too.
const flashLit = () => (flashKey || flashMouse || flashButton) && powered() && !broken('flash') && (!G.cam || G.sbn.dark);
// Is the flashlight shining on the office (lit, and the monitor down)?
const flashOn = () => flashLit() && !G.cam;
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

// Tonight's levels: the setup screen's, unless Dee Dee changed them at the start of the night
// (see rollDeeDee). One per character, in SETUP order.
let tonight = [];
// How hard character c plays tonight (c is one of the descriptions in data.js, like BONNIE):
// tonight's level, eased by effLevel (config.js).
const levelOf = c => effLevel(tonight[SETUP.indexOf(c)]);

// Dee Dee, at the start of the night: with a chance of her level / 20 she takes one random character
// out (level 0 for the night) and gives every other one DEEDEE_BOOST more levels (on request: even past
// 20). Returns who she took out, or null if she didn't show up.
function rollDeeDee() {
  tonight = levels.slice();
  const d = SETUP.indexOf(DEEDEE);
  if (tonight[d] === 0 || Math.random() >= moveChance(effLevel(tonight[d]))) return null;
  const others = SETUP.filter((c, i) => c !== DEEDEE && tonight[i] > 0);
  if (!others.length) return null;
  const victim = pick(others);
  tonight = tonight.map((lv, i) => SETUP[i] === victim ? 0 : SETUP[i] === DEEDEE || lv === 0 ? lv : lv + DEEDEE_BOOST);
  return victim;
}

// Build a fresh night.
function newGame() {
  const deeDee = rollDeeDee();
  G = {
    deeDee,                        // who Dee Dee took out tonight (null if she didn't show up)
    tab: 'cams',                   // which tab the monitor shows: 'cams', 'ducts' or 'shop'
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
    pch: { level: levelOf(PCHICA), active: false, cups: [], left: 0, scareUntil: 0 },
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
    // Withered Foxy: where he is in his routine (see updateFoxy) and his timers.
    wfx: { level: levelOf(WFOXY), phase: 'away', timer: witheredFoxyWait(levelOf(WFOXY)), runT: 0, waitT: 0,
      stompT: 0, flashT: 0, deadline: 0 },
    // Sleepy Moon: which camera he's on (null while he's away), the sleep meter (0 wide awake,
    // 100 asleep), how many yawns have played, and the countdown to his next visit.
    mon: { level: levelOf(MOON), room: null, sleep: 0, yawns: 0, timer: moonWait(levelOf(MOON)) },
    // The Flamethrower endo: whether he's here and how much longer he stays.
    end: { level: levelOf(ENDO), present: false, stayT: 0, crackleT: 0, timer: endoWait(levelOf(ENDO)) },
    // Nightmare Foxy: which way he's coming, how far along (0 Dining, 1 a hall, 2 the door), how long
    // he's been in the hall, and, once inside, his stage (1 far ... 3 close) and timers.
    nfx: { level: levelOf(NFOXY), route: pick(NFOXY.routes), step: 0, timer: NFOXY_INTERVAL * rand(0.7, 1.3), hallT: 0,
      deadline: 0, inside: false, stage: 0, creepT: 0, pushT: 0 },
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
    // ----- the third batch -----
    // The three duct crawlers: which duct room they're in, their move timer, and (at the front) when they
    // get you. Toy Bonnie at the front also needs the mask.
    tbo: ductCrawler(TBONNIE), tch: ductCrawler(TCHICA), ned: ductCrawler(NEDD),
    // White Tiger: how long each thing has been on without a break, and until when each is broken.
    wti: { level: levelOf(TIGER), use: {}, brokenUntil: {} },
    // Chica's Magic Rainbow: where she is (x, y from 0 to 1 across and down the view) and how much
    // longer you have to dodge her.
    rbw: { level: levelOf(RAINBOW), active: false, x: 0, y: 0, left: 0, timer: rainbowWait(levelOf(RAINBOW)) },
    // Rockstar Bonnie: just his level (his guitar is in the shop, see `shop`).
    rsb: { level: levelOf(RSBONNIE), warned: 0 },
    // Toxic Springtrap: whether his fumes are in the office and the toxin meter (percent).
    tsp: { level: levelOf(TOXSPRING), active: false, toxin: 0, timer: toxicWait(levelOf(TOXSPRING)) },
    dee: { level: levelOf(DEEDEE) },
    // Funtime Foxy: the SHOWTIME countdown.
    ffx: { level: levelOf(FUNFOXY), timer: funFoxyWait(levelOf(FUNFOXY)) },
    // Foxy: his routine (cove -> run -> door), his cove stage (0 curtain shut, 1 peeking, 2 half out).
    fox: { level: levelOf(FOXY), phase: 'cove', stage: 0, timer: FOXY_INTERVAL * rand(0.7, 1.3), runT: 0, deadline: 0 },
    // Shadow Bonnie: whether it's dark, and for how much longer.
    sbn: { level: levelOf(SHADOWB), dark: false, darkT: 0, timer: shadowWait(levelOf(SHADOWB)) },
    // Twisted Foxy: whether he's digging up, where on CAM 7, how many taps are still needed.
    twf: { level: levelOf(TFOXY), active: false, spot: null, taps: 0, deadline: 0, timer: twistWait(levelOf(TFOXY)) },
    // The ducts: the audio lure (which room, until when, time since its last pull roll) and the heater.
    lureRoom: null, lureUntil: 0, lureReadyAt: 0, lureT: 0,
    heater: false, heaterT: 0,
    // Fazcoins: how many you have, the ones lying on the cameras ({ room, r, c, until }), and the
    // countdown to the next one. Dee Dee makes them turn up half as often.
    coins: 0, camCoins: [], coinT: COIN_EVERY, coinEvery: COIN_EVERY * (deeDee ? 2 : 1),
    // The shop: death coins and battery packs left to buy, whether Rockstar Bonnie's guitar is bought,
    // and whether you're choosing who to use a death coin on.
    shop: { deathLeft: DEATH_COINS, batteries: BATTERY_STOCK, guitar: false, picking: false },
    removed: [],                   // ids of characters removed tonight by a death coin
    note: '', noteUntil: 0,        // a short message shown over the office (Dee Dee, White Tiger...)
    shutAt: { L: -1, R: -1 },      // when each door was last shut (Funtime Freddy checks you looked first)
    heat: 0,                       // the office heat in percent (see updateHeat); 100 = you pass out
    hotWarns: 0,                   // how many of the HOT_WARN marks the heat is past (for the warning breaths)
  };
  // How fast everyone acts tonight: slower on crowded nights (see crowdPace in config.js).
  G.pace = crowdPace(tonight.filter(lv => lv > 0).length);
  // Funtime Foxy's countdown shows real seconds, so his wait is stretched instead (see updateFunFoxy).
  G.ffx.timer /= G.pace;
  if (deeDee) say(`DEE DEE took ${deeDee.name} away! Everyone else +${DEEDEE_BOOST}.`, 5);
}
// A fresh duct crawler (Toy Bonnie, Toy Chica or Nedd Bear) for newGame.
function ductCrawler(c) {
  return { level: levelOf(c), room: DUCT_START, timer: c.interval * rand(0.7, 1.3), deadline: 0 };
}
// Show a short message over the office for `sec` seconds (in real time, so it works while paused too).
function say(text, sec) {
  G.note = text;
  G.noteUntil = performance.now() + sec * 1000;
  dirty = true;
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
  // (On crowded nights their waiting timers count down slower: `timer -= dt * G.pace`, see crowdPace in
  // config.js. Anything about YOUR reactions, like how long the light has been on something, uses dt.)
  for (const step of [updateFreddy, updateBonnie, updateGolden, updateChica, updateBonnet, updateWithered,
    updateStaff, updateNightmare, updateFoxy, updateMoon, updateEndo, updateNightmareFoxy, updateFuntime,
    updateChicaWalk, updatePlushtrap, updateNightmareChica,
    updateDucts, updateTiger, updateRainbow, updateRockstar, updateToxic, updateFunFoxy, updateClassicFoxy,
    updateShadow, updateTwisted, updateCoins, updateHeat]) {
    if (G.over || G.powerOut) return;
    step(dt);
  }
}

// How many things are using power right now (0 to 6): the monitor, each closed door, the flashlight,
// the fan and the heater. true counts as 1 and false as 0 when you add them up.
const powerUnits = () => G.cam + G.doors.L + G.doors.R + flashLit() + G.fan + G.heater;

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
    if (G.doors.R) { sfx.bonk('R'); earnCoin(); F.step = 0; F.timer = FREDDY_INTERVAL * rand(0.7, 1.3); }
    else if (G.t >= F.deadline) lose(FREDDY, 'R');
    return;
  }
  F.timer -= dt * G.pace;
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
  B.timer -= dt * G.pace;
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
  earnCoin();
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
    C.left = chicaTime(C.level, C.cups.length);   // seconds left to find them (see updateChica)
    sfx.chicaIn();
  }
}

// Golden Freddy leaves the moment the mask goes on. Too slow, and he gets you.
function updateGolden() {
  const Go = G.gol;
  if (!Go.present) return;
  if (G.mask) { Go.present = false; sfx.goldenOut(); earnCoin(); dirty = true; }
  else if (G.t >= Go.deadline) lose(GOLDEN);
}

// Phantom Chica: find every cupcake before time runs out, or she jumpscares you and takes power.
// It doesn't end the night (unless that was the last of your power).
// Her clock only runs while you can see the cupcakes: not while the monitor is up, the mask covers
// the view or White Tiger's face is in the way. (It used to run all the time, so flipping the monitor
// down and straight back up could get you jumpscared by cupcakes you never saw.)
function updateChica(dt) {
  const C = G.pch;
  if (!C.active) return;
  if (G.cam || G.mask || performance.now() < (G.tigerUntil || 0)) return;
  C.left -= dt;
  if (C.left > 0) return;
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
  if (C.cups.length === 0) { C.active = false; sfx.chicaOut(); earnCoin(); }
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
    N.timer -= dt * G.pace;
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
  earnCoin();
  dirty = true;
}

// ---------- Withered Bonnie ----------
// His timer counts down all the time, but with the monitor up it can't reach 0: he appears only
// once the monitor is down. Then put the mask on in time and keep it on for MASK_HOLD seconds.
function updateWithered(dt) {
  const W = G.wbn;
  if (W.level === 0) return;
  if (!W.present) {
    W.timer -= dt * G.pace;
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
      earnCoin();
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
  P.wind -= boxDrain(P.level) * dt * G.pace;
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
    S.timer -= dt * G.pace;
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
    earnCoin();
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
    N.timer -= dt * G.pace;
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
//   'away'    nowhere to be seen. Every witheredFoxyWait seconds he turns up in the West hall and runs
//             (on request: Foxy took over Pirate Cove and the camera stall, see updateClassicFoxy)
//   'run'     sprinting down the West Hall to the left door (you can see him on CAM 5)
//   'door'    in the open doorway: shut the door in time!
//   'wait'    shut out; waiting behind the door. Opening it now just brings him back to 'door'
//   'ready'   he stomped: now open the door...
//   'open'    ...and flash him with the light until he leaves (FOXY_FLASH seconds of light in all;
//             it doesn't have to be in one go). Then he's away again. No second door shut
//             (simplified on request: it used to be flash, then shut the door again).
// Shutting the door in 'open' before he's had enough light just puts him back to 'wait'.
const foxyInDoorway = () => ['door', 'open'].includes(G.wfx.phase);
function updateFoxy(dt) {
  const X = G.wfx;
  if (X.level === 0) return;
  const shut = G.doors.L;
  switch (X.phase) {
    case 'away':
      X.timer -= dt * G.pace;
      if (X.timer > 0) return;
      X.phase = 'run';
      X.runT = FOXY_RUN;
      if (onCam('whall')) camStatic(0.3);
      sfx.run(300);   // heavier steps than Foxy's
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
          // Enough light: he gives up and goes away. The zap ends in a ding-ding.
          X.phase = 'away';
          X.timer = witheredFoxyWait(X.level);
          sfx.zap();
          sfx.retreat();
          earnCoin();
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

// ---------- Foxy ----------
// The FNAF 1 fox, with Pirate Cove and the camera stall (on request, taken over from Withered Foxy):
//   'cove'  getting ready (stage 0 curtain shut, 1 peeking, 2 half out); while the monitor is up (on
//           any camera) his countdown stops, so the cameras keep him in
//   'run'   sprinting down the West hall
//   'door'  in the open doorway: shut it in time, or he gets you
// If the door is shut when he gets there he slams into it: a bang, FOXY_DOOR_COST % of your power gone
// (on request), and he's back in the cove.
const classicFoxyInDoorway = () => G.fox.level > 0 && G.fox.phase === 'door';
function updateClassicFoxy(dt) {
  const X = G.fox;
  if (X.level === 0) return;
  switch (X.phase) {
    case 'cove':
      if (G.cam) return;   // being watched on the cameras: he can't get ready
      X.timer -= dt * G.pace;
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
      if (G.doors.L) foxySlam();
      else { X.phase = 'door'; X.deadline = G.t + reactWindow(X.level); sfx.arrive('L', 110); }
      dirty = true;
      return;
    case 'door':
      if (G.doors.L) foxySlam();
      else if (G.t >= X.deadline) lose(FOXY, 'L');
  }
}
// He slams into the shut left door: power lost, and back to the cove.
function foxySlam() {
  const X = G.fox;
  X.phase = 'cove';
  X.stage = 0;
  X.timer = FOXY_INTERVAL * rand(0.7, 1.3);
  sfx.bang();
  earnCoin();
  G.power -= FOXY_DOOR_COST;
  if (G.power <= 0) powerOutStart();
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
    M.timer -= dt * G.pace;
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
  earnCoin();
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
    E.timer -= dt * G.pace;
    if (E.timer <= 0) { E.present = true; E.stayT = endoStay(E.level); sfx.flameOn(); dirty = true; }
  }
}

// ---------- the office heat ----------
// Every night the office slowly heats up (AMBIENT_HEAT), and much faster while the endo is here.
// The heater (for the ducts) heats it too. The fan cools it down, except while the endo is here or the
// heater is on: then it only slows the heating.
// At 100% you pass out (or, if the endo is in the room, he gets the blame).
function updateHeat(dt) {
  const E = G.end;
  const rise = AMBIENT_HEAT + (E.present ? endoHeat(E.level) : 0) + (G.heater ? HEATER_HEAT : 0);
  if (!G.fan) G.heat += rise * dt;
  else if (E.present || G.heater) G.heat += rise * FAN_SLOW * dt;
  else G.heat = Math.max(0, G.heat - FAN_COOL * dt);
  // A heavy breath each time it passes one of the HOT_WARN marks (filter counts how many it's past).
  const warns = HOT_WARN.filter(mark => G.heat >= mark).length;
  if (warns > G.hotWarns) sfx.hot();
  G.hotWarns = warns;
  if (G.heat >= 100) E.present ? lose(ENDO) : passOut();
}

// ---------- Nightmare Foxy ----------
// Silent. He moves Dining area -> West or East hall -> that door, and you can only see it coming on
// the cameras. If the door's shut when he gets there: a bonk, and he goes back to the Dining area.
// If it's open he waits in the doorway for reactWindow seconds (on request: a moment to shut it,
// instead of walking straight in), still unseen (on request: no drawing in the doorway, you have to
// know from the cameras); shut it then and he bonks too. Too slow and he gets inside, and
// he NEVER leaves (on request): he sits in the middle of the office and creeps closer in 3 stages.
// Flashlight on him pushes him back a stage (never out). Past stage 3 he gets you.
const nfoxyInDoorway = () => G.nfx.level > 0 && !G.nfx.inside && G.nfx.step === 2;
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
    X.creepT -= dt * G.pace;
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
  if (nfoxyInDoorway()) {
    const side = X.route[2];
    if (G.doors[side]) { sfx.bonk(side); earnCoin(); nfoxyHome(); dirty = true; }
    else if (G.t >= X.deadline) { X.inside = true; X.stage = 1; X.creepT = NFOXY_CREEP; X.pushT = 0; sfx.slip(); dirty = true; }   // a soft thud: he's in
    return;
  }
  if (X.step === 1) X.hallT += dt;
  X.timer -= dt * G.pace;
  if (X.timer > 0) return;
  X.timer = NFOXY_INTERVAL * rand(0.7, 1.3);
  if (X.step === 1 && X.hallT < NFOXY_HALL_MIN) return;   // always gives you a moment in the hall
  if (Math.random() >= moveChance(X.level)) return;
  if (onCam(X.route[X.step])) camStatic(0.4);
  X.step++;
  if (X.step === 1) { X.hallT = 0; if (onCam(X.route[1])) camStatic(0.4); }
  if (X.step === 2) {
    if (G.doors[X.route[2]]) { sfx.bonk(X.route[2]); earnCoin(); nfoxyHome(); }   // already shut: he gives up at once
    else X.deadline = G.t + reactWindow(X.level);                     // in the doorway: shut it, quick!
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
    F.timer -= dt * G.pace;
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
  earnCoin();
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
  C.timer -= dt * G.pace;
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
    P.timer -= dt * G.pace;
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
    earnCoin();
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
    N.timer -= dt * G.pace;
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
  earnCoin();
  dirty = true;
}

// ======================= the third batch =======================

// ---------- the ducts: Toy Bonnie, Toy Chica and Nedd Bear ----------
// Each crawls one duct room at a time toward DUCT_FRONT (the vent into your office). On each move it
// heads toward the audio lure instead with its own chance (`lure` in data.js), so the lure isn't sure
// (on request). The heater pushes them all back a room every HEATER_STEP seconds while it's on.
// At the front: Toy Bonnie needs the mask; Toy Chica and Nedd Bear get you after frontWindow, unless
// the heater (or a fresh lure they decide to follow) pulls them back first.
// How many moves apart two duct rooms are: rows apart plus columns apart.
const ductSteps = (a, b) => Math.abs(DUCTS[a].r - DUCTS[b].r) + Math.abs(DUCTS[a].c - DUCTS[b].c);
// One room from `from`, closer to `to` (a random one if two are just as good). Stays put if already there.
function ductToward(from, to) {
  if (from === to) return from;
  return pick(DUCTS[from].next.filter(id => ductSteps(id, to) < ductSteps(from, to)));
}
const ductCrawlers = () => DUCT_CRAWLERS.filter(c => G[c.id].level > 0);
function updateDucts(dt) {
  if (G.lureRoom && G.t >= G.lureUntil) { G.lureRoom = null; dirty = true; }
  // The heater: every HEATER_STEP seconds, everyone in the ducts goes one room back toward the start.
  if (G.heater) {
    G.heaterT += dt;
    if (G.heaterT >= HEATER_STEP) {
      G.heaterT = 0;
      for (const c of ductCrawlers()) if (G[c.id].room !== DUCT_START) moveDuct(c, ductToward(G[c.id].room, DUCT_START));
    }
  }
  // The audio lure: every LURE_TICK seconds while it plays, each duct character has a small chance
  // (its `lure` times LURE_PULL) to be pulled one room toward it, even out of the vent at the front.
  // `while` instead of `if` so a slow frame (dt bigger than a tick) still gets all its rolls.
  // A lure played at the vent itself pulls nobody (it would only drag them toward you).
  if (G.lureRoom && G.lureRoom !== DUCT_FRONT) {
    G.lureT += dt;
    while (G.lureT >= LURE_TICK) {
      G.lureT -= LURE_TICK;
      for (const c of ductCrawlers()) {
        if (Math.random() < c.lure * LURE_PULL) moveDuct(c, ductToward(G[c.id].room, G.lureRoom));
      }
    }
  }
  for (const c of ductCrawlers()) {
    const D = G[c.id];
    if (D.room === DUCT_FRONT) {
      if (c === TBONNIE && G.mask) { sfx.ductOut(); earnCoin(); moveDuct(c, DUCT_START); continue; }   // the mask fools him
      if (G.t >= D.deadline) return lose(c);
      continue;
    }
    D.timer -= dt * G.pace;
    if (D.timer > 0) continue;
    D.timer = c.interval * rand(0.7, 1.3);
    if (Math.random() >= moveChance(D.level)) continue;
    moveDuct(c, ductToward(D.room, DUCT_FRONT));   // their own moves always head for the vent
  }
}
// Put duct crawler c in `room`, with the right sound, and start the countdown if it's the front.
function moveDuct(c, room) {
  const D = G[c.id];
  if (room === D.room) return;
  D.room = room;
  if (room === DUCT_FRONT) {
    D.deadline = G.t + (c === TBONNIE ? reactWindow(D.level) : frontWindow(D.level));
    sfx.ductBang();   // a loud bang: someone is at the vent into your office
  } else {
    sfx.ductMove(DUCTS[room].dist);   // a clank, louder the closer they are
  }
  dirty = true;
}
// Clicking a duct room on the DUCTS tab plays the audio lure there (updateDucts does the pulling).
function playLure(room) {
  if (!ready() || !G.cam || G.tab !== 'ducts' || !powered()) return;
  if (G.t < G.lureReadyAt) { sfx.deny(); return; }
  G.lureRoom = room;
  G.lureUntil = G.t + LURE_TIME;
  G.lureReadyAt = G.t + LURE_COOLDOWN;
  G.lureT = LURE_TICK;   // so the first roll happens right away, on the next frame
  sfx.lure();
  dirty = true;
}
function toggleHeater() {
  if (!ready()) return;
  if (!powered() || broken('heater')) { sfx.deny(); return; }
  G.heater = !G.heater;
  G.heaterT = 0;
  sfx.fan(G.heater);
  dirty = true;
}

// ---------- Fazcoins ----------
// One turns up on a random camera every so often; click it there to pick it up. Fending someone off
// also gives one (earnCoin).
function updateCoins(dt) {
  const before = G.camCoins.length;
  G.camCoins = G.camCoins.filter(coin => G.t < coin.until);   // old coins vanish
  if (G.camCoins.length !== before) dirty = true;
  G.coinT -= dt;
  if (G.coinT > 0) return;
  G.coinT = G.coinEvery;
  if (G.camCoins.length >= COINS_ON_CAMS) return;
  const room = pick(CAM_ORDER.filter(r => !G.camCoins.some(coin => coin.room === r)));
  const [r, c] = pick(COIN_SPOTS[room]);
  G.camCoins.push({ room, r, c, until: G.t + COIN_STAY });
  dirty = true;
}
// Clicking the coin lying on the camera you're watching (input.js).
function collectCoin() {
  if (!ready() || !G.cam) return;
  const i = G.camCoins.findIndex(coin => coin.room === G.camRoom);
  if (i < 0) return;
  G.camCoins.splice(i, 1);
  earnCoin();
}
function earnCoin() {
  G.coins++;
  sfx.coin();
  dirty = true;
}

// ---------- the shop ----------
// On the SHOP tab, run by a staff bot with a monocle. Each buy checks you have enough coins.
function spend(cost) {
  if (!ready() || !powered() || G.coins < cost) { sfx.deny(); return false; }
  G.coins -= cost;
  sfx.buy();
  dirty = true;
  return true;
}
function buyBattery() {
  if (G.shop.batteries <= 0 || G.power >= 100) { sfx.deny(); return; }
  if (!spend(BATTERY_COST)) return;
  G.shop.batteries--;
  G.power = Math.min(100, G.power + BATTERY_POWER);
}
const guitarPrice = () => guitarCost(tonight[SETUP.indexOf(RSBONNIE)]);
function buyGuitar() {
  if (G.rsb.level === 0 || G.shop.guitar) { sfx.deny(); return; }
  if (!spend(guitarPrice())) return;
  G.shop.guitar = true;
  sfx.guitar();
}
// The death coin: first press "Death coin", then pick who goes (useDeathCoin). Pressing it again cancels.
function pickDeathCoin() {
  if (!ready()) return;
  if (!G.shop.picking && (G.shop.deathLeft <= 0 || G.coins < DEATH_COIN_COST)) { sfx.deny(); return; }
  G.shop.picking = !G.shop.picking;
  dirty = true;
}
// Who a death coin can still be used on: anyone who's on tonight.
const deathTargets = () => SETUP.filter(c => G[c.id].level > 0);
function useDeathCoin(id) {
  const c = SETUP.find(c => c.id === id);
  if (!G.shop.picking || !c || G[id].level === 0 || G.shop.deathLeft <= 0) return;
  if (!spend(DEATH_COIN_COST)) return;
  G.shop.deathLeft--;
  G.shop.picking = false;
  removeCharacter(c);
  say(`${c.name} is gone for the night.`, 3);
}
// Take character c out of tonight: put it back where it starts, and level 0 stops its rules.
function removeCharacter(c) {
  const X = G[c.id];
  switch (c.id) {
    case 'fre': case 'bon': X.step = 0; break;
    case 'gol': case 'wbn': case 'nfr': case 'end': X.present = false; break;
    case 'pch': X.active = false; X.cups = []; break;
    case 'bnt': case 'stf': case 'fun': case 'rbw': case 'twf': X.active = false; break;
    case 'pup': X.out = false; X.wind = 100; break;
    case 'wfx': X.phase = 'away'; break;
    case 'fox': X.phase = 'cove'; X.stage = 0; break;
    case 'mon': X.room = null; X.sleep = 0; break;
    case 'nfx': X.inside = false; X.step = 0; break;
    case 'chi': X.step = 0; break;
    case 'plu': X.spot = null; break;
    case 'nch': X.room = null; break;
    case 'tbo': case 'tch': case 'ned': X.room = DUCT_START; break;
    case 'tsp': X.active = false; X.toxin = 0; break;
    case 'sbn': X.dark = false; break;
    case 'dee': G.coinEvery = COIN_EVERY; break;   // her slower coins go with her
  }
  if (c.id === 'nfr') X.freddles = [false, false, false];
  X.level = 0;
  dirty = true;
}

// ---------- White Tiger ----------
// Watches how long each thing has been on without a break. Past tigerLimit he jumpscares you (it doesn't
// end the night) and that thing is switched off and broken for TIGER_DISABLE seconds. He leaves alone
// whatever has to stay on right now (see `needed`).
const broken = thing => G.wti.brokenUntil[thing] > G.t;
const TIGER_THINGS = {   // what each thing is called on screen, and whether it's on
  L: ['left door', () => G.doors.L], R: ['right door', () => G.doors.R], cam: ['monitor', () => G.cam],
  flash: ['flashlight', () => flashLit()], fan: ['fan', () => G.fan], mask: ['mask', () => G.mask],
  heater: ['heater', () => G.heater],
};
function needed(thing) {
  if (thing === 'fan') return G.end.present || G.tsp.active;
  if (thing === 'L') return ['wait', 'ready'].includes(G.wfx.phase);
  if (thing === 'mask') return G.nfr.present;
  return false;
}
function updateTiger(dt) {
  const T = G.wti;
  if (T.level === 0) return;
  for (const [thing, [label, isOn]] of Object.entries(TIGER_THINGS)) {
    if (!isOn() || needed(thing)) { T.use[thing] = 0; continue; }
    T.use[thing] = (T.use[thing] || 0) + dt;
    if (T.use[thing] < tigerLimit(T.level)) continue;
    T.use[thing] = 0;
    T.brokenUntil[thing] = G.t + TIGER_DISABLE;
    if (thing === 'L' || thing === 'R') G.doors[thing] = false;
    if (thing === 'cam') { G.cam = false; lookedBack(); }
    if (thing === 'fan') G.fan = false;
    if (thing === 'mask') G.mask = false;
    if (thing === 'heater') G.heater = false;
    G.tigerUntil = performance.now() + 700;   // render.js shows his face until then
    sfx.tiger();
    say(`WHITE TIGER broke the ${label}! ${TIGER_DISABLE} s to fix it.`, TIGER_DISABLE);
    return;
  }
}

// ---------- Chica's Magic Rainbow ----------
// She appears in the corner farthest from your pointer and chases it, a bit slower than a hand can
// move. Positions are in "view widths" from the top left of the view (aim.vx, aim.vy, see input.js).
function updateRainbow(dt) {
  const R = G.rbw;
  if (R.level === 0) return;
  if (!R.active) {
    R.timer -= dt * G.pace;
    if (R.timer > 0) return;
    R.active = true;
    R.left = RAINBOW_TIME;
    R.x = aim.vx < 0.5 ? 1 : 0;
    R.y = aim.vy < aim.vh / 2 ? aim.vh : 0;
    sfx.rainbowIn();
    dirty = true;
    return;
  }
  const dx = aim.vx - R.x, dy = aim.vy - R.y, dist = Math.hypot(dx, dy);
  if (dist < RAINBOW_CATCH) return lose(RAINBOW);
  const step = Math.min(dist, rainbowSpeed(R.level) * dt);
  R.x += dx / dist * step;
  R.y += dy / dist * step;
  R.left -= dt;
  if (R.left <= 0) { R.active = false; R.timer = rainbowWait(R.level); sfx.rainbowOut(); earnCoin(); }
}

// ---------- Rockstar Bonnie ----------
// Buy his guitar in the shop before 5:59, or he comes for it. A reminder at 3 AM and at 5 AM.
function updateRockstar() {
  const R = G.rsb;
  if (R.level === 0 || G.shop.guitar) return;
  const hour = hourOf(G.t);
  if ((hour === 3 || hour === 5) && R.warned !== hour) {
    R.warned = hour;
    sfx.guitar();
    say(`ROCKSTAR BONNIE wants his guitar back! (SHOP, ${guitarPrice()} coins)`, 4);
  }
  if (G.t >= HOUR_SECONDS * NIGHT_HOURS - 1) lose(RSBONNIE);   // 5:59 AM
}

// ---------- Toxic Springtrap ----------
// His fumes fill the office and the toxin meter rises. The fan on with BOTH doors open clears the air;
// back to 0 and he gives up. At 100 you're done.
const airClearing = () => G.fan && !G.doors.L && !G.doors.R;
function updateToxic(dt) {
  const S = G.tsp;
  if (S.level === 0) return;
  if (!S.active) {
    S.timer -= dt * G.pace;
    if (S.timer > 0) return;
    S.active = true;
    S.toxin = 10;   // starts a little way up, so even perfect timing takes a moment to clear
    sfx.toxicIn();
    dirty = true;
    return;
  }
  S.toxin += (airClearing() ? -TOXIN_CLEAR : toxinRate(S.level)) * dt;
  if (S.toxin >= 100) return lose(TOXSPRING);
  if (S.toxin <= 0) { S.active = false; S.toxin = 0; S.timer = toxicWait(S.level); sfx.toxicOut(); earnCoin(); }
}

// ---------- Funtime Foxy ----------
// The SHOWTIME countdown in your office. At 0 the right door must be shut (it was the left until moved on request). No other cue (on request).
function updateFunFoxy(dt) {
  const F = G.ffx;
  if (F.level === 0) return;
  F.timer -= dt;
  if (F.timer > 0) return;
  if (!G.doors.R) return lose(FUNFOXY, 'R');
  sfx.bonk('R');
  earnCoin();
  F.timer = funFoxyWait(F.level) / G.pace;   // stretched on crowded nights (its countdown is in real seconds)
  dirty = true;
}

// ---------- Shadow Bonnie ----------
// Darkness over the office and the cameras for a while. Only the flashlight shows what's there, and in
// the dark it works on the cameras too (see flashLit).
function updateShadow(dt) {
  const S = G.sbn;
  if (S.level === 0) return;
  if (S.dark) {
    S.darkT -= dt;
    if (S.darkT <= 0) { S.dark = false; S.timer = shadowWait(S.level); sfx.shadowOut(); dirty = true; }
    return;
  }
  S.timer -= dt * G.pace;
  if (S.timer > 0) return;
  S.dark = true;
  S.darkT = shadowTime(S.level);
  sfx.shadowIn();
  dirty = true;
}

// ---------- Twisted Foxy ----------
// Gravelly noises: he's digging up out of the floor on CAM 7. Click him there twistTaps times in time.
function updateTwisted(dt) {
  const T = G.twf;
  if (T.level === 0) return;
  if (!T.active) {
    T.timer -= dt * G.pace;
    if (T.timer > 0) return;
    T.active = true;
    T.spot = pick(TWIST_SPOTS);
    T.taps = twistTaps(T.level);
    T.deadline = G.t + twistTime(T.level);
    T.growlT = 0;
    if (onCam('prize')) camStatic(0.3);
    dirty = true;
  }
  T.growlT -= dt;
  if (T.growlT <= 0) { sfx.gravel(); T.growlT = 1.5; }
  if (G.t >= T.deadline) lose(TFOXY);
}
// Clicking him on CAM 7 (input.js): one tap pushes him back down a bit.
function tapTwisted() {
  const T = G.twf;
  if (!ready() || !T.active || !onCam('prize')) return;
  T.taps--;
  sfx.thud();
  if (T.taps <= 0) { T.active = false; T.timer = twistWait(T.level); earnCoin(); }
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
  // The third batch: the heater dies, the duct crawlers back off, and the rest give up too.
  G.heater = false;
  for (const c of DUCT_CRAWLERS) G[c.id].room = DUCT_START;
  G.rbw.active = false;
  G.tsp.active = false;
  G.twf.active = false;
  G.sbn.dark = false;
  if (G.fox.phase !== 'cove') { G.fox.phase = 'cove'; G.fox.stage = 0; }
  if (G.wfx.phase !== 'away') { G.wfx.phase = 'away'; G.wfx.timer = witheredFoxyWait(G.wfx.level); }
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
  if (!powered() || (!G.doors[side] && broken(side))) { sfx.deny(); return; }
  G.doors[side] = !G.doors[side];   // flip: open becomes closed, closed becomes open
  if (G.doors[side]) G.shutAt[side] = G.t;   // remember when it was shut (see updateFuntime)
  sfx.door(side);
  dirty = true;
}

// Raise or lower the monitor. Lowering it is when Golden Freddy and Phantom Chica can be waiting.
function toggleCam() {
  if (!ready()) return;
  if (!powered() || G.mask || (!G.cam && broken('cam'))) { sfx.deny(); return; }   // no monitor without power, with the mask on, or broken
  G.cam = !G.cam;
  sfx.cam();
  if (G.cam) camStatic(0.2);
  else lookedBack();
  dirty = true;
}

// Jump to a camera (raising the monitor first if needed).
function setCam(room) {
  if (!ready()) return;
  if (!powered() || G.mask || broken('cam')) { sfx.deny(); return; }
  G.cam = true;
  G.tab = 'cams';
  G.camRoom = room;
  sfx.cam();
  camStatic(0.22);
  dirty = true;
}

// Put the mask on or take it off. It can't be worn with the monitor up, and with it on the
// monitor can't be raised. It needs no power.
function toggleMask() {
  if (!ready()) return;
  if (G.cam || (!G.mask && broken('mask'))) { sfx.deny(); return; }
  G.mask = !G.mask;
  sfx.mask(G.mask);
  dirty = true;
}

function toggleFan() {
  if (!ready()) return;
  if (!powered() || (!G.fan && broken('fan'))) { sfx.deny(); return; }
  G.fan = !G.fan;
  sfx.fan(G.fan);
  dirty = true;
}

// Pick a monitor tab: 'cams', 'ducts' (only with a duct crawler on) or 'shop'. Raises the monitor.
const tabsOn = () => ['cams', ...(DUCT_CRAWLERS.some(c => G[c.id].level > 0) ? ['ducts'] : []), 'shop'];
function setTab(tab) {
  if (!ready() || !tabsOn().includes(tab)) return;
  if (!G.cam) { toggleCam(); if (!G.cam) return; }
  G.tab = tab;
  if (tab !== 'shop') G.shop.picking = false;
  sfx.cam();
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
  saveLevels();
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
    best = { sum, levels: levelsById(levels) };
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
  else if (c === RSBONNIE) message = `You never bought it back. ${who} came for his guitar at 5:59 AM.`;
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
