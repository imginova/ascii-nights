/* =====================================================================
   data.js: the WORLD. Rooms, cameras, the characters and the
   ready-made challenges. Only descriptions here, no rules: game.js
   reads these to know where things are and what they're called.
   ===================================================================== */

// ---------- rooms and cameras ----------
// Each room has its camera number and the name shown on the feed.
const ROOMS = {
  stage:  { cam: 1, name: 'SHOW STAGE' },
  dining: { cam: 2, name: 'DINING AREA' },
  back:   { cam: 3, name: 'BACKSTAGE' },
  cove:   { cam: 4, name: 'PIRATE COVE' },
  whall:  { cam: 5, name: 'WEST HALL' },
  ehall:  { cam: 6, name: 'EAST HALL' },
  prize:  { cam: 7, name: 'PRIZE CORNER' },
};
// Which room each number key (1 to 7) opens.
const CAM_ORDER = ['stage', 'dining', 'back', 'cove', 'whall', 'ehall', 'prize'];

// ---------- the characters ----------
// Every character has:
//   id    a short code used everywhere in the code (for its color --c-fre in style.css, and its face in ICONS in art.js)
//   name  its full name
//   where where it gets you, shown on the custom night screen
//   desc  how it works, in one or two sentences
//   how   what the game over screen says when it gets you in your office
// They're written below in the order their mechanics were made; the order of the setup rows (game
// order) is SETUP, further down.
const FREDDY = {
  id: 'fre', name: 'Freddy', where: 'RIGHT DOOR',
  desc: 'Laughs every time he moves, but never shows up on the cameras. Shut the right door on the third laugh.',
};
const BONNIE = {
  id: 'bon', name: 'Bonnie', where: 'EITHER DOOR',
  desc: 'Walks from the stage to either door; you can follow him on the cameras. Shut the door and he goes straight back to the stage.',
  // His two ways to your office. The last step is the door he ends up at: 'L' or 'R'.
  routes: [
    ['stage', 'dining', 'back', 'whall', 'L'],
    ['stage', 'dining', 'ehall', 'R'],
  ],
};
const GOLDEN = {
  id: 'gol', name: 'Golden Freddy', where: 'OFFICE',
  desc: 'Can be sitting in your office when you flip the monitor down. Quickly put the mask on; a tap will do.',
  how: 'was sitting in your office',
};
const PCHICA = {
  id: 'pch', name: 'Phantom Chica', where: 'OFFICE',
  desc: 'Can appear when you flip the monitor down. Find and click 1 to 3 shadow cupcakes (more at higher levels) or she jumpscares you and breaks both doors: they fly open and won\'t shut for 5 seconds.',
};
const BONNET = {
  id: 'bnt', name: 'Bonnet', where: 'OFFICE',
  desc: 'Small and fast: runs across your office. Boop her nose before she gets to the other side. She dodges your mouse, but you are quicker.',
  how: 'made it across your office',
};
const WBONNIE = {
  id: 'wbn', name: 'Withered Bonnie', where: 'OFFICE',
  desc: 'Turns up on a timer. The monitor doesn\'t stop the timer, but he only appears once you flip it down. Wear the mask for 2 seconds.',
  how: 'got you in your office',
};
const PUPPET = {
  id: 'pup', name: 'The Puppet', where: 'CAM 7',
  desc: 'Waits in the music box on CAM 7. One tap of Wind winds it all the way up. When it gets low, a ♪! shows on the Camera button and on CAM 7.',
};
const STAFF = {
  id: 'stf', name: 'Nightmare staff bot', where: 'EITHER DOOR',
  desc: 'Sits in your office. When it blinks, shut the door its arrow points to. With that door already shut, it waits until you open it.',
};
const NFREDDY = {
  id: 'nfr', name: 'Nightmare Freddy', where: 'OFFICE',
  desc: 'Freddles pile up on your desk; shine the flashlight on them to send them off. If all 3 stay too long he comes and never leaves: keep the mask on for the rest of the night.',
  how: 'came for his Freddles',
};
const WFOXY = {
  id: 'wfx', name: 'Withered Foxy', where: 'LEFT DOOR',
  desc: 'Turns up in the West hall now and then and charges the left door. Shut it before the running stops, wait for the stomp, then open it and flash him until he leaves.',
};
const MOON = {
  id: 'mon', name: 'Sleepy Moon', where: 'CAMERAS',
  desc: 'Turns up on a random camera and you start to drift off. Find him on the cams and click him to wake up. If he\'s on, he\'s who comes when the power goes out.',
  how: 'put you to sleep',
};
const ENDO = {
  id: 'end', name: 'Flamethrower endo', where: 'OFFICE',
  desc: 'Heats up your office fast. While he\'s there the fan can\'t cool it, only slow the heat down until he leaves. At 100% heat it\'s over.',
  how: 'cooked your office',
};
// The second batch of characters (added 2026-11-03, the owner's designs).
const NFOXY = {
  id: 'nfx', name: 'Nightmare Foxy', where: 'EITHER DOOR',
  desc: 'Silent: only the cameras show him heading down a hall. Shut that door in time. If he gets in he never leaves, and creeps closer: keep pushing him back with the flashlight.',
  how: 'got all the way to you',
  // His two ways in. The last step is the door; after that he's inside.
  routes: [['dining', 'whall', 'L'], ['dining', 'ehall', 'R']],
};
const FUNFRED = {
  id: 'fun', name: 'Funtime Freddy', where: 'EITHER DOOR',
  desc: 'Makes a sound, then waits in a hall. Look on the cameras: BonBon on his hand means shut his door; no BonBon means she\'s at the other door, so shine the light there.',
};
const CHICA = {
  id: 'chi', name: 'Chica', where: 'WEST HALL',
  desc: 'Walks slowly and silently from Backstage to the West hall; her next move from there gets you. Check on her: clicking her on her camera sends her back one room.',
  how: 'got you from the West hall',
  // Her walk (on request it ends in the West hall: from there, her next move gets you).
  route: ['back', 'dining', 'whall'],
};
const PLUSH = {
  id: 'plu', name: 'Plushtrap', where: 'OFFICE',
  desc: 'Giggles and hides in your office. Get the flashlight on him quickly; any light at all sends him away.',
  how: 'jumped out at you',
};
const NCHICA = {
  id: 'nch', name: 'Nightmare Chica', where: 'CAMERAS',
  desc: 'Makes a strange noise, then hides her cupcake on one of the cameras. Find it and click it before time runs out.',
  how: 'came looking for her cupcake',
};
// The third batch (added 2026-11-07, the owner's designs).
// The three duct crawlers: `interval` is seconds between their chances to move a duct room, and `lure`
// is the chance that a move heads toward the audio lure instead of the front.
const TBONNIE = {
  id: 'tbo', name: 'Toy Bonnie', where: 'DUCTS',
  desc: 'Crawls through the ducts super fast and barely cares about the audio lure. When he reaches the front, put the mask on.',
  how: 'climbed out of the duct',
  interval: 3, lure: 0.2,
};
const TCHICA = {
  id: 'tch', name: 'Toy Chica', where: 'DUCTS',
  desc: 'Crawls through the ducts, a bit faster than Nedd Bear, but the audio lure pulls her easily. If she reaches the front, she gets you.',
  how: 'climbed out of the duct',
  interval: 5, lure: 0.85,
};
const NEDD = {
  id: 'ned', name: 'Nedd Bear', where: 'DUCTS',
  desc: 'Crawls slowly through the ducts and only sometimes follows the audio lure. If he reaches the front, he gets you.',
  how: 'climbed out of the duct',
  interval: 8, lure: 0.55,   // was 7 and 0.45; slightly slower and easier to lure (on request)
};
const TIGER = {
  id: 'wti', name: 'White Tiger', where: 'ANYTHING',
  desc: 'Use one thing (a door, the monitor, the flashlight, the fan or the mask) for too long without a break and he jumpscares you and breaks it for a bit. He doesn\'t kill.',
};
const RAINBOW = {
  id: 'rbw', name: 'Chica\'s Magic Rainbow', where: 'POINTER',
  desc: 'Appears on the office or the cameras and chases your mouse pointer, a bit slower than you. Dodge her until she gives up; if she catches the pointer, you die.',
  how: 'caught you',
};
const RSBONNIE = {
  id: 'rsb', name: 'Rockstar Bonnie', where: 'SHOP',
  desc: 'Lost his guitar: buy it back from the shop before 6 AM (the price goes up with his level), or he gets you at 5:59.',
  how: 'came for his guitar',
};
const TOXSPRING = {
  id: 'tsp', name: 'Toxic Springtrap', where: 'OFFICE',
  desc: 'Fills the office with purple toxic fumes. Turn on the fan and keep both doors open to clear the air before the toxins get you.',
  how: 'filled your lungs with fumes',
};
const DEEDEE = {
  id: 'dee', name: 'Dee Dee', where: 'START',
  desc: 'May show up at the start of the night: she takes one random character out, but everyone else gets +5 levels and coins turn up less often.',
};
const FUNFOXY = {
  id: 'ffx', name: 'Funtime Foxy', where: 'RIGHT DOOR',
  desc: 'A SHOWTIME countdown runs in your office. When it hits 0, the right door had better be shut. There is no other warning.',
};
const FOXY = {
  id: 'fox', name: 'Foxy', where: 'LEFT DOOR',
  desc: 'Gets ready in Pirate Cove (the cameras stall him), then runs at the left door: you hear him and see him rushing in the doorway. Shut it before the running stops; slamming into it knocks 5% off your power.',
};
const SHADOWB = {
  id: 'sbn', name: 'Shadow Bonnie', where: 'DARKNESS',
  desc: 'Every so often the office and the cameras go dark. Use the flashlight to see.',
};
const TFOXY = {
  id: 'twf', name: 'Twisted Foxy', where: 'CAM 7',
  desc: 'Gravelly noises: he\'s digging up out of the floor in the Prize Corner. Click him there several times before he gets out.',
  how: 'dug his way out',
};
// The fourth batch (added 2026-11-08, the owner's designs).
const PFOXY = {
  id: 'pfx', name: 'Phantom Foxy', where: 'EITHER DOOR',
  desc: 'Rushes at a door: you hear him running and see him in the doorway. A shut door won\'t stop him. Shine the flashlight on him until he fades, or he breaks the monitor for a bit.',
};
const SECURITY = {
  id: 'sec', name: 'Security', where: 'CAMERAS',
  desc: 'A robot with a camera for a head. While you watch the cameras he sometimes switches you to a different one. He doesn\'t kill.',
};
const LOLBIT = {
  id: 'lol', name: 'Lolbit', where: 'SCREEN',
  desc: 'Sometimes covers your view with a big LOL, and nothing under it can be clicked. Type L O L (or tap the letters) to get rid of it. He doesn\'t kill.',
};
const FUNCHICA = {
  id: 'fch', name: 'Funtime Chica', where: 'SHOP',
  desc: 'Raises the prices of the battery pack and the death coin, up to double at level 20. Rockstar Bonnie\'s guitar costs the same.',
};
const PIRANHA = {
  id: 'pir', name: 'Piranha Plushtrap', where: 'CAM 3',
  desc: 'Sits in a fish tank on CAM 3 and gets hungry. Click the sea bonnie in his tank to feed him (1 coin each). If he gets too hungry, he gets you.',
  how: 'leapt out of his tank',
};
const MOPBUCKET = {
  id: 'mop', name: 'Mop bucket', where: 'A HALL',
  desc: 'Sits in the West or East hall. Bonnie and Nightmare Foxy can skip that hall and go straight to the door (listen for the squeak). It doesn\'t kill.',
};

// Everything with a level on the custom night screen, in GAME ORDER (on request): grouped by the FNAF
// game each character first appeared in, oldest game first. New characters go in their game's group.
// (Levels are saved by character id, so changing this order never mixes up anyone's saved levels; see
// LEGACY_ORDER in game.js for how older saves are read.)
const SETUP = [
  FREDDY, BONNIE, CHICA, FOXY, GOLDEN,           // FNAF 1
  TBONNIE, TCHICA, WBONNIE, WFOXY, PUPPET, SHADOWB,   // FNAF 2
  PCHICA, PFOXY,                                 // FNAF 3
  NFREDDY, NFOXY, NCHICA, PLUSH,                 // FNAF 4
  RAINBOW, DEEDEE, SECURITY,                     // FNAF World (Security: the Halloween Edition joke game)
  FUNFRED, FUNFOXY, BONNET, LOLBIT,              // Sister Location
  TFOXY,                                         // The Twisted Ones
  RSBONNIE, NEDD, FUNCHICA, MOPBUCKET,           // Freddy Fazbear's Pizzeria Simulator
  ENDO, TOXSPRING, PIRANHA,                      // Special Delivery (Piranha Plushtrap is a Plushtrap skin there)
  STAFF,                                         // Security Breach
  TIGER, MOON,                                   // Secret of the Mimic (White Tiger's game is a guess)
];
// The characters who crawl through the ducts.
const DUCT_CRAWLERS = [TBONNIE, TCHICA, NEDD];
// The halls the Mop bucket can sit in, and which door each one leads to.
const MOP_ROOMS = { whall: 'L', ehall: 'R' };

// ---------- the ducts ----------
// 3 rows of 3 duct rooms, D1 (top left, where crawlers start) to D9 (bottom right, the front: the vent
// into your office). Each room joins the rooms beside, above and below it; `dist` counts the moves to
// the front plus 1, so D9 is 1 and D1 is 5.
const DUCT_ROWS = 3, DUCT_COLS = 3;
const DUCTS = {};
for (let r = 0; r < DUCT_ROWS; r++) {
  for (let c = 0; c < DUCT_COLS; c++) {
    const id = 'd' + (r * DUCT_COLS + c + 1);
    const next = [];
    if (r > 0) next.push('d' + ((r - 1) * DUCT_COLS + c + 1));
    if (r < DUCT_ROWS - 1) next.push('d' + ((r + 1) * DUCT_COLS + c + 1));
    if (c > 0) next.push('d' + (r * DUCT_COLS + c));
    if (c < DUCT_COLS - 1) next.push('d' + (r * DUCT_COLS + c + 2));
    DUCTS[id] = { r, c, next, dist: (DUCT_ROWS - 1 - r) + (DUCT_COLS - 1 - c) + 1 };
  }
}
const DUCT_START = 'd1';
const DUCT_FRONT = 'd' + DUCT_ROWS * DUCT_COLS;
const DUCT_ORDER = Object.keys(DUCTS);

// ---------- spots in the office ----------
// [row, column] places in the office picture (36 wide, 16 tall, see officeLines in art.js).
// Phantom Chica's shadow cupcakes (3 characters wide) hide in some of these. None may sit under
// something drawn after them (Funtime Foxy's SHOWTIME countdown, the face at the vent or Moon's Zs):
// [5, 20] and [5, 30] used to, so a cupcake could be invisible and her jumpscare seemed to come from
// nowhere. They moved to [5, 4] and [6, 30].
const CUPCAKE_SPOTS = [[2, 12], [5, 4], [6, 30], [8, 15], [11, 29], [11, 3], [13, 14], [14, 6], [15, 25], [13, 22]];
// The three places on the desk where Freddles sit (the left end of each 4-wide Freddle).
const FREDDLE_SPOTS = [[11, 11], [11, 17], [11, 23]];
// Where Plushtrap hides in the office (4 wide, 2 tall).
const PLUSH_SPOTS = [[1, 14], [5, 28], [12, 6], [12, 26], [13, 16], [4, 12]];

// ---------- challenges ----------
// Ready-made nights: one click sets every level. Surviving a night set up EXACTLY like one earns it a ✓.
//   v      its version. RAISE IT whenever an update makes that challenge harder (by itself, or because
//          a character in it got stronger): the ✓ is saved as "name v1", so a new version needs
//          beating again. Only raise the ones a change actually affects.
//          (Every challenge went up one version on 2026-11-03, when the office heat started rising
//          on every night: that made all of them a little harder. The ones with Sleepy Moon went up
//          once more the same day, when he was reworked to hide on the cameras.)
// lv({ fre: 10, bon: 5 }) turns a list of levels by id into the full list, with 0 for everyone else;
// everyone(10) puts every character at 10.
const lv = byId => SETUP.map(c => byId[c.id] || 0);
const everyone = level => lv(Object.fromEntries(SETUP.map(c => [c.id, level])));
// Everyone at `level`, except the ones listed: everyoneBut(9, { tbo: 12 }) is everyone at 9, Toy Bonnie at 12.
const everyoneBut = (level, byId) => lv({ ...Object.fromEntries(SETUP.map(c => [c.id, level])), ...byId });
// Everyone in a list of ids at one level: these(10, ['fre', 'bon']) is Freddy and Bonnie at 10.
const these = (level, ids) => lv(Object.fromEntries(ids.map(id => [id, level])));
// A themed group at one level and everyone else at another: themeOver(5, 20, ['gol', 'pch']) is
// Golden Freddy and Phantom Chica at 20, everyone else at 5.
const themeOver = (rest, top, ids) => everyoneBut(rest, Object.fromEntries(ids.map(id => [id, top])));
// The list is in order, easiest first. The order came from a test bot that plays with a person's
// limits (tools/bot.js: it only reacts to what a player could see or hear, with human reaction times,
// a mouse that moves at a person's speed, one action at a time). The ones it won less often come
// later, and ties are sorted by points. Warm-up stays first and All 20 stays last.
// Measured 2026-11-07 after the third batch (29 characters; UNIT_DRAIN 0.35, LEVEL_SCALE 0.5, CROWD_CALM
// 12), 10 nights each for the new and changed ones (30 for the rest), wins by an "average" player / a
// "beginner": everything before the ladder 9-10 / 9-10, except Over the rainbow (13 / 11 of 15); the bridge
// 10 / 9-10 except Bad dreams (10 / 7); then
// Everyone at 5 (9 / 3), Graveyard shift (6 / 3), Double shift (6 / 3), Sunrise is a lie (3 / 1),
// Last stand (2 / 0) and All 20 (3 / 0, and 9 of 40 for the average player).
// Every challenge must stay humanly possible like this (the top ones are for experienced players).
// The third batch (2026-11-07) reworked Withered Foxy (he now turns up in the West hall on a timer; Foxy
// took over Pirate Cove), so every challenge with him went up a version.
// White Tiger then got quicker to break things (tigerLimit, on request), so the 8 challenges with him went
// up a version too: Big cat, Behind the curtain, the ladder and All 20.
// Dee Dee's chance then started using her real level (on request: "guaranteed at 20"), so she shows up more
// often at every level, and the 7 challenges with her went up a version: Party crashers, Behind the
// curtain, Everyone at 5, Graveyard shift, Double shift, Sunrise is a lie and All 20.
// Phantom Chica's jumpscare then started breaking both doors instead of taking 10% power (on request,
// 2026-11-08). That's harder wherever someone comes to a door, so the 12 challenges with her and a door
// character went up a version; the 5 with no door character (Cupcake hunt, Snack time, Don't look away,
// Click frenzy, Sugar rush) only got easier and kept theirs.
// The fourth batch (2026-11-08) reworked Foxy and Withered Foxy's run (they get you when the running stops),
// so the 16 challenges with either of them went up a version, and the six new characters joined the ladder
// (Everyone at 5 to All 20), which went up a version too. 22 in all.
// Then the run was shortened (foxyRunTime, on request: "make the running last way less time"), so the 19 challenges
// with Foxy, Withered Foxy or Phantom Foxy and the 6 ladder ones went up a version again (25 in all).
const PRESETS = [
  // Warm-up: Withered Foxy (2) swapped for Foxy (2), who now has the Pirate Cove routine Withered Foxy had
  // here, so it plays the same as before (not harder: it stays v2 and keeps its ✓). v3: Foxy's run rework.
  { name: 'Warm-up', v: 4, levels: lv({ fre: 3, bon: 3, pup: 3, fox: 2 }) },
  { name: 'Quiet night', v: 3, levels: lv({ pup: 8, mon: 8, end: 8 }) },
  // The two "classic" challenges had no Withered Foxy, waiting for a standard Foxy: he's in now (v4).
  // Chica joined both when she was added (v3).
  { name: 'The classics', v: 6, levels: lv({ fre: 8, bon: 8, chi: 8, fox: 8, gol: 5 }) },
  { name: 'Heat wave', v: 3, levels: lv({ end: 15, stf: 8, fre: 8, tsp: 10 }) },             // v3: + Toxic Springtrap (the fan again)
  { name: 'Hot and sleepy', v: 3, levels: lv({ end: 16, mon: 16 }) },
  { name: 'Crawl space', v: 1, levels: lv({ tbo: 10, tch: 10, ned: 10, fre: 6 }) },        // new with the third batch
  { name: 'Wind it up', v: 4, levels: lv({ pup: 14, bon: 8, pch: 8, chi: 8 }) },             // v3: + Chica (whatever walks in)
  { name: 'Caution', v: 3, levels: lv({ stf: 14, bon: 10, fre: 6, fun: 8 }) },               // v3: + Funtime Freddy (read, then pick a door)
  // New with the second batch of characters (2026-11-03).
  // v2: Plushtrap out and Funtime Foxy in, now that there's another Sister Location character (on request).
  { name: 'Fun time', v: 2, levels: lv({ fun: 15, ffx: 12, bnt: 12 }) },
  { name: 'Patrol', v: 1, levels: lv({ chi: 15, nfx: 12, bon: 12 }) },
  { name: 'Cupcake hunt', v: 1, levels: lv({ nch: 15, pch: 15, chi: 10 }) },
  { name: 'Bedtime', v: 4, levels: lv({ mon: 12, nfr: 10, bnt: 10, plu: 10 }) },             // v4: + Plushtrap (FNAF 4's bedroom)
  { name: 'Music lesson', v: 5, levels: lv({ pup: 18, wfx: 12, bon: 12 }) },
  { name: 'Pirate\'s dance', v: 6, levels: lv({ wfx: 15, bon: 10, fre: 10, nfx: 12 }) },   // v3: + Nightmare Foxy
  { name: 'Shopping spree', v: 1, levels: lv({ rsb: 18, fre: 10, bon: 10, chi: 10 }) },     // new with the third batch
  { name: 'Snack time', v: 3, levels: lv({ pch: 16, bnt: 12, pup: 10, nch: 12 }) },       // v3: + Nightmare Chica
  // v3: the Puppet (5) added and Golden Freddy raised from 15 to 20 (on request).
  { name: 'Mask on', v: 3, levels: lv({ wbn: 15, gol: 20, nfr: 12, pup: 5 }) },
  { name: 'Big cat', v: 2, levels: lv({ wti: 16, stf: 12, fre: 12, end: 12 }) },           // new with the third batch
  { name: 'Bunny trouble', v: 3, levels: lv({ bon: 14, bnt: 14, wbn: 14, plu: 12 }) },    // v3: + Plushtrap
  // Plushtrap was added briefly (v2) and taken out again on request. Taking him out made it easier, so it
  // stays v2: a ✓ earned with him still counts.
  { name: 'Nightmare hour', v: 2, levels: lv({ nfx: 15, nch: 15, nfr: 12, stf: 12 }) },
  { name: 'Freddy fever', v: 3, levels: lv({ fre: 14, gol: 14, nfr: 14, fun: 14 }) },     // v3: + Funtime Freddy
  { name: 'Masquerade', v: 2, levels: lv({ gol: 16, wbn: 16, nfr: 14, bnt: 10 }) },
  // New with the third batch. v2: + Phantom Chica, Funtime Freddy and the Magic Rainbow (on request), and
  // moved here from after Bedtime: the bot then won it 11/15 (average) and 10/15 (beginner).
  { name: 'Lights out', v: 3, levels: lv({ sbn: 15, nfr: 10, plu: 10, bnt: 8, pch: 10, fun: 10, rbw: 8 }) },
  // v4: + Plushtrap. v5: + Nightmare Foxy (on request; the flashlight is what holds him back).
  // v6: + Shadow Bonnie (more need for the flashlight).
  { name: 'Night light', v: 8, levels: lv({ mon: 14, nfr: 12, wfx: 10, plu: 12, nfx: 12, sbn: 10 }) },
  // New with the third batch. v2: + Freddy, Foxy and Nightmare Foxy at 10 (on request: "a few more"). Door
  // characters, because clearing the toxins needs both doors open. Moved here from after Shopping spree:
  // the bot then won it 17/20 (average and beginner), losing only to Toxic Springtrap.
  { name: 'Toxic shock', v: 4, levels: lv({ tsp: 16, end: 12, stf: 10, bon: 10, fre: 10, fox: 10, nfx: 10 }) },
  // v2: Phantom Chica added (on request: she took power then, so she belonged here; since v7 she breaks
  // the doors instead).
  // v3: the office heat (like every challenge). v4: Sleepy Moon's rework (like every challenge he's in).
  // v5: Withered Foxy's rework. v6: + Foxy, Funtime Foxy and White Tiger at 12 (on request): Foxy's slam
  // costs power, Funtime Foxy needs a door at the right moment, and White Tiger punishes leaving things on.
  // Then (on request, 2026-11-09: "update power hungry"): Phantom Chica out (she breaks the doors now, she
  // doesn't take power), and in at 12 the newer characters who cost power: Toxic Springtrap (the fan),
  // Nedd Bear (the heater for the ducts), Phantom Foxy (the flashlight) and Funtime Chica (dearer batteries).
  // Not harder for the bot (20 / 20 of 20; beginners 15 / 15 with about 42% power left, against 12 / 15 and
  // 47% before, mostly lost to Phantom Chica), so it kept v9 and its ✓.
  { name: 'Power hungry', v: 9, levels: lv({ end: 14, mon: 14, stf: 14, wfx: 14, fox: 12, ffx: 12, wti: 12, tsp: 12, ned: 12, pfx: 12, fch: 12 }) },
  // v3: the Puppet and Sleepy Moon added (on request): they make you use the monitor, and every time you
  // look away from it the other three can be waiting.
  // v4: + Nightmare Chica (another reason you need the monitor).
  { name: 'Don\'t look away', v: 4, levels: lv({ gol: 12, pch: 12, wbn: 12, pup: 12, mon: 12, nch: 12 }) },
  // v3: + Nightmare Foxy at 12 (on request: his counter is a door too).
  // v5: + the third batch's door characters, Foxy and Funtime Foxy (on request).
  // v6: + Funtime Freddy at 12 (on request: one of his two counters is shutting a door).
  { name: 'Door duty', v: 8, levels: lv({ fre: 16, bon: 16, stf: 16, wfx: 12, nfx: 12, fox: 12, ffx: 12, fun: 12 }) },
  // v2: + Piranha Plushtrap at 14 (on request: a Plushtrap variant, so a little terror too).
  { name: 'Little terrors', v: 2, levels: lv({ plu: 18, bnt: 18, nfr: 10, pir: 14 }) },
  // v3: + both nightmares. v4: Phantom Chica (a phantom, not a nightmare) swapped for Plushtrap, on request.
  { name: 'Nightmare crew', v: 4, levels: lv({ stf: 15, nfr: 15, plu: 15, nfx: 12, nch: 12 }) },
  // v3: Sleepy Moon added (on request). v4: + Chica (more clicking).
  { name: 'Click frenzy', v: 4, levels: lv({ pch: 18, bnt: 18, gol: 10, mon: 15, chi: 12 }) },
  { name: 'Classic 20', v: 6, levels: lv({ fre: 20, bon: 20, chi: 20, fox: 20, gol: 20 }) },   // v3: + Chica. v4: + Foxy
  // The fourth batch (on request, 2026-11-08): the phantoms (with the other two ghostly ones), and chaos on
  // the monitor. The bot won them 20 / 20 and 20 / 18 of 20 (average / beginner). Feeding time is further down.
  { name: 'Phantoms', v: 2, levels: lv({ pfx: 16, pch: 16, sbn: 14, gol: 14 }) },
  { name: 'Static', v: 1, levels: lv({ sec: 18, lol: 16, mon: 14, nch: 14 }) },
  // Four more (on request, 2026-11-08: "make a few more challenges"), placed where the bot's results say
  // (20 nights each, average / beginner). Wet floor and Screen time are further down.
  // Listen closely: everyone you hear coming (laughs, footsteps, running, the squeak). 20 / 20.
  { name: 'Listen closely', v: 2, levels: lv({ fre: 14, bon: 14, fox: 14, wfx: 12, pfx: 12, mop: 16 }) },
  // Out of order: everyone who breaks things or messes with them. 20 / 20.
  { name: 'Out of order', v: 2, levels: lv({ wti: 16, pch: 14, pfx: 14, sec: 14, stf: 12 }) },
  // The two the bot won least often outside the ladder (Over the rainbow was rbw 16, bnt 14, plu 12 before
  // testing; the rainbow keeps the mouse busy just when Bonnet and Plushtrap need it).
  { name: 'Fox hunt', v: 3, levels: lv({ fox: 14, wfx: 12, nfx: 12, ffx: 12, twf: 12 }) },
  // Wet floor: the Mop bucket and everyone who walks the halls. 17 / 18.
  { name: 'Wet floor', v: 1, levels: lv({ mop: 20, bon: 16, nfx: 16, chi: 12, fun: 12 }) },
  { name: 'Over the rainbow', v: 1, levels: lv({ rbw: 14, bnt: 10, plu: 8 }) },
  // Screen time: everything that fights you for the mouse. 19 / 14, mostly Bonnet.
  { name: 'Screen time', v: 1, levels: lv({ lol: 16, rbw: 14, bnt: 14, pch: 14 }) },
  // The bridge from the small challenges to the ladder (on request, 2026-11-07: "add some more in between
  // challenges from Fox hunt to Everyone at 5 to bridge the gap"): more characters at once, 80 to 140 points.
  { name: 'Party crashers', v: 4, levels: lv({ dee: 20, fre: 10, bon: 10, chi: 10, fox: 10, tbo: 10, tch: 10 }) },
  // v2: + Piranha Plushtrap at 10 (on request: he's a Plushtrap variant, and Plushtrap is a rabbit).
  { name: 'Hare raising', v: 2, levels: lv({ bon: 12, tbo: 12, wbn: 12, sbn: 12, rsb: 12, bnt: 12, plu: 10, pir: 10 }) },
  { name: 'Old school', v: 3, levels: these(10, ['fre', 'bon', 'chi', 'fox', 'gol', 'tbo', 'tch', 'wbn', 'wfx', 'pup', 'sbn']) },
  // Every original character (on request, 2026-11-08): no Toy, Withered, Nightmare... variants. The owner
  // counts Sleepy Moon as an original but not Golden Freddy, Plushtrap or the Flamethrower endo. The bot
  // won it 19 / 18 of 20 (average / beginner). Bonnet was then taken out on request; that only made it
  // easier, so it kept v1. v2: Foxy's run rework.
  { name: 'OC (don\'t steal)', v: 3, levels: these(12, ['fre', 'bon', 'chi', 'fox', 'pup', 'rbw', 'dee', 'ned', 'wti', 'mon']) },
  // Four more (on request, 2026-11-08: "a few more difficult fun challenges"), each built on a clash and put
  // where the bot's results say (20 nights each, average / beginner).
  // Sweatbox: the heater (for the ducts) and the endo's flames both heat the office; the fumes need the doors
  // open. 19 / 20, easier than planned: the bot handles heat well and spends its coins removing White Tiger.
  { name: 'Sweatbox', v: 1, levels: these(20, ['end', 'tsp', 'tbo', 'tch', 'ned', 'wti', 'fre', 'bon', 'stf', 'pup', 'ffx']) },
  // The two halves of the roster (on request, 2026-11-08: "update Half the gang and The other half to be
  // their halves of the roster"), all at 10. The other half: FNaF World onward (18 characters). It used to
  // be everyone not in the old Half the gang (15 / 8 of 20, average / beginner, mostly Plushtrap and
  // Nightmare Chica); now it lost those two and gained Security, Lolbit, Funtime Chica, the Mop bucket and
  // Piranha Plushtrap, and the bot won it 19 / 16, so it got easier and kept v1 and its ✓.
  { name: 'The other half', v: 1, levels: these(10, ['rbw', 'dee', 'sec', 'fun', 'ffx', 'bnt', 'lol', 'twf', 'rsb', 'ned', 'fch', 'mop', 'end', 'tsp', 'pir', 'stf', 'wti', 'mon']) },
  // v3: + Nedd Bear and the Magic Rainbow (on request: "everyone who came later" should include them).
  // The bot then won it 17 / 15 of 20 (average / beginner), mostly losing to Bonnet, so it moved here.
  // Then + Security, Lolbit, Funtime Chica, the Mop bucket and Piranha Plushtrap (on request, 2026-11-09: the
  // fourth batch came later too): the same 18 characters as The other half, but at 12 instead of 10. With more
  // characters each one moves slower, and the bot won 18 / 17, so it wasn't harder and kept v4 and its ✓.
  { name: 'Behind the curtain', v: 4, levels: these(12, ['rbw', 'dee', 'sec', 'fun', 'ffx', 'bnt', 'lol', 'twf', 'rsb', 'ned', 'fch', 'mop', 'end', 'tsp', 'pir', 'stf', 'wti', 'mon']) },
  // Half the gang: FNAF 1 to FNAF 4 (17 characters). It gained Phantom Foxy, Nightmare Chica and Plushtrap,
  // which made it harder: v4, 18 / 14 (it was the first 14 characters, at the bridge's start).
  { name: 'Half the gang', v: 5, levels: these(10, ['fre', 'bon', 'chi', 'fox', 'gol', 'tbo', 'tch', 'wbn', 'wfx', 'pup', 'sbn', 'pch', 'pfx', 'nfr', 'nfx', 'nch', 'plu']) },
  // Stare down: the mask characters, White Tiger (who breaks the mask if it stays on too long), and three who
  // need the monitor, which the mask blocks. 20 / 14.
  { name: 'Stare down', v: 1, levels: lv({ gol: 20, wbn: 20, tbo: 20, nfr: 20, wti: 20, pup: 18, mon: 16, nch: 16 }) },
  // Withered away: everyone who looks worn out in their official design (torn suits, burns, rot, exposed
  // parts), not just the two with "Withered" in their name (on request, 2026-11-08). It was Withered Bonnie
  // and Withered Foxy at 16 near the start of the list; with ten characters it's harder (v6) and sits here.
  // Bot: 14 / 13 of 20, mostly Toxic Springtrap, Nightmare Chica and Twisted Foxy.
  { name: 'Withered away', v: 6, levels: these(10, ['fox', 'wbn', 'wfx', 'pch', 'pfx', 'nfr', 'nfx', 'nch', 'twf', 'tsp']) },
  // Last of the bridge: the bot (as a beginner) lost it 3 times in 10, all to Plushtrap.
  { name: 'Bad dreams', v: 2, levels: these(12, ['pch', 'nfr', 'nfx', 'nch', 'plu', 'ned', 'rbw', 'twf', 'sbn', 'pup']) },
  // Feeding time (the fourth batch): everyone fighting over your coins. Piranha Plushtrap eats them, Funtime
  // Chica raises the prices, Dee Dee makes them rarer and Rockstar Bonnie wants his guitar. It was pir 16,
  // fch 16, dee 14, rsb 14 at first, but then the guitar could rarely be afforded (8 / 10 of 20); now 16 / 12.
  { name: 'Feeding time', v: 1, levels: lv({ pir: 14, fch: 16, dee: 10, rsb: 10 }) },
  // Sugar rush: all cupcakes and clicking. 16 / 9.
  { name: 'Sugar rush', v: 1, levels: lv({ pch: 20, nch: 20, bnt: 20, chi: 20, rbw: 20, twf: 18 }) },
  // Pitch black: every flashlight character in Shadow Bonnie's darkness, plus two who are hard to find in it.
  // 15 / 16 at first; v2 (Phantom Chica breaking the doors) 19 / 7, mostly Withered Foxy getting in through
  // a broken left door, so it moved here from after Behind the curtain.
  { name: 'Pitch black', v: 4, levels: lv({ sbn: 20, plu: 20, nfx: 20, fun: 20, wfx: 20, nfr: 18, pch: 16, bnt: 16 }) },
  // The ladder up to All 20 (on request: "a good amount scaling up to the max mode because right now it is
  // a big jump"). Everyone is in each one; Graveyard shift, Double shift and Sunrise is a lie each have a
  // themed group at 20 over everyone else.
  // The "everyone" ones include every character, so each new batch makes them harder (v4: the second
  // batch, v5: the third). Everyone at 10, 15 and 18 were removed on request (2026-11-07, before the third
  // batch). Their saved ✓s stay in the browser (never deleted), they just aren't shown.
  { name: 'Everyone at 5', v: 10, levels: everyone(5) },
  // v4 (on request, 2026-11-08: "more unique instead of just names for everyone at modes"): each has its
  // own theme: a group at 20, everyone else lower (the owner's choice: a themed group alone was easier than
  // Everyone at 5, so it couldn't be a step of the ladder). Bot, 20 nights each, average / beginner:
  // Graveyard shift 12 / 3, Double shift 7 / 1, Sunrise is a lie 8 / 1 (Last stand 6 / 0, All 20 3 / 0).
  // Graveyard shift: ghosts and leftovers (the endo is the bones).
  { name: 'Graveyard shift', v: 7, levels: themeOver(5, 20, ['gol', 'pch', 'sbn', 'pup', 'wbn', 'wfx', 'twf', 'tsp', 'nfr', 'nch', 'end']) },
  // Double shift: two characters for every job (mask, flashlight, right door, cameras, clicking, ducts, heat).
  { name: 'Double shift', v: 7, levels: themeOver(7, 20, ['gol', 'wbn', 'plu', 'sbn', 'fre', 'ffx', 'mon', 'nch', 'pch', 'bnt', 'tbo', 'tch', 'end', 'tsp']) },
  // Sunrise is a lie: everyone who gets worse the longer the night goes.
  { name: 'Sunrise is a lie', v: 7, levels: themeOver(11, 20, ['pup', 'mon', 'end', 'tsp', 'wti', 'ffx', 'twf', 'nfr', 'nfx', 'rsb']) },
  { name: 'Last stand', v: 5, levels: everyoneBut(20, { dee: 0, wti: 10 }) },
  { name: 'All 20', v: 10, levels: everyone(20) },
];

// One line of flavour text per challenge, shown under the list when it's picked.
const FLAVOR = {
  'Warm-up': 'Your first shift. Listen for the laughing.',
  'The classics': 'The old crew, back on stage. Mostly.',
  'Wind it up': 'Keep the music playing, whatever walks in.',
  'Don\'t look away': 'You need the monitor tonight. But every time you look up from it, someone is there.',
  'Caution': 'Watch the arrow. Then watch the doors.',
  'Pirate\'s dance': 'Two doors, two foxes, no rest.',
  'Bedtime': 'Lights on, eyes open, Freddles off the desk.',
  'Heat wave': 'The fan is your best friend tonight.',
  'Mask on': 'You will be wearing this a lot.',
  'Classic 20': 'The old crew, as hard as they get.',
  'All 20': 'Everyone, at their worst. Good luck.',
  'Quiet night': 'Just a music box, a nap and a warm room. What could go wrong?',
  'Everyone at 5': 'Meet the whole gang, on their best behaviour.',
  'Night light': 'Keep that flashlight handy.',
  'Bunny trouble': 'Four rabbits, four different problems.',
  'Freddy fever': 'Every Freddy in the building wants a word.',
  'Withered away': 'Old, broken, and still coming.',
  'Snack time': 'Cupcakes everywhere, and someone small and fast.',
  'Hot and sleepy': 'The heat makes you drowsy. Stay awake, stay cool.',
  'Music lesson': 'Wind the box between visitors at both doors.',
  'Nightmare crew': 'Every nightmare in the building is awake.',
  'Door duty': 'Your hands never leave the door buttons.',
  'Masquerade': 'The mask is barely off before you need it again.',
  'Power hungry': 'Doors, lights, the fan, the heater, and batteries that cost more. Watch your power.',
  'Click frenzy': 'Fast hands and sharp eyes win tonight.',
  'Fun time': 'Showtime! Watch the halls, the doors and the floor.',
  'Patrol': 'Keep your eyes on the cameras. They are not making a sound.',
  'Cupcake hunt': 'So many cupcakes. Only some of them are real.',
  'Little terrors': 'The small ones are the worst.',
  'Nightmare hour': 'The nightmares are all awake, and one of them wants in.',
  'Crawl space': 'Something is in the ducts. Several somethings.',
  'Fox hunt': 'Every fox in the building, and only one left door.',
  'Lights out': 'When the lights go, the little ones come out.',
  'Shopping spree': 'Fend them off, pocket the coins, and buy back that guitar.',
  'Big cat': 'Don\'t hold anything too long. He\'s watching.',
  'Toxic shock': 'Open the doors to breathe. Shut them to live.',
  'Over the rainbow': 'Keep that mouse moving.',
  'Feeding time': 'A hungry fish, a pricey shop and a guitar to buy back. Count your coins.',
  'Static': 'Your cameras have a mind of their own tonight. LOL.',
  'Phantoms': 'Burnt, golden and shadowy. None of them are really there.',
  'Wet floor': 'Someone forgot to mop the halls. Now everyone takes the shortcut.',
  'Listen closely': 'Laughs, footsteps, running and a squeak. Keep the sound on.',
  'Screen time': 'Your mouse hand is going to be busy. LOL.',
  'Out of order': 'Doors, monitor, cameras: something is always broken tonight.',
  'Party crashers': 'Dee Dee is here. Somebody\'s leaving, and everybody else is angry.',
  'Hare raising': 'Eight rabbits. None of them friendly.',
  'Old school': 'The pizzeria\'s original crew and their toy replacements.',
  'Bad dreams': 'Nightmares, phantoms and a rainbow. Sleep tight.',
  'Behind the curtain': 'Everyone who came later. They all have their own rules.',
  'Half the gang': 'FNAF 1 to 4, all at once. Halfway to everyone.',
  'The other half': 'FNaF World onward. Everyone Half the gang left out, and they noticed.',
  'OC (don\'t steal)': 'No Toys, no Withereds, no Nightmares. Just the originals.',
  'Graveyard shift': 'Ghosts, phantoms and leftovers. None of them stay buried.',
  'Double shift': 'Two of everyone, two of every job.',
  'Sunrise is a lie': 'Everything builds up. Just one more hour.',
  'Stare down': 'Mask on, mask off. Don\'t wear it too long, he\'s watching.',
  'Pitch black': 'Shadow Bonnie took the lights. Everyone else needs the flashlight.',
  'Sweatbox': 'The heater, the flames and the fumes. It\'s getting hot in here.',
  'Sugar rush': 'Cupcakes, a running rabbit and a rainbow. Your mouse hand will hurt.',
  'Last stand': 'All 20, minus a little mercy.',
};

// The name a beaten challenge is saved under: its name plus its version, like "Bedtime v1".
const clearKey = p => `${p.name} v${p.v || 1}`;

// The points a challenge is worth: all its levels added up.
const presetPoints = p => p.levels.reduce((total, level) => total + level, 0);
