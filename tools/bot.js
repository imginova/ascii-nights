/* =====================================================================
   bot.js: a TEST BOT that plays the game, to check every challenge is
   humanly possible. It is NOT part of the game: index.html doesn't load
   it and tools/build.js doesn't put it online.

   How to use it: open the game in a browser, open the developer console
   (F12), and paste:
       (0, eval)(await fetch('tools/bot.js').then(r => r.text()))
   (That only works when the game is served by a web server, not opened
   by double-clicking.) Then, for example:
       botNight(everyone(20), BOT.average)   plays one All 20 night
       botReport(30)                         plays every challenge 30 times
                                             as an average player and a beginner

   The bot calls the game's own functions (toggleDoor, toggleMask...) and
   runs update() itself, much faster than real time.
   ===================================================================== */
// A balance-testing bot for ASCII Nights that plays with a PERSON's limits:
//  - it only reacts to cues a player gets (sounds anywhere; things in the office only while the monitor is down),
//  - every reaction takes `react` seconds times a random 0.8-1.5 (people aren't equally quick every time),
//  - it does one thing at a time, each taking `gap` seconds,
//  - its mouse moves at `mouse` characters per second (Bonnet's real dodging runs against it, and the
//    flashlight only lights what the mouse has actually reached),
//  - finding each shadow cupcake takes `find` seconds times a random 0.7-1.4,
//  - it needs the monitor down to read the staff bot's arrow.
// The third batch taught it (2026-11-07): the heater when a duct crawler clanks close (and the mask for
// Toy Bonnie at the vent), picking up coins it happens to see, the shop (the guitar first, then death
// coins on the hardest one on tonight, then batteries when low), breaking up long uses for White Tiger,
// running the mouse away from the Magic Rainbow (no mouse clicks while it does), the fan with both doors
// open for Toxic Springtrap, Funtime Foxy's countdown, Foxy (shut the door when he runs), tapping
// Twisted Foxy, and Shadow Bonnie's darkness (slower to spot things; the flashlight on the cameras).
// The fourth batch taught it (2026-11-08): Phantom Foxy (monitor down, open his door if it can, light the
// doorway), typing L O L for Lolbit (and no clicks while the LOL screen is up), feeding Piranha Plushtrap
// when his meter gets low (keeping two coins back for it), Funtime Chica's prices, and hearing the Mop
// bucket's squeak when Nightmare Foxy skips his hall.
// Run in the page: botNight(levels, profile) -> { won, killer, power, coins }.
(function () {
  const DT = 0.02;
  // Profiles: an average player and a beginner.
  const PROFILES = {
    average: { react: 0.75, gap: 0.45, find: 1.2, mouse: 40 },
    beginner: { react: 1.1, gap: 0.6, find: 1.8, mouse: 25 },
  };

  function botNight(lvls, profile = PROFILES.average) {
    const { react, gap, find, mouse: speed } = profile;
    levels = lvls.slice();
    const result = { won: false, killer: null };
    const realWin = win, realLose = lose, realPassOut = passOut;
    win = () => { G.over = true; result.won = true; };
    lose = c => { G.over = true; result.killer = c.id; };
    passOut = () => { G.over = true; result.killer = 'heat'; };
    try {
      newGame();
      G.paused = false;
      flashKey = flashMouse = flashButton = false;
      // The mouse, in one coordinate system across the view: columns -12..-1 are the left doorway,
      // 0..35 the office, 36..47 the right doorway. Rows 0..15.
      const m = { r: 8, c: 18 };
      const placeAim = () => {
        // Where the Magic Rainbow sees the pointer: the bot's view is 60 columns wide (12 + 36 + 12) and a
        // row is about twice as tall as a column is wide.
        aim.vx = (m.c + 12) / 60; aim.vy = m.r * 2 / 60; aim.vh = 32 / 60;
        if (G.cam) { aim.where = null; return; }
        if (m.c < 0) { aim.where = 'L'; aim.c = m.c + 12; } else if (m.c >= 36) { aim.where = 'R'; aim.c = m.c - 36; } else { aim.where = 'office'; aim.c = m.c; }
        aim.r = Math.max(0, Math.min(15, m.r));
      };
      // Move the mouse toward (r, c) at the player's speed (rows count double: they're twice as tall).
      const moveTo = (r, c, f = 1) => {   // f: a speed factor
        const dc = c - m.c, dr = (r - m.r) * 2, dist = Math.hypot(dc, dr), step = speed * DT * f;
        if (dist <= step) { m.r = r; m.c = c; } else { m.c += dc / dist * step; m.r += dr / 2 / dist * step; }
        return dist <= step;
      };
      const seen = {};
      let busy = 0, fredIdx = -1, cupFoundAt = null, nfxSide = null, patrolNext = 8;
      // Who the bot spends death coins on first (the ones it finds hardest), and how it judges a duct
      // crawler's distance from the clanks (dist 1 = at the vent).
      const DEATH_ORDER = ['rbw', 'nfr', 'wti', 'twf', 'nch', 'mon', 'tsp', 'ffx', 'pir', 'pch', 'nfx', 'fun', 'bnt', 'plu',
        'lol', 'pfx', 'tbo', 'tch', 'ned', 'chi', 'stf', 'end', 'wfx', 'fox', 'wbn', 'gol', 'pup', 'sbn', 'bon', 'fre',
        'sec', 'mop', 'fch', 'rsb', 'dee'];
      let lastNfxStep = 0;   // to hear the Mop bucket's squeak when Nightmare Foxy skips his hall
      const ductDist = c => DUCTS[G[c.id].room].dist;
      // Cameras already checked during each kind of camera search (cleared when that search is over).
      const looked = { moon: new Set(), nch: new Set(), fun: new Set(), patrol: new Set(), coins: new Set() };
      let coinHuntNext = 10;   // with Rockstar Bonnie on, a sweep of the cameras for coins every so often
      let fleeA = null;        // which way the mouse is running from the Magic Rainbow (an angle)
      const jitter = () => 0.8 + Math.random() * 0.7;
      // In Shadow Bonnie's darkness, things you have to SEE take longer to spot (`sight` marks those).
      const notice = (key, cond, base = react, sight = false) => {
        if (cond) { if (!seen[key]) seen[key] = G.t + base * jitter() * (sight && G.sbn.dark ? 1.8 : 1); } else delete seen[key];
      };
      const ready = key => seen[key] != null && G.t >= seen[key];
      const act = (fn, extra = 0) => { fn(); busy = G.t + gap + extra; };
      // The next camera in `list` not checked yet for this search (null when all are checked).
      const nextCam = (set, list = CAM_ORDER) => list.find(r => !set.has(r) && !(G.cam && r === G.camRoom)) || null;

      while (!G.over) {
        const X = G.wfx, S = G.stf, N = G.nfr, Bn = G.bnt, NX = G.nfx, F = G.fun, C = G.chi, P = G.plu, NC = G.nch;
        const down = !G.cam && !G.powerOut;
        const FX = G.fox, FF = G.ffx, TW = G.twf, RB = G.rbw;
        const maskNeed = G.gol.present || G.wbn.present || N.present || (G.tbo.level > 0 && G.tbo.room === DUCT_FRONT);
        // The Magic Rainbow: while she's out the mouse is busy running away, so no mouse clicks.
        notice('rainbow', RB.active, react * 0.6);
        const dodging = RB.active && ready('rainbow');
        // Nightmare Foxy is silent: the bot only knows his side once it has SEEN him in a hall.
        if (NX.step === 0 || NX.inside) nfxSide = null;   // (kept while he's in the hall or the doorway)
        notice('nfxSeen', NX.level > 0 && !NX.inside && NX.step === 1 && onCam(NX.route[1]), react * 0.5);
        if (ready('nfxSeen')) nfxSide = NX.route[2];
        // ...or when the Mop bucket squeaks: he skipped the hall (step 0 straight to 2), and the squeak
        // says which side.
        if (NX.step === 2 && lastNfxStep === 0 && seen.mopSqueak == null) seen.mopSqueak = G.t + react * jitter();
        if (NX.step !== 2) delete seen.mopSqueak;
        lastNfxStep = NX.step;
        if (ready('mopSqueak')) nfxSide = NX.route[2];
        // Funtime Freddy: BonBon on his hand means shut his door, AFTER looking at him (a door shut
        // before that doesn't count, so it has to be opened and shut again).
        const funShut = side => F.active && F.seenAt != null && F.bonbon && F.side === side;
        const shutNeed = side => (side === 'R' && G.fre.level > 0 && G.fre.step === FREDDY_LAUGHS)
          || (G.bon.level > 0 && bonnieAtDoor() && bonnieSide() === side)
          || (S.active && !S.stalled && S.side === side && ready('arrow'))
          || (side === 'L' && X.level > 0 && ['run', 'door'].includes(X.phase))
          || (side === 'L' && FX.level > 0 && ['run', 'door'].includes(FX.phase))
          // Funtime Foxy: a player reads the SHOWTIME countdown and shuts the right door just before 0.
          || (side === 'R' && FF.level > 0 && FF.timer < 1.2 + react * 1.5)
          || nfxSide === side
          || funShut(side);
        const keepShut = side => side === 'L' && X.level > 0 && X.phase === 'wait';
        const funReshut = side => funShut(side) && G.doors[side] && G.shutAt[side] < F.seenAt;
        const boxLow = G.pup.level > 0 && !G.pup.out && G.pup.wind < BOX_LOW;
        const freddles = N.freddles.filter(Boolean).length;
        const funFlash = F.active && F.seenAt != null && !F.bonbon;   // BonBon at the other door: light it
        // Something in the office that needs the monitor down right now (a sensible player finishes these
        // before going back to the cameras): the mask, cupcakes, Bonnet, Plushtrap, the staff bot's arrow,
        // Foxy's open-and-flash routine, BonBon at a door, or Nightmare Foxy creeping close.
        const PF = G.pfx, LB = G.lol, PR = G.pir;
        const busyInOffice = () => G.mask || maskNeed || G.pch.active || Bn.active || !!P.spot || funFlash
          || (S.active && !S.stalled) || ['ready', 'open'].includes(X.phase) || (NX.inside && NX.stage >= 2)
          || (PF.active && ready('pfoxy'));
        // ----- the fourth batch -----
        // Phantom Foxy: his running steps say which door; then monitor down, open that door if nothing else
        // needs it shut, and shine the light into the doorway.
        notice('pfoxy', PF.active, react);
        // Lolbit: the LOL screen is seen anywhere; then type L, O, L. While it's up nothing can be clicked.
        notice('lol', LB.active, react * 0.6, true);
        const noClick = LB.active;
        // Piranha Plushtrap: the bot keeps an eye on his food meter (like the music box) and goes to feed him.
        const pirLow = PR.level > 0 && PR.food < PIR_LOW + 10 && G.coins >= PIR_COST;
        notice('pir', pirLow, react);

        // Cues. Sounds can be heard anywhere; office sights need the monitor down.
        notice('mask', maskNeed);
        notice('unmask', !maskNeed && G.mask, 0.3);
        for (const s of ['L', 'R']) {
          notice('shut' + s, shutNeed(s) && (!G.doors[s] || funReshut(s)));
          notice('open' + s, G.doors[s] && !shutNeed(s) && !keepShut(s), 0.4);
        }
        notice('beep', S.active);                         // the beeping
        notice('arrow', S.active && down, react * 0.4, true);   // ...then a look at the arrow
        notice('stall', S.active && S.stalled && ready('arrow'));
        notice('foxyOpen', X.phase === 'ready');
        notice('foxyFlash', X.phase === 'open', react * 0.5);
        notice('chica', G.pch.active && down, react, true);
        notice('bonnet', Bn.active && down, react, true);
        notice('plush', !!P.spot);                        // the giggle
        notice('box', boxLow);
        notice('fred', down && (freddles >= 2 || (freddles >= 1 && G.t > busy + 2)), react, true);
        // Camera searches. Sleepy Moon: the lullaby, then flip through the cameras and spot him.
        const moonOut = G.mon.room != null;
        if (!moonOut) looked.moon.clear();
        notice('lullaby', moonOut);
        notice('moonSeen', moonOut && onCam(G.mon.room), react * 0.5, true);
        // Nightmare Chica: the noise, then search; her cupcake is hidden, so spotting it takes a while.
        const nchOut = NC.room != null;
        if (!nchOut) looked.nch.clear();
        notice('nchNoise', nchOut);
        notice('nchSeen', nchOut && onCam(NC.room), find, true);
        // Funtime Freddy: his tune, then check the two halls until he's been seen.
        if (!F.active) looked.fun.clear();
        notice('funNoise', F.active && F.seenAt == null);
        // Chica: spotted on a camera, then clicked back.
        notice('chiSeen', C.level > 0 && C.step >= 1 && onCam(chicaRoom()), react * 0.5, true);
        // ----- the third batch -----
        // The ducts: a loud clank (two rooms from the vent or closer) means heater on; off again once
        // everyone is back near the start.
        const crawlers = DUCT_CRAWLERS.filter(c => G[c.id].level > 0);
        const ductDanger = crawlers.some(c => ductDist(c) <= 2 && !(c === TBONNIE && G.mask));
        notice('heaterOn', ductDanger && !G.heater);
        notice('heaterOff', G.heater && crawlers.every(c => ductDist(c) >= 4), 0.4);
        // A coin on the camera being watched: spot it, then click it.
        const coinHere = G.cam && G.tab === 'cams' && G.camCoins.some(c => c.room === G.camRoom);
        notice('coinSeen', coinHere, react * 0.6, true);
        // Twisted Foxy: the gravel noise, then CAM 7, then tap, tap, tap.
        notice('gravel', TW.active);
        notice('twfSeen', TW.active && onCam('prize'), react * 0.5, true);
        // Toxic Springtrap: the hiss and the purple: fan on, both doors open (handled by fanNeed and the
        // door-opening cues below).
        notice('toxic', G.tsp.active);
        // White Tiger: a player who knows he's on doesn't leave anything on too long. The bot "feels"
        // when something has been on a while (a little early, with some randomness) and breaks it up.
        const tigerSoon = thing => G.wti.level > 0 && !needed(thing) && (G.wti.use[thing] || 0) > tigerLimit(G.wti.level) - 1.5 - react;
        // The patrol for the silent ones (Nightmare Foxy, Chica): every so often, check their cameras.
        const patrolRooms = [...(NX.level > 0 ? ['whall', 'ehall'] : []), ...(C.level > 0 ? ['dining', 'back', 'whall'] : [])]
          .filter((r, i, all) => all.indexOf(r) === i);
        if (patrolRooms.length && G.t >= patrolNext && !nextCam(looked.patrol, patrolRooms) && (!G.cam || looked.patrol.has(G.camRoom))) {
          looked.patrol.clear();
          patrolNext = G.t + 8;   // done: the next round in 8 s
        }
        // The fan: on when the endo arrives or the first hot breath plays (70%), off once it's cool again.
        // On nights with the endo it keeps the office cooler (fan on from 40%), so he can't push a warm
        // office over 100%. (A player reads the HEAT meter for this.)
        const fanNeed = G.end.present || (G.tsp.active && ready('toxic'))
          || G.heat >= (G.end.level > 0 || G.heater ? 40 : HOT_WARN[0]);
        notice('fanOn', fanNeed && !G.fan);
        notice('fanOff', !G.end.present && !G.tsp.active && G.fan && G.heat < 10, 0.5);

        // Coin hunting: with Rockstar Bonnie on and not enough coins for his guitar yet, look through every
        // camera now and then (a sweep), picking up any coin it sees.
        const needCoins = (G.rsb.level > 0 && !G.shop.guitar && G.coins < guitarPrice()) || (PR.level > 0 && G.coins < 2 * PIR_COST);
        if (needCoins && G.t >= coinHuntNext && !nextCam(looked.coins) && (!G.cam || looked.coins.has(G.camRoom))) {
          looked.coins.clear();
          coinHuntNext = G.t + 12;
        }
        const coinHunt = needCoins && G.t >= coinHuntNext;
        // Is the bot looking at something it's about to act on (the hidden cupcake it's spotting, Moon,
        // Chica, Nightmare Foxy in a hall)? Then it stays on that camera instead of moving on.
        const watching = (nchOut && onCam(NC.room)) || (moonOut && onCam(G.mon.room))
          || (C.level > 0 && C.step >= 1 && onCam(chicaRoom()))
          || (NX.level > 0 && !NX.inside && NX.step === 1 && onCam(NX.route[1]) && !nfxSide)
          || (TW.active && onCam('prize')) || (coinHere && !dodging) || (pirLow && onCam('back'));
        // Which camera the bot wants to look at next: of all the camera jobs waiting, the one that runs
        // out soonest (a person does whatever is most urgent). Returns { room, set } or null.
        const searchIn = (set, list = CAM_ORDER) => nextCam(set, list) || (set.clear(), nextCam(set, list));
        const camJob = () => {
          if (busyInOffice() || watching) return null;
          const jobs = [];   // [seconds left, room, the "looked" set it belongs to]
          if (ready('funNoise')) jobs.push([F.deadline - G.t, searchIn(looked.fun, ['whall', 'ehall']), looked.fun]);
          if (ready('nchNoise') && nchOut) jobs.push([NC.deadline - G.t, searchIn(looked.nch), looked.nch]);
          if (ready('lullaby') && moonOut) jobs.push([(100 - G.mon.sleep) / moonRate(G.mon.level), searchIn(looked.moon), looked.moon]);
          if (ready('box') && boxLow) jobs.push([G.pup.wind / boxDrain(G.pup.level), 'prize', new Set()]);
          if (ready('gravel') && TW.active && !dodging) jobs.push([TW.deadline - G.t - 2, 'prize', new Set()]);
          if (ready('pir') && pirLow) jobs.push([PR.food / (pirDrain(PR.level) * G.pace), 'back', new Set()]);
          if (coinHunt) jobs.push([60, nextCam(looked.coins), looked.coins]);
          if (patrolRooms.length && G.t >= patrolNext) jobs.push([30, nextCam(looked.patrol, patrolRooms), looked.patrol]);
          const best = jobs.filter(j => j[1]).sort((a, b) => a[0] - b[0])[0];
          return best ? { room: best[1], set: best[2] } : null;
        };
        const lookingSomewhere = ready('funNoise') || (nchOut && ready('nchNoise')) || (moonOut && ready('lullaby'))
          || (boxLow && ready('box')) || (patrolRooms.length && G.t >= patrolNext) || (TW.active && ready('gravel')) || coinHunt
          || (pirLow && ready('pir'));
        // The shop: what the bot wants to buy right now, if anything (the guitar first, then a death coin
        // on the hardest one on tonight, then a battery when the power is low and nothing else is wanted).
        const S2 = G.shop;
        const wantGuitar = G.rsb.level > 0 && !S2.guitar;
        const deathTarget = DEATH_ORDER.find(id => G[id] && G[id].level > 0);
        const canBattery = S2.batteries > 0 && G.coins >= batteryPrice() && G.power < 100 - BATTERY_POWER;
        // (Death coins come first early in the night: the guitar is only needed by 5:59, so from 3 AM on
        // the bot buys it as soon as it can, and only buys other things with coins it doesn't need for it.)
        const guitarTime = wantGuitar && G.t >= 3 * HOUR_SECONDS;
        // Coins not set aside for the guitar (or for feeding Piranha Plushtrap: two kept back).
        const spare = G.coins - (guitarTime ? guitarPrice() : 0) - (PR.level > 0 ? 2 * PIR_COST : 0);
        const want = guitarTime && G.coins >= guitarPrice() ? 'guitar'
          : G.power < 25 && canBattery && (spare >= batteryPrice() || G.power < 10) ? 'battery'   // about to run out
          : S2.deathLeft > 0 && deathTarget && spare >= deathPrice() ? 'death'
          : G.power < 40 && canBattery && spare >= batteryPrice() && !(S2.deathLeft > 0 && deathTarget && spare >= 10) ? 'battery'
          : null;

        // ----- the mouse: Bonnet first, then the flashlight's target -----
        if (fredIdx >= 0 && !N.freddles[fredIdx]) fredIdx = -1;
        if (fredIdx < 0 && ready('fred')) fredIdx = N.freddles.indexOf(true);
        let chasing = false, target = null;
        if (dodging) {
          // Run the pointer away from the rainbow, around the page (it's bigger than the view: the HUD
          // above, the buttons below). Positions in view widths (see placeAim). Try 16 directions and take
          // the one that ends up farthest from her while keeping away from the page's edges, so it
          // circles instead of getting stuck in a corner. Fleeing is a rough sweep, not careful aiming, so
          // the mouse moves 1.5 times its aiming speed.
          const [x0, x1, y0, y1] = [-0.3, 1.3, -0.2, 1.0];
          const px = aim.vx, py = aim.vy, look = 0.15;
          let best = null;
          for (let k = 0; k < 16; k++) {
            const a = k / 16 * 2 * Math.PI, nx = px + Math.cos(a) * look, ny = py + Math.sin(a) * look;
            if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
            const edge = Math.min(nx - x0, x1 - nx, ny - y0, y1 - ny);
            // (+ a small bonus for keeping the same direction, so it doesn't flip back and forth)
            const score = Math.hypot(nx - RB.x, ny - RB.y) + 0.5 * Math.min(edge, 0.3) + (fleeA == null ? 0 : 0.08 * Math.cos(a - fleeA));
            if (!best || score > best.score) best = { score, a };
          }
          const a = best ? best.a : Math.atan2(0.4 - py, 0.5 - px);
          fleeA = a;
          moveTo(m.r + Math.sin(a) * 30, m.c + Math.cos(a) * 60, 1.5);
          m.r = Math.max(y0 * 30, Math.min(y1 * 30, m.r)); m.c = Math.max(x0 * 60 - 12, Math.min(x1 * 60 - 12, m.c));
        } else if (Bn.active && ready('bonnet') && down) {
          chasing = true;
          // Come at her nose from the front (the side she's running toward), then onto it.
          const nr = Bn.y + 1, nc = Bn.x + 2;
          const inFront = (m.c - nc) * Bn.dir > 0;
          if (!inFront && Math.abs(m.c - nc) > 1) moveTo(nr, nc + Bn.dir * 4); else moveTo(nr, nc);
        } else if (P.spot && ready('plush')) target = [P.spot[0] + 0.5, P.spot[1] + 1.5];
        else if (X.phase === 'open' && ready('foxyFlash')) target = [7, -7];
        else if (funFlash) target = [7, F.side === 'L' ? 41 : -7];   // the OTHER door
        else if (PF.active && ready('pfoxy')) target = [7, PF.side === 'L' ? -7 : 41];   // Phantom Foxy's doorway
        else if (NX.inside && NX.stage >= 2) target = NFOXY_STAGES[NX.stage].aim;
        else if (fredIdx >= 0) { const [r, c] = FREDDLE_SPOTS[fredIdx]; target = [r, c + 1.5]; }
        if (target && !dodging) moveTo(...target);
        placeAim();
        flashKey = !chasing && !dodging && target != null && down;
        // In Shadow Bonnie's darkness the cameras need the flashlight too, while searching them.
        if (G.cam && G.sbn.dark && (lookingSomewhere || watching)) flashKey = true;

        // ----- one action at a time, most urgent first -----
        if (G.t >= busy && !G.powerOut) {
          const nose = Bn.active && Math.abs(m.c - (Bn.x + 2)) <= 0.7 && Math.abs(m.r - (Bn.y + 1)) <= 0.7;
          const job = camJob();
          if (maskNeed && !G.mask && ready('mask')) act(G.cam ? toggleCam : toggleMask);
          // (A broken door can't be shut, so a person gets on with something else instead of pressing it.)
          else if (ready('shutL') && shutNeed('L') && !broken('L') && (!G.doors.L || funReshut('L'))) act(() => toggleDoor('L'));
          else if (ready('shutR') && shutNeed('R') && !broken('R') && (!G.doors.R || funReshut('R'))) act(() => toggleDoor('R'));
          // Lolbit: type L, O, L (quick key presses, not a full action each).
          else if (ready('lol') && LB.active) act(() => typeLol(LOL_WORD[LB.typed]), 0.15 - gap);
          else if (chasing && nose && !noClick) act(boopBonnet);
          else if (ready('fanOn') && fanNeed && !G.fan) act(toggleFan);   // one quick click: never put off
          else if (ready('heaterOn') && ductDanger && !G.heater) act(toggleHeater);
          // White Tiger: break up anything that's been on a long time (if it can be spared right now).
          else if (tigerSoon('cam') && G.cam) act(toggleCam);
          else if (tigerSoon('fan') && G.fan) act(toggleFan);
          else if (tigerSoon('heater') && G.heater) act(toggleHeater);
          else if (tigerSoon('L') && G.doors.L && !shutNeed('L')) act(() => toggleDoor('L'));
          else if (tigerSoon('R') && G.doors.R && !shutNeed('R')) act(() => toggleDoor('R'));
          else if (tigerSoon('mask') && G.mask && !maskNeed) act(toggleMask);
          // Twisted Foxy on CAM 7: click him again and again (quick clicks, not a full action each).
          else if (ready('twfSeen') && TW.active && onCam('prize') && !dodging && !noClick) act(tapTwisted, 0.18 - gap);
          else if (ready('unmask') && G.mask && !maskNeed) act(toggleMask);
          else if (ready('stall') && S.stalled && G.doors[S.side] && !shutNeed(S.side)) act(() => toggleDoor(S.side));
          else if (ready('foxyOpen') && X.phase === 'ready' && G.doors.L && !shutNeed('L')) act(() => toggleDoor('L'));
          // BonBon is at a door that's shut: open it (if nothing else needs it shut) so the light can reach her.
          else if (funFlash && G.doors[otherSide(F.side)] && !shutNeed(otherSide(F.side)) && !keepShut(otherSide(F.side)))
            act(() => toggleDoor(otherSide(F.side)));
          // Phantom Foxy at a shut door: open it (if nothing else needs it shut) so the light can reach him.
          else if (PF.active && ready('pfoxy') && G.doors[PF.side] && !shutNeed(PF.side) && !keepShut(PF.side))
            act(() => toggleDoor(PF.side));
          else if (G.cam && busyInOffice()) act(toggleCam);   // something in the office needs me
          else if (ready('moonSeen') && moonOut && onCam(G.mon.room) && !dodging && !noClick) act(clickMoon);
          else if (ready('nchSeen') && nchOut && onCam(NC.room) && !dodging && !noClick) act(clickCupcakeCam);
          else if (ready('chiSeen') && C.step >= 1 && onCam(chicaRoom()) && !dodging && !noClick) act(pushChica);
          else if (boxLow && ready('box') && onCam('prize')) act(windBox);
          else if (ready('pir') && pirLow && onCam('back') && !dodging && !noClick) act(feedPiranha);
          else if (ready('heaterOff') && G.heater) act(toggleHeater);
          else if (ready('coinSeen') && coinHere && !dodging && !noClick) act(collectCoin);
          // Shopping: switch to the SHOP tab (one action), then buy (another). A death coin is two clicks.
          else if (want && !G.mask && !busyInOffice() && !dodging && !noClick) {
            if (!G.cam || G.tab !== 'shop') act(() => setTab('shop'));
            else if (want === 'guitar') act(buyGuitar);
            else if (want === 'battery') act(buyBattery);
            else if (!S2.picking) act(pickDeathCoin);
            else act(() => useDeathCoin(deathTarget));
          }
          else if (job && !G.mask) {
            // Look at the next camera for the most urgent search (a moment to take in the picture).
            job.set.add(job.room);
            act(() => setCam(job.room), react * 0.3);
          }
          else if (G.cam && !lookingSomewhere && !watching) act(toggleCam);   // nothing to watch: back to the office
          else if (ready('chica') && G.pch.active && down && !G.mask && !dodging && !noClick) {
            // Searching for the next cupcake takes a while; then click it.
            if (cupFoundAt == null) cupFoundAt = G.t + find * (0.7 + Math.random() * 0.7);
            if (G.t >= cupFoundAt) { act(() => clickCupcake(0)); cupFoundAt = null; }
          }
          else if (ready('openL') && G.doors.L && !shutNeed('L') && !keepShut('L') && !S.stalled) act(() => toggleDoor('L'));
          else if (ready('openR') && G.doors.R && !shutNeed('R') && !S.stalled) act(() => toggleDoor('R'));
          else if (ready('fanOff') && G.fan) act(toggleFan);
        }
        if (!G.pch.active) cupFoundAt = null;
        update(DT);
      }
      result.power = Math.round(G.power);
      result.coins = G.coins;
    } finally {
      win = realWin; lose = realLose; passOut = realPassOut;
      flashKey = false;
    }
    return result;
  }

  window.BOT = PROFILES;
  window.botNight = botNight;
})();

// Play every challenge `n` times as an average player and as a beginner, and list the wins
// (and who got the bot when it lost), hardest last.
window.botReport = function (n = 30) {
  return PRESETS.map(p => {
    const parts = ['average', 'beginner'].map(prof => {
      let w = 0; const k = {};
      for (let i = 0; i < n; i++) { const r = botNight(p.levels, BOT[prof]); if (r.won) w++; else k[r.killer] = (k[r.killer] || 0) + 1; }
      return `${prof} ${w}/${n}` + (w < n ? ' ' + JSON.stringify(k) : '');
    });
    return `${p.name}: ${parts.join(', ')}`;
  }).join('\n');
};