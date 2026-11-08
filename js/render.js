/* =====================================================================
   render.js: DRAWS the night onto the screen.

   These functions only read the game state (G) and update the page;
   they never change the rules. main.js calls renderGame() about 15
   times a second, and right away whenever `dirty` is true.
   ===================================================================== */

// Put new HTML into a page element, but only if it's different from what's already there.
// Turning HTML into page elements is the slowest part of drawing, and most redraws change nothing,
// so this skips them. `el.lastHtml` remembers what we put in last time.
function setHtml(el, html) {
  if (el.lastHtml === html) return;
  el.lastHtml = html;
  el.innerHTML = html;
}

// A bar like [|||||.....] that is `filled` out of `total` long.
const bar = (filled, total) => '[' + '|'.repeat(filled) + '.'.repeat(total - filled) + ']';

// Draw everything on the game screen: HUD, then either the office or the monitor, then the buttons.
function renderGame(now) {
  // ----- HUD: clock, power, usage, heat -----
  $('clock').textContent = hourLabel(hourOf(G.t));
  const p = Math.max(0, Math.ceil(G.power));
  const pw = $('pw');
  pw.textContent = G.powerOut ? 'OUT' : p + '%';
  pw.classList.toggle('low', p <= 20);          // classList.toggle(name, yes/no) adds or removes a CSS class
  $('pwbar').textContent = bar(Math.ceil(p / 10), 10);
  const units = powerUnits();                   // 0 to 6 things using power
  const most = 5 + (G.tbo.level > 0 || G.tch.level > 0 || G.ned.level > 0);   // the heater only counts on duct nights
  $('usage').textContent = '▮'.repeat(units) + '▯'.repeat(Math.max(0, most - units));
  $('usage').classList.toggle('low', units >= 3);
  // The office heat (it rises every night; the fan cools it down).
  const heat = Math.floor(G.heat);
  $('heat').textContent = heat + '%';
  $('heat').classList.toggle('low', heat >= 60);
  $('coins').textContent = G.coins;
  // Toxic Springtrap's toxin meter, only while his fumes are in.
  $('toxinMeter').hidden = !G.tsp.active;
  $('toxin').textContent = Math.floor(G.tsp.toxin) + '%';

  // ----- the view: office or monitor -----
  const office = $('office'), cams = $('cams');
  office.hidden = G.cam;
  cams.hidden = !G.cam;
  $('maskView').hidden = !G.mask || G.cam;   // the mask covers the office view, leaving two eye holes
  if (G.cam) renderMonitor(now);
  else renderOffice(now);

  // The flashlight: a soft circle of light around the pointer (its position comes from input.js).
  // On the cameras it only works in Shadow Bonnie's darkness.
  const beam = $('beam');
  beam.hidden = !flashLit();
  beam.style.setProperty('--x', aim.x + 'px');
  beam.style.setProperty('--y', aim.y + 'px');
  // Shadow Bonnie's darkness, with a hole where the flashlight shines.
  const dark = $('darkShade');
  dark.hidden = !G.sbn.dark || G.powerOut;
  dark.style.setProperty('--x', aim.x + 'px');
  dark.style.setProperty('--y', aim.y + 'px');
  dark.style.setProperty('--r', flashLit() ? '110px' : '0px');
  // Toxic Springtrap's purple fumes: thicker as the meter fills (but never quite hiding everything).
  $('toxicShade').style.opacity = G.tsp.active ? (0.15 + G.tsp.toxin / 100 * 0.55).toFixed(3) : '0';
  // A short message (Dee Dee, White Tiger, the death coin...), while it lasts.
  $('note').hidden = now >= G.noteUntil;
  $('note').textContent = G.note;
  // Lolbit's LOL screen: covers the view (and blocks clicks under it) until L, O, L is typed. Each letter
  // already typed is lit up ("done").
  const L = G.lol;
  $('lolbit').hidden = !L.active;
  if (L.active) {
    setHtml($('lolFace'), SPRITES.lol.face.map(escText).join('\n'));
    document.querySelectorAll('#lolKeys button').forEach((b, i) => b.classList.toggle('done', i < L.typed));
  }
  // Chica's Magic Rainbow, chasing the pointer. Her position is in view widths from the view's top left.
  const rb = $('rainbow');
  rb.hidden = !G.rbw.active;
  if (G.rbw.active) {
    const box = $('viewport').getBoundingClientRect();
    rb.style.left = (box.left + G.rbw.x * box.width) + 'px';
    rb.style.top = (box.top + G.rbw.y * box.width) + 'px';
    setHtml(rb, SPRITES.rbw.chase.map(escText).join('\n'));
  }
  // Sleepy Moon: the view gets darker as the sleep meter fills (opacity 0 is see-through, 1 is black).
  // It darkens the monitor too, but never all the way (0.85 at most), so you can still find him.
  $('sleepShade').style.opacity = (G.mon.sleep / 100 * 0.85).toFixed(3);
  // The heat: a red-hot glow that only starts at the first warning (HOT_WARN[0], 70%) and is at full
  // strength by GLOW_FULL (90%), so the last stretch before passing out is solid red (both on request).
  // Math.max(0, ...) keeps it at 0 below 70%; Math.min(1, ...) stops it growing past full.
  const GLOW_FULL = 90;
  const glow = Math.min(1, Math.max(0, (G.heat - HOT_WARN[0]) / (GLOW_FULL - HOT_WARN[0])));
  $('heatGlow').style.opacity = (glow * 0.6).toFixed(3);
  // Phantom Chica's jumpscare (when you didn't find her cupcakes in time), Phantom Foxy's (when he
  // breaks the monitor) or White Tiger's (when he breaks something). Each is over in a second.
  const mini = now < G.pch.scareUntil ? 'pch' : now < (G.foxyUntil || 0) ? 'pfx' : now < (G.tigerUntil || 0) ? 'wti' : null;
  $('miniScare').hidden = !mini;
  if (mini) {
    const big = SPRITES[mini].scare, g = blank(Math.max(...big.map(l => l.length)), big.length);
    sprite(g, 0, 0, big, 'c-' + mini);
    setHtml($('miniScareArt'), toHtml(g));
  }

  // ----- buttons -----
  const off = !powered();
  for (const [side, btn, label] of [['L', 'btnL', 'stL'], ['R', 'btnR', 'stR']]) {
    $(btn).classList.toggle('on', G.doors[side]);
    $(btn).setAttribute('aria-pressed', String(G.doors[side]));
    $(btn).disabled = off;
    // Withered Foxy's routine, spelled out on the Left door button: after his stomp it blinks OPEN IT,
    // and once the door is open it blinks FLASH HIM! (cues on request).
    const foxyCue = side !== 'L' || off || G.wfx.level === 0 ? ''
      : G.wfx.phase === 'ready' && G.doors.L ? 'OPEN IT'
      : G.wfx.phase === 'open' && !G.doors.L ? 'FLASH HIM!' : '';
    $(label).textContent = off ? 'NO POWER' : broken(side) ? 'BROKEN' : foxyCue || (G.doors[side] ? 'CLOSED' : 'OPEN');
    $(label).classList.toggle('alert', !!foxyCue);
    $(btn).classList.toggle('broken', broken(side));
  }
  $('btnCam').classList.toggle('on', G.cam);
  $('btnCam').setAttribute('aria-pressed', String(G.cam));
  $('btnCam').disabled = off;
  $('btnCam').classList.toggle('broken', broken('cam'));
  // When the music box runs low, a ♪! warning shows on the Camera button (and on CAM 7's map button).
  const boxLow = G.pup.level > 0 && !G.pup.out && G.pup.wind < BOX_LOW;
  $('stCam').textContent = off ? 'NO POWER' : broken('cam') ? 'BROKEN' : G.mask ? 'MASK ON' : G.cam ? 'UP' : 'DOWN';
  $('camWarn').hidden = !boxLow || off;
  $('camWarnMap').hidden = !boxLow || off;
  // Piranha Plushtrap getting hungry: a warning on CAM 3's map button.
  $('pirWarnMap').hidden = !(G.pir.level > 0 && G.pir.food < PIR_LOW) || off;
  $('btnFlash').classList.toggle('on', flashLit());
  $('btnFlash').disabled = off;
  $('btnFlash').classList.toggle('broken', broken('flash'));
  $('stFlash').textContent = off ? 'NO POWER' : broken('flash') ? 'BROKEN' : flashLit() ? 'ON' : G.cam && !G.sbn.dark ? 'CAM UP' : 'HOLD';
  $('btnMask').classList.toggle('on', G.mask);
  $('btnMask').setAttribute('aria-pressed', String(G.mask));
  $('btnMask').classList.toggle('broken', broken('mask'));
  $('stMask').textContent = broken('mask') ? 'BROKEN' : G.mask ? 'ON' : G.cam ? 'CAM UP' : 'OFF';
  $('btnFan').classList.toggle('on', G.fan);
  $('btnFan').setAttribute('aria-pressed', String(G.fan));
  $('btnFan').disabled = off;
  $('btnFan').classList.toggle('broken', broken('fan'));
  $('stFan').textContent = off ? 'NO POWER' : broken('fan') ? 'BROKEN' : G.fan ? 'ON' : 'OFF';
  // The heater only shows on nights with duct crawlers.
  $('btnHeater').hidden = !tabsOn().includes('ducts');
  $('btnHeater').classList.toggle('on', G.heater);
  $('btnHeater').setAttribute('aria-pressed', String(G.heater));
  $('btnHeater').disabled = off;
  $('btnHeater').classList.toggle('broken', broken('heater'));
  $('stHeater').textContent = off ? 'NO POWER' : broken('heater') ? 'BROKEN' : G.heater ? 'ON' : 'OFF';
}

// ---------- the office ----------
function renderOffice(now) {
  $('office').classList.toggle('dark', G.powerOut);
  for (const side of ['L', 'R']) {
    setHtml($('door' + side), toHtml(doorGrid(side, now)));
    $('door' + side).classList.toggle('lit', beamOnDoor(side));   // style.css makes a lit doorway glow
  }
  const g = officeGrid(now);
  if (!G.powerOut) drawVisitors(g, now);
  setHtml($('officeArt'), toHtml(g));
}

// Everyone who can be in the office, drawn on top of it (the later ones on top of the earlier ones).
function drawVisitors(g, now) {
  // The Nightmare staff bot's caution cone sits on the desk. While it blinks, its eyes flash and an
  // arrow above it points at the door to shut. The cone and arrow are caution orange (c-caution, on
  // request), while the staff bot himself is black and white.
  const S = G.stf;
  if (S.level > 0) {
    const blinkOn = S.active && Math.floor(now / 250) % 2 === 0;
    const lines = SPRITES.stf.office.slice();
    if (S.active) lines[1] = blinkOn ? '[* *]' : '[o o]';
    sprite(g, ...STAFF_SPOT, lines, 'c-caution' + (blinkOn ? ' blink' : ''));
    if (S.active) write(g, STAFF_SPOT[0] - 1, S.side === 'L' ? 0 : 5, S.side === 'L' ? '<<<' : '>>>', 'c-caution blink');
  }
  // Freddles on the desk. "frd" marks them so the light can be seen on them (style.css).
  G.nfr.freddles.forEach((here, i) => {
    if (here) write(g, ...FREDDLE_SPOTS[i], SPRITES.nfr.freddle, 'c-nfr' + (G.nfr.shine[i] > 0 ? ' shone' : ''));
  });
  // Nightmare Chica peering in while her cupcake is hidden on a camera (on request: a reminder to go
  // and look). Drawn early, so anyone who turns up in the middle of the office is in front of her.
  if (G.nch.room) sprite(g, ...NCHICA_SPOT, SPRITES.nch.office, 'c-nch');
  // The Puppet, out of the box, flickering on your monitor's screen.
  if (G.pup.out && Math.floor(now / 140) % 4 !== 0) write(g, SCREEN_SPOT[0], SCREEN_SPOT[1], SPRITES.pup.peek[0], 'c-pup');
  if (G.gol.present) sprite(g, ...GOLDEN_SPOT, SPRITES.gol.office, 'c-gol');
  if (G.wbn.present) sprite(g, ...WITHERED_SPOT, SPRITES.wbn.office, 'c-wbn');
  if (G.nfr.present) sprite(g, ...NIGHTMARE_SPOT, SPRITES.nfr.office, 'c-nfr');
  // The endo's flames licking up from the bottom of the office while he's here.
  if (G.end.present) {
    const flames = '^)(^^ (^)^ ^(^) )^( ^^)(^ ^(^ )^^(^ )';
    const shift = Math.floor(now / 90) % 6;
    write(g, 15, 0, (flames + flames).slice(shift, shift + 36), 'c-fire');
  }
  // Bonnet running along the floor. Her nose ("bnt-nose") is what you click (see input.js).
  const N = G.bnt;
  if (N.active) {
    const r = Math.round(N.y), c = Math.round(N.x);
    sprite(g, r, c, SPRITES.bnt.office, 'c-bnt');
    if (g[r + 1] && g[r + 1][c + 2]) g[r + 1][c + 2] = { ch: '*', cls: 'c-bnt bnt-nose' };
  }
  // Nightmare Foxy, inside and never leaving: bigger the closer he's crept (NFOXY_STAGES in art.js).
  if (G.nfx.inside) {
    const S = NFOXY_STAGES[Math.min(3, G.nfx.stage)];
    sprite(g, ...S.at, S.lines, 'c-nfx' + (G.nfx.pushT > 0 ? ' stunned' : ''));
  }
  // Plushtrap hiding somewhere in the office.
  if (G.plu.spot) sprite(g, ...G.plu.spot, SPRITES.plu.office, 'c-plu');
  // Phantom Chica's shadow cupcakes. "cup cup-2" says which one, for clicking (input.js).
  if (G.pch.active) G.pch.cups.forEach(([r, c], i) => write(g, r, c, '{^}', `cup cup-${i}`));
  // Sleepy Moon: once you're getting drowsy, Zs float near the top.
  if (G.mon.sleep >= 50) write(g, 0, 30, Math.floor(now / 600) % 2 ? 'z Z z' : 'Z z Z', 'c-mon');
  // Whoever has reached the front of the ducts peeks out of the vent (their face from ICONS).
  const atVent = DUCT_CRAWLERS.find(c => G[c.id].level > 0 && G[c.id].room === DUCT_FRONT);
  if (atVent) write(g, VENT_SPOT[0], VENT_SPOT[1], ICONS[atVent.id][1].padEnd(6).slice(0, 6), `c-${atVent.id} blink`);
  // Funtime Foxy's SHOWTIME countdown (on request: no other warning). Red for the last 5 seconds.
  if (G.ffx.level > 0) {
    const s = Math.max(0, Math.ceil(G.ffx.timer));
    write(g, ...SHOWTIME_SPOT, `SHOWTIME ${String(s).padStart(2)}`, s <= 5 ? 'c-ffx alert' : 'c-ffx');
  }
}

// One door of the office as a grid: 12 wide (10 inside the frame) and 16 tall.
// Shut: a steel shutter. Open: a dark doorway with a dotted floor, plus whoever is standing there.
function doorGrid(side, now) {
  const W = 10, H = 14;
  const shut = G.doors[side];
  const lines = ['+' + '-'.repeat(W) + '+'];
  for (let r = 0; r < H; r++) {
    let inner;
    if (shut) inner = r % 3 === 2 ? '-'.repeat(W) : '='.repeat(W);   // % is "remainder": every 3rd row
    else if (r === H - 1) inner = ' , , , , ,';
    else inner = ' '.repeat(W);
    lines.push('|' + inner + '|');
  }
  lines.push('+' + '='.repeat(W) + '+');
  const g = grid(lines, W + 2);
  for (let r = 1; r <= H; r++) for (let c = 1; c <= W; c++) g[r][c].cls = shut ? 'door' : 'dim';
  if (shut || G.powerOut) return g;
  // The running foxes are seen RUSHING in the doorway (on request): their drawing jumps a column left and
  // right every 80 ms while the run lasts.
  const rush = 1 + Math.floor(now / 80) % 2;
  // Foxy running at the left door.
  if (side === 'L' && classicFoxyInDoorway()) sprite(g, 4, rush, SPRITES.fox.door, 'c-fox');
  // Phantom Foxy rushing at this door; he goes pale while the light works on him.
  const P = G.pfx;
  if (P.active && P.side === side) sprite(g, 4, rush, SPRITES.pfx.door, 'c-pfx' + (P.flashT > 0 ? ' stunned' : ''));
  // Bonnie in this doorway.
  if (G.bon.level > 0 && bonnieAtDoor() && bonnieSide() === side) sprite(g, 4, 1, SPRITES.bon.door, 'c-bon');
  // Withered Foxy in the left doorway. While the light is working on him (after his stomp) he goes
  // pale ("stunned"), so you can see the flashing is doing something.
  if (side === 'L' && G.wfx.level > 0 && foxyInDoorway()) {
    const fading = G.wfx.phase === 'open' && G.wfx.flashT > 0;
    sprite(g, 4, G.wfx.phase === 'run' ? rush : 1, SPRITES.wfx.door, 'c-wfx' + (fading ? ' stunned' : ''));
  }
  // BonBon, off Funtime Freddy's hand and waiting at the other door: only seen in the flashlight.
  const F = G.fun;
  if (F.active && !F.bonbon && side === otherSide(F.side) && beamOnDoor(side)) sprite(g, 6, 2, SPRITES.fun.door, 'c-bb');
  return g;
}

// ---------- the monitor ----------
// The tab bar (DUCTS only on duct nights), then whichever tab is picked.
function renderMonitor(now) {
  const tabs = tabsOn();
  for (const b of document.querySelectorAll('#tabs button')) {
    b.hidden = !tabs.includes(b.dataset.tab);
    b.setAttribute('aria-current', String(b.dataset.tab === G.tab));
  }
  $('camPane').hidden = G.tab !== 'cams';
  $('ductPane').hidden = G.tab !== 'ducts';
  $('shopPane').hidden = G.tab !== 'shop';
  if (G.tab === 'ducts') renderDucts();
  else if (G.tab === 'shop') renderShop();
  else renderFeed(now);
}

// The DUCTS tab: the map (ductGrid in art.js) and whether the lure is ready.
function renderDucts() {
  setHtml($('ductMap'), toHtml(ductGrid()));
  const wait = G.lureReadyAt - G.t;
  $('lureState').textContent = wait > 0 ? `LURE IN ${Math.ceil(wait)}s` : 'LURE READY';
}

// The SHOP tab: the shopkeeper and what's for sale. Each button carries data-buy="..." (input.js).
// While a death coin is being used, a list of everyone on tonight to pick from (data-kill="id").
function renderShop() {
  setHtml($('shopkeeper'), SHOPKEEPER.map(escText).join('\n'));
  const S = G.shop, c = G.coins;
  const item = (buy, label, price, ok) =>
    `<button type="button" data-buy="${buy}"${ok ? '' : ' disabled'}><span>${label}</span><span class="price">${price}</span></button>`;
  let html = `<p class="coins">YOU HAVE <b class="coin">${c}</b> FAZCOIN${c === 1 ? '' : 'S'}</p>`;
  if (G.fch.level > 0) html += `<p class="coins c-fch">Funtime Chica raised the prices!</p>`;
  html += item('battery', `Battery pack: +${BATTERY_POWER}% power (${S.batteries} left)`, `${batteryPrice()} $`,
    S.batteries > 0 && c >= batteryPrice() && G.power < 100);
  if (G.rsb.level > 0) {
    html += S.guitar ? `<p class="coins c-rsb">Rockstar Bonnie has his guitar back.</p>`
      : item('guitar', `Rockstar Bonnie's guitar`, `${guitarPrice()} $`, c >= guitarPrice());
  }
  html += item('death', S.picking ? 'Death coin: pick who goes (click again to cancel)' : `Death coin: remove anyone tonight (${S.deathLeft} left)`,
    `${deathPrice()} $`, S.picking || (S.deathLeft > 0 && c >= deathPrice()));
  if (S.picking) {
    html += '<div class="who-list">' + deathTargets().map(t =>
      `<button type="button" data-kill="${t.id}" class="c-${t.id}">${escText(t.name)}</button>`).join('') + '</div>';
  }
  setHtml($('shopItems'), html);
}

// The camera screen: the room picture (or static), whoever is in it, the music box and its wind
// bar (on CAM 7), and which map button is highlighted.
function renderFeed(now) {
  const room = G.camRoom;
  $('feedName').textContent = `CAM ${ROOMS[room].cam} · ${ROOMS[room].name}`;
  let g;
  if (now < G.staticUntil) {
    // Static: random characters.
    const chars = ' .:;*#%';
    g = Array.from({ length: 11 }, () =>
      Array.from({ length: 40 }, () => ({ ch: chars[Math.floor(Math.random() * chars.length)], cls: 'dim' })));
  } else {
    g = grid(frame(ROOM_ART[room], 38), 40);
    // The Mop bucket in its hall (drawn first, so anyone walking past is in front of it).
    if (G.mop.level > 0 && G.mop.room === room) sprite(g, ...MOP_SPOTS[room], SPRITES.mop.cam, 'c-mop');
    // Piranha Plushtrap's tank on CAM 3, with a sea bonnie to feed him ("pir-hit": click it). When he's
    // hungry the tank says so, blinking.
    const PR = G.pir;
    if (room === 'back' && PR.level > 0) {
      const [r, c] = TANK_SPOT;
      sprite(g, r, c, SPRITES.pir.tank, 'c-pir');
      if (PR.food < PIR_LOW) write(g, r + 3, c + 1, 'HUNGRY!', 'c-pir blink');
      write(g, r + 1, c + 6, '}o)>', 'sea pir-hit');
    }
    const B = G.bon;
    if (B.level > 0 && !bonnieAtDoor() && B.route[B.step] === room) sprite(g, ...BONNIE_SLOTS[room], SPRITES.bon.cam, 'c-bon');
    // Foxy: peeking out of Pirate Cove, half out, gone, or running down the West Hall.
    const FX = G.fox;
    if (room === 'cove' && FX.level > 0) {
      if (FX.phase !== 'cove') write(g, 6, 13, '    (empty)     ', 'dim');
      else if (FX.stage === 1) sprite(g, 5, 18, SPRITES.fox.peek, 'c-fox');
      else if (FX.stage === 2) sprite(g, 4, 16, SPRITES.fox.half, 'c-fox');
    }
    // (Each fox is in the hall for the first FOXY_RUN seconds of his run; after that he's at your door.)
    const inHall = X => X.phase === 'run' && X.runTotal - X.runT < FOXY_RUN;
    if (room === 'whall' && inHall(FX)) sprite(g, 5, 8 + Math.floor((FX.runTotal - FX.runT) * 6), SPRITES.fox.run, 'c-fox');
    // Withered Foxy running down the West Hall (he turns up there now, see updateFoxy).
    const X = G.wfx;
    if (room === 'whall' && inHall(X)) sprite(g, 2, 8 + Math.floor((X.runTotal - X.runT) * 6), SPRITES.wfx.run, 'c-wfx');
    // Twisted Foxy digging up out of the floor on CAM 7 ("twf-hit": click him).
    if (room === 'prize' && G.twf.active) sprite(g, ...G.twf.spot, SPRITES.twf.cam, 'c-twf twf-hit');
    // A Fazcoin lying here ("coin-hit": click it to pick it up).
    const coin = G.camCoins.find(c => c.room === room);
    if (coin) write(g, coin.r, coin.c, '($)', 'coin coin-hit');
    // The Puppet's box on CAM 7: closed, or open with the Puppet looking out.
    if (room === 'prize' && G.pup.level > 0) {
      if (G.pup.out) write(g, 7, 17, SPRITES.pup.peek[0], 'c-pup');
      else if (G.pup.wind < BOX_LOW) write(g, 7, 18, '(_LOW!_)', 'c-pup blink');
      else write(g, 7, 18, '(______)', 'dim');
    }
    // Sleepy Moon, if he's turned up in this room. "mon-hit" is what input.js listens for when you
    // click him.
    if (G.mon.room === room) sprite(g, ...MOON_SLOTS[room], SPRITES.mon.cam, 'c-mon mon-hit');
    // Nightmare Foxy on his way (silent: this is the only place you can see him coming).
    const NX = G.nfx;
    if (NX.level > 0 && !NX.inside && NX.route[NX.step] === room) sprite(g, ...NFOXY_SLOTS[room], SPRITES.nfx.cam, 'c-nfx');
    // Funtime Freddy in his hall, with BonBon on his hand or without her.
    const F = G.fun;
    if (F.active && room === (F.side === 'L' ? 'whall' : 'ehall')) {
      const [r, c] = FUN_SLOTS[room];
      sprite(g, r, c, SPRITES.fun.cam, 'c-fun');
      if (F.bonbon) sprite(g, r, c + 5, SPRITES.fun.bonbon, 'c-bb');
    }
    // Chica on her walk. "chi-hit" is what input.js listens for when you click her.
    if (G.chi.level > 0 && chicaRoom() === room) sprite(g, ...CHICA_SLOTS[room], SPRITES.chi.cam, 'c-chi chi-hit');
    // Nightmare Chica's cupcake, hidden in the picture: small and dim ("nch-hit" for clicking).
    if (G.nch.room === room) write(g, ...G.nch.spot, SPRITES.nch.cupcake, 'nch-cup nch-hit');
    // Security's face, flickering in the corner of the camera he just switched you to.
    if (now < G.sec.faceUntil && Math.floor(now / 120) % 2 === 0) sprite(g, ...SEC_SPOT, SPRITES.sec.cam, 'c-sec');
  }
  setHtml($('feed'), toHtml(g));
  // Piranha Plushtrap's food meter, under the picture on CAM 3.
  const onTank = room === 'back' && G.pir.level > 0;
  $('food').hidden = !onTank;
  if (onTank) {
    const f = Math.round(G.pir.food);
    $('foodBar').textContent = 'FOOD ' + bar(Math.round(f / 5), 20) + ' ' + String(f).padStart(3) + '%';
    $('foodBar').classList.toggle('low', f < PIR_LOW);
  }

  // The wind bar and button only appear on CAM 7, on nights with the Puppet.
  const onBox = room === 'prize' && G.pup.level > 0;
  $('wind').hidden = !onBox;
  if (onBox) {
    const w = Math.round(G.pup.wind);
    $('windBar').textContent = bar(Math.round(w / 5), 20) + ' ' + String(w).padStart(3) + '%';
    $('windBar').classList.toggle('low', w < BOX_LOW);
  }
  for (const b of document.querySelectorAll('#map button')) b.setAttribute('aria-current', String(b.dataset.room === room));
}
