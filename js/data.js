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
// They are in the order you made their mechanics, which is also the order of the setup rows.
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
  desc: 'Can appear when you flip the monitor down. Find and click 1 to 3 shadow cupcakes (more at higher levels) or she jumpscares you and takes 10% power.',
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
  desc: 'Freddles pile up on your desk; shine the flashlight on them to send them off. If all 3 stay too long he comes: keep the mask on until he leaves.',
  how: 'came for his Freddles',
};
const WFOXY = {
  id: 'wfx', name: 'Withered Foxy', where: 'LEFT DOOR',
  desc: 'Charges the left door from Pirate Cove; being on the cameras stalls him. Shut the door, wait for the stomp, then open it, flash him and shut it again.',
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

// Everything with a level on the custom night screen, in the order of the saved `levels` list.
// NEW CHARACTERS GO AT THE END, so levels saved by older versions still line up.
const SETUP = [FREDDY, BONNIE, GOLDEN, PCHICA, BONNET, WBONNIE, PUPPET, STAFF, NFREDDY, WFOXY, MOON, ENDO];

// ---------- spots in the office ----------
// [row, column] places in the office picture (36 wide, 16 tall, see officeLines in art.js).
// Phantom Chica's shadow cupcakes (3 characters wide) hide in some of these.
const CUPCAKE_SPOTS = [[2, 12], [5, 20], [5, 30], [8, 15], [11, 29], [11, 3], [13, 14], [14, 6], [15, 25], [13, 22]];
// The three places on the desk where Freddles sit (the left end of each 4-wide Freddle).
const FREDDLE_SPOTS = [[11, 11], [11, 17], [11, 23]];

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
// The list is in order, easiest first. The order came from a test bot that plays with a person's
// limits (tools/bot.js: it only reacts to what a player could see or hear, with human reaction times,
// a mouse that moves at a person's speed, one action at a time). The ones it won less often come
// later, and ties are sorted by points. Warm-up stays first and All 20 stays last.
// Measured 2026-11-03 (after the office heat and Sleepy Moon's camera rework), 30 nights each, wins by
// an "average" player and a "beginner": the first 23 were 29 or 30 of 30 for both; then Snack time
// (24, 19), Everyone at 10 (23, 13), at 15 (20, 13), at 18 (19, 3) and All 20 (18, 0).
// Every challenge must stay humanly possible like this (the top two are for experienced players).
const PRESETS = [
  { name: 'Warm-up', v: 2, levels: lv({ fre: 3, bon: 3, pup: 3, wfx: 2 }) },
  // The two "classic" challenges have no Withered Foxy (taken out on request, in case a standard Foxy
  // is added later). That made them easier, so they kept their version and their ✓.
  { name: 'The classics', v: 2, levels: lv({ fre: 8, bon: 8, gol: 5 }) },
  { name: 'Quiet night', v: 3, levels: lv({ pup: 8, mon: 8, end: 8 }) },
  { name: 'Wind it up', v: 2, levels: lv({ pup: 14, bon: 8, pch: 8 }) },
  { name: 'Caution', v: 2, levels: lv({ stf: 14, bon: 10, fre: 6 }) },
  { name: 'Heat wave', v: 2, levels: lv({ end: 15, stf: 8, fre: 8 }) },
  { name: 'Bedtime', v: 3, levels: lv({ mon: 12, nfr: 10, bnt: 10 }) },
  { name: 'Withered away', v: 2, levels: lv({ wbn: 16, wfx: 16 }) },
  { name: 'Hot and sleepy', v: 3, levels: lv({ end: 16, mon: 16 }) },
  { name: 'Pirate\'s dance', v: 2, levels: lv({ wfx: 15, bon: 10, fre: 10 }) },
  { name: 'Don\'t look away', v: 2, levels: lv({ gol: 12, pch: 12, wbn: 12 }) },
  { name: 'Night light', v: 3, levels: lv({ mon: 14, nfr: 12, wfx: 10 }) },
  { name: 'Mask on', v: 2, levels: lv({ wbn: 15, gol: 15, nfr: 12 }) },
  { name: 'Bunny trouble', v: 2, levels: lv({ bon: 14, bnt: 14, wbn: 14 }) },
  { name: 'Freddy fever', v: 2, levels: lv({ fre: 14, gol: 14, nfr: 14 }) },
  { name: 'Music lesson', v: 2, levels: lv({ pup: 18, wfx: 12, bon: 12 }) },
  { name: 'Nightmare crew', v: 2, levels: lv({ stf: 15, nfr: 15, pch: 15 }) },
  { name: 'Click frenzy', v: 2, levels: lv({ pch: 18, bnt: 18, gol: 10 }) },
  { name: 'Masquerade', v: 2, levels: lv({ gol: 16, wbn: 16, nfr: 14, bnt: 10 }) },
  { name: 'Door duty', v: 2, levels: lv({ fre: 16, bon: 16, stf: 16, wfx: 12 }) },
  { name: 'Classic 20', v: 2, levels: lv({ fre: 20, bon: 20, gol: 20 }) },
  // v2: Phantom Chica added (on request: she takes power, so she belongs here). Harder, so a new version.
  // v3: the office heat (like every challenge). v4: Sleepy Moon's rework (like every challenge he's in).
  { name: 'Power hungry', v: 4, levels: lv({ end: 14, mon: 14, stf: 14, wfx: 14, pch: 14 }) },
  { name: 'Everyone at 5', v: 3, levels: everyone(5) },
  { name: 'Snack time', v: 2, levels: lv({ pch: 16, bnt: 12, pup: 10 }) },
  { name: 'Everyone at 10', v: 3, levels: everyone(10) },
  { name: 'Everyone at 15', v: 3, levels: everyone(15) },
  { name: 'Everyone at 18', v: 3, levels: everyone(18) },
  { name: 'All 20', v: 3, levels: everyone(20) },
];

// One line of flavour text per challenge, shown under the list when it's picked.
const FLAVOR = {
  'Warm-up': 'Your first shift. Listen for the laughing.',
  'The classics': 'The old crew, back on stage. Mostly.',
  'Wind it up': 'Keep the music playing, whatever walks in.',
  'Don\'t look away': 'Every time you look up from the monitor, someone is there.',
  'Caution': 'Watch the arrow. Then watch the doors.',
  'Pirate\'s dance': 'Two doors, one fox, no rest.',
  'Bedtime': 'Lights on, eyes open, Freddles off the desk.',
  'Heat wave': 'The fan is your best friend tonight.',
  'Mask on': 'You will be wearing this a lot.',
  'Everyone at 10': 'The whole gang, taking it easy. Sort of.',
  'Classic 20': 'The old crew, as hard as they get.',
  'Everyone at 15': 'Nobody is taking it easy now.',
  'All 20': 'Everyone, at their worst. Good luck.',
  'Quiet night': 'Just a music box, a nap and a warm room. What could go wrong?',
  'Everyone at 5': 'Meet the whole gang, on their best behaviour.',
  'Night light': 'Keep that flashlight handy.',
  'Bunny trouble': 'Three rabbits, three different problems.',
  'Freddy fever': 'Every Freddy in the building wants a word.',
  'Withered away': 'Old, broken, and still coming.',
  'Snack time': 'Cupcakes everywhere, and someone small and fast.',
  'Hot and sleepy': 'The heat makes you drowsy. Stay awake, stay cool.',
  'Music lesson': 'Wind the box between visitors at both doors.',
  'Nightmare crew': 'Beeps, Freddles and burnt cupcakes.',
  'Door duty': 'Your hands never leave the door buttons.',
  'Masquerade': 'The mask is barely off before you need it again.',
  'Power hungry': 'Doors, lights, the fan and a cupcake thief. Watch your battery.',
  'Click frenzy': 'Fast hands win tonight.',
  'Everyone at 18': 'Almost the worst. Almost.',
};

// The name a beaten challenge is saved under: its name plus its version, like "Bedtime v1".
const clearKey = p => `${p.name} v${p.v || 1}`;

// The points a challenge is worth: all its levels added up.
const presetPoints = p => p.levels.reduce((total, level) => total + level, 0);
