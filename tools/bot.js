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
// Run in the page: botNight(levels, profile) -> { won, killer, power }.
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
        if (G.cam) { aim.where = null; return; }
        if (m.c < 0) { aim.where = 'L'; aim.c = m.c + 12; } else if (m.c >= 36) { aim.where = 'R'; aim.c = m.c - 36; } else { aim.where = 'office'; aim.c = m.c; }
        aim.r = m.r;
      };
      // Move the mouse toward (r, c) at the player's speed (rows count double: they're twice as tall).
      const moveTo = (r, c) => {
        const dc = c - m.c, dr = (r - m.r) * 2, dist = Math.hypot(dc, dr), step = speed * DT;
        if (dist <= step) { m.r = r; m.c = c; } else { m.c += dc / dist * step; m.r += dr / 2 / dist * step; }
        return dist <= step;
      };
      const seen = {};
      let busy = 0, fredIdx = -1, cupFoundAt = null, nfxSide = null, patrolNext = 8;
      // Cameras already checked during each kind of camera search (cleared when that search is over).
      const looked = { moon: new Set(), nch: new Set(), fun: new Set(), patrol: new Set() };
      const jitter = () => 0.8 + Math.random() * 0.7;
      const notice = (key, cond, base = react) => { if (cond) { if (!seen[key]) seen[key] = G.t + base * jitter(); } else delete seen[key]; };
      const ready = key => seen[key] != null && G.t >= seen[key];
      const act = (fn, extra = 0) => { fn(); busy = G.t + gap + extra; };
      // The next camera in `list` not checked yet for this search (null when all are checked).
      const nextCam = (set, list = CAM_ORDER) => list.find(r => !set.has(r) && !(G.cam && r === G.camRoom)) || null;

      while (!G.over) {
        const X = G.wfx, S = G.stf, N = G.nfr, Bn = G.bnt, NX = G.nfx, F = G.fun, C = G.chi, P = G.plu, NC = G.nch;
        const down = !G.cam && !G.powerOut;
        const maskNeed = G.gol.present || G.wbn.present || N.present;
        // Nightmare Foxy is silent: the bot only knows his side once it has SEEN him in a hall.
        if (NX.step !== 1 || NX.inside) nfxSide = null;
        notice('nfxSeen', NX.level > 0 && !NX.inside && NX.step === 1 && onCam(NX.route[1]), react * 0.5);
        if (ready('nfxSeen')) nfxSide = NX.route[2];
        // Funtime Freddy: BonBon on his hand means shut his door, AFTER looking at him (a door shut
        // before that doesn't count, so it has to be opened and shut again).
        const funShut = side => F.active && F.seenAt != null && F.bonbon && F.side === side;
        const shutNeed = side => (side === 'R' && G.fre.level > 0 && G.fre.step === FREDDY_LAUGHS)
          || (G.bon.level > 0 && bonnieAtDoor() && bonnieSide() === side)
          || (S.active && !S.stalled && S.side === side && ready('arrow'))
          || (side === 'L' && X.level > 0 && ['run', 'door'].includes(X.phase))
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
        const busyInOffice = () => G.mask || maskNeed || G.pch.active || Bn.active || !!P.spot || funFlash
          || (S.active && !S.stalled) || ['ready', 'open'].includes(X.phase) || (NX.inside && NX.stage >= 2);

        // Cues. Sounds can be heard anywhere; office sights need the monitor down.
        notice('mask', maskNeed);
        notice('unmask', !maskNeed && G.mask, 0.3);
        for (const s of ['L', 'R']) {
          notice('shut' + s, shutNeed(s) && (!G.doors[s] || funReshut(s)));
          notice('open' + s, G.doors[s] && !shutNeed(s) && !keepShut(s), 0.4);
        }
        notice('beep', S.active);                         // the beeping
        notice('arrow', S.active && down, react * 0.4);   // ...then a look at the arrow
        notice('stall', S.active && S.stalled && ready('arrow'));
        notice('foxyOpen', X.phase === 'ready');
        notice('foxyFlash', X.phase === 'open', react * 0.5);
        notice('chica', G.pch.active && down);
        notice('bonnet', Bn.active && down);
        notice('plush', !!P.spot);                        // the giggle
        notice('box', boxLow);
        notice('fred', down && (freddles >= 2 || (freddles >= 1 && G.t > busy + 2)));
        // Camera searches. Sleepy Moon: the lullaby, then flip through the cameras and spot him.
        const moonOut = G.mon.room != null;
        if (!moonOut) looked.moon.clear();
        notice('lullaby', moonOut);
        notice('moonSeen', moonOut && onCam(G.mon.room), react * 0.5);
        // Nightmare Chica: the noise, then search; her cupcake is hidden, so spotting it takes a while.
        const nchOut = NC.room != null;
        if (!nchOut) looked.nch.clear();
        notice('nchNoise', nchOut);
        notice('nchSeen', nchOut && onCam(NC.room), find);
        // Funtime Freddy: his tune, then check the two halls until he's been seen.
        if (!F.active) looked.fun.clear();
        notice('funNoise', F.active && F.seenAt == null);
        // Chica: spotted on a camera, then clicked back.
        notice('chiSeen', C.level > 0 && C.step >= 1 && onCam(chicaRoom()), react * 0.5);
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
        const fanNeed = G.end.present || G.heat >= (G.end.level > 0 ? 40 : HOT_WARN[0]);
        notice('fanOn', fanNeed && !G.fan);
        notice('fanOff', !G.end.present && G.fan && G.heat < 10, 0.5);

        // Is the bot looking at something it's about to act on (the hidden cupcake it's spotting, Moon,
        // Chica, Nightmare Foxy in a hall)? Then it stays on that camera instead of moving on.
        const watching = (nchOut && onCam(NC.room)) || (moonOut && onCam(G.mon.room))
          || (C.level > 0 && C.step >= 1 && onCam(chicaRoom()))
          || (NX.level > 0 && !NX.inside && NX.step === 1 && onCam(NX.route[1]) && !nfxSide);
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
          if (patrolRooms.length && G.t >= patrolNext) jobs.push([30, nextCam(looked.patrol, patrolRooms), looked.patrol]);
          const best = jobs.filter(j => j[1]).sort((a, b) => a[0] - b[0])[0];
          return best ? { room: best[1], set: best[2] } : null;
        };
        const lookingSomewhere = ready('funNoise') || (nchOut && ready('nchNoise')) || (moonOut && ready('lullaby'))
          || (boxLow && ready('box')) || (patrolRooms.length && G.t >= patrolNext);

        // ----- the mouse: Bonnet first, then the flashlight's target -----
        if (fredIdx >= 0 && !N.freddles[fredIdx]) fredIdx = -1;
        if (fredIdx < 0 && ready('fred')) fredIdx = N.freddles.indexOf(true);
        let chasing = false, target = null;
        if (Bn.active && ready('bonnet') && down) {
          chasing = true;
          // Come at her nose from the front (the side she's running toward), then onto it.
          const nr = Bn.y + 1, nc = Bn.x + 2;
          const inFront = (m.c - nc) * Bn.dir > 0;
          if (!inFront && Math.abs(m.c - nc) > 1) moveTo(nr, nc + Bn.dir * 4); else moveTo(nr, nc);
        } else if (P.spot && ready('plush')) target = [P.spot[0] + 0.5, P.spot[1] + 1.5];
        else if (X.phase === 'open' && ready('foxyFlash')) target = [7, -7];
        else if (funFlash) target = [7, F.side === 'L' ? 41 : -7];   // the OTHER door
        else if (NX.inside && NX.stage >= 2) target = NFOXY_STAGES[NX.stage].aim;
        else if (fredIdx >= 0) { const [r, c] = FREDDLE_SPOTS[fredIdx]; target = [r, c + 1.5]; }
        if (target) moveTo(...target);
        placeAim();
        flashKey = !chasing && target != null && down;

        // ----- one action at a time, most urgent first -----
        if (G.t >= busy && !G.powerOut) {
          const nose = Bn.active && Math.abs(m.c - (Bn.x + 2)) <= 0.7 && Math.abs(m.r - (Bn.y + 1)) <= 0.7;
          const job = camJob();
          if (maskNeed && !G.mask && ready('mask')) act(G.cam ? toggleCam : toggleMask);
          else if (ready('shutL') && shutNeed('L') && (!G.doors.L || funReshut('L'))) act(() => toggleDoor('L'));
          else if (ready('shutR') && shutNeed('R') && (!G.doors.R || funReshut('R'))) act(() => toggleDoor('R'));
          else if (chasing && nose) act(boopBonnet);
          else if (ready('fanOn') && fanNeed && !G.fan) act(toggleFan);   // one quick click: never put off
          else if (ready('unmask') && G.mask && !maskNeed) act(toggleMask);
          else if (ready('stall') && S.stalled && G.doors[S.side]) act(() => toggleDoor(S.side));
          else if (ready('foxyOpen') && X.phase === 'ready' && G.doors.L) act(() => toggleDoor('L'));
          // BonBon is at a door that's shut: open it (if nothing else needs it shut) so the light can reach her.
          else if (funFlash && G.doors[otherSide(F.side)] && !shutNeed(otherSide(F.side)) && !keepShut(otherSide(F.side)))
            act(() => toggleDoor(otherSide(F.side)));
          else if (G.cam && busyInOffice()) act(toggleCam);   // something in the office needs me
          else if (ready('moonSeen') && moonOut && onCam(G.mon.room)) act(clickMoon);
          else if (ready('nchSeen') && nchOut && onCam(NC.room)) act(clickCupcakeCam);
          else if (ready('chiSeen') && C.step >= 1 && onCam(chicaRoom())) act(pushChica);
          else if (boxLow && ready('box') && onCam('prize')) act(windBox);
          else if (job && !G.mask) {
            // Look at the next camera for the most urgent search (a moment to take in the picture).
            job.set.add(job.room);
            act(() => setCam(job.room), react * 0.3);
          }
          else if (G.cam && !lookingSomewhere && !watching) act(toggleCam);   // nothing to watch: back to the office
          else if (ready('chica') && G.pch.active && down && !G.mask) {
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
      }      result.power = Math.round(G.power);
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