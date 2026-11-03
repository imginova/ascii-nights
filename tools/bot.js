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
      let busy = 0, fredIdx = -1, moonUntil = 0, cupFoundAt = null;
      const jitter = () => 0.8 + Math.random() * 0.7;
      const notice = (key, cond, base = react) => { if (cond) { if (!seen[key]) seen[key] = G.t + base * jitter(); } else delete seen[key]; };
      const ready = key => seen[key] != null && G.t >= seen[key];
      const act = (fn, extra = 0) => { fn(); busy = G.t + gap + extra; };

      while (!G.over) {
        const X = G.wfx, S = G.stf, N = G.nfr, Bn = G.bnt;
        const down = !G.cam && !G.powerOut;
        const maskNeed = G.gol.present || G.wbn.present || N.present;
        const shutNeed = side => (side === 'R' && G.fre.level > 0 && G.fre.step === FREDDY_LAUGHS)
          || (G.bon.level > 0 && bonnieAtDoor() && bonnieSide() === side)
          || (S.active && !S.stalled && S.side === side && ready('arrow'))
          || (side === 'L' && X.level > 0 && ['run', 'door', 'flashed'].includes(X.phase));
        const keepShut = side => side === 'L' && X.level > 0 && X.phase === 'wait';
        const boxLow = G.pup.level > 0 && !G.pup.out && G.pup.wind < BOX_LOW;
        const freddles = N.freddles.filter(Boolean).length;

        // Cues. Sounds can be heard anywhere; office sights need the monitor down.
        notice('mask', maskNeed);
        notice('unmask', !maskNeed && G.mask, 0.3);
        for (const s of ['L', 'R']) {
          notice('shut' + s, shutNeed(s) && !G.doors[s]);
          notice('open' + s, G.doors[s] && !shutNeed(s) && !keepShut(s), 0.4);
        }
        notice('beep', S.active);                         // the beeping
        notice('arrow', S.active && down, react * 0.4);   // ...then a look at the arrow
        notice('stall', S.active && S.stalled && ready('arrow'));
        notice('foxyOpen', X.phase === 'ready');
        notice('foxyFlash', X.phase === 'open', react * 0.5);
        notice('chica', G.pch.active && down);
        notice('bonnet', Bn.active && down);
        notice('box', boxLow);
        notice('fred', down && (freddles >= 2 || (freddles >= 1 && G.t > busy + 2)));
        notice('moon', G.mon.level > 0 && G.mon.sleep >= 50);
        // The fan: on when the endo arrives or the first hot breath plays (70%), off once it's cool again.
        const fanNeed = G.end.present || G.heat >= HOT_WARN[0];
        notice('fanOn', fanNeed && !G.fan);
        notice('fanOff', !G.end.present && G.fan && G.heat < 10, 0.5);

        // ----- the mouse: Bonnet first, then the flashlight's target -----
        if (fredIdx >= 0 && !N.freddles[fredIdx]) fredIdx = -1;
        if (fredIdx < 0 && ready('fred')) fredIdx = N.freddles.indexOf(true);
        if (ready('moon') && moonUntil < G.t) moonUntil = G.t + 1;
        let chasing = false, target = null;
        if (Bn.active && ready('bonnet') && down) {
          chasing = true;
          // Come at her nose from the front (the side she's running toward), then onto it.
          const nr = Bn.y + 1, nc = Bn.x + 2;
          const inFront = (m.c - nc) * Bn.dir > 0;
          if (!inFront && Math.abs(m.c - nc) > 1) moveTo(nr, nc + Bn.dir * 4); else moveTo(nr, nc);
        } else if (X.phase === 'open' && ready('foxyFlash')) target = [7, -7];
        else if (fredIdx >= 0) { const [r, c] = FREDDLE_SPOTS[fredIdx]; target = [r, c + 1.5]; }
        else if (moonUntil > G.t) target = [8, 18];
        if (target) moveTo(...target);
        placeAim();
        flashKey = !chasing && target != null && down;

        // ----- one action at a time, most urgent first -----
        if (G.t >= busy && !G.powerOut) {
          const nose = Bn.active && Math.abs(m.c - (Bn.x + 2)) <= 0.7 && Math.abs(m.r - (Bn.y + 1)) <= 0.7;
          if (maskNeed && !G.mask && ready('mask')) act(G.cam ? toggleCam : toggleMask);
          else if (ready('shutL') && shutNeed('L') && !G.doors.L) act(() => toggleDoor('L'));
          else if (ready('shutR') && shutNeed('R') && !G.doors.R) act(() => toggleDoor('R'));
          else if (chasing && nose) act(boopBonnet);
          else if (ready('unmask') && G.mask && !maskNeed) act(toggleMask);
          else if (ready('stall') && S.stalled && G.doors[S.side]) act(() => toggleDoor(S.side));
          else if (ready('foxyOpen') && X.phase === 'ready' && G.doors.L) act(() => toggleDoor('L'));
          else if (G.cam && (!boxLow || ready('beep') || G.pch.active || Bn.active)) act(toggleCam);   // look back at the office
          else if (ready('chica') && G.pch.active && down && !G.mask) {
            // Searching for the next cupcake takes a while; then click it.
            if (cupFoundAt == null) cupFoundAt = G.t + find * (0.7 + Math.random() * 0.7);
            if (G.t >= cupFoundAt) { act(() => clickCupcake(0)); cupFoundAt = null; }
          }
          else if (ready('box') && boxLow && !G.mask && !maskNeed && !chasing) act(onCam('prize') ? windBox : () => setCam('prize'));
          else if (ready('fanOn') && fanNeed && !G.fan) act(toggleFan);
          else if (ready('openL') && G.doors.L && !shutNeed('L') && !keepShut('L') && !S.stalled) act(() => toggleDoor('L'));
          else if (ready('openR') && G.doors.R && !shutNeed('R') && !S.stalled) act(() => toggleDoor('R'));
          else if (ready('fanOff') && G.fan) act(toggleFan);
        }
        if (!G.pch.active) cupFoundAt = null;
        update(DT);
      }
      result.power = Math.round(G.power);
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