/* =====================================================================
   art.js: the ASCII pictures, and the tools that draw them.

   How drawing works in this game:
   A picture is a GRID: a list of rows, each row a list of cells.
   Each cell is one character plus an optional CSS class for its color:
       { ch: 'O', cls: 'c-bon' }
   We build a grid from plain text, draw characters into it (Bonnie in
   a doorway, Freddles on the desk...), then turn the grid into HTML
   with toHtml() and drop it into a <pre> block on the page.

   Every drawing is plain ASCII on purpose: fancy symbols come from
   other fonts with different widths and would knock the columns out
   of line. The drawings are written with String.raw`...`, which keeps
   backslashes exactly as typed (in a normal string \ is special).
   One catch: a drawing can't END with \ right before the closing `,
   because \` means "a backtick character, not the end". Those lines get
   a space after the \ (spaces at the end of a line are never drawn).
   ===================================================================== */

// A few characters mean something special in HTML, so they must be "escaped".
const esc = ch => ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch;

// Turn lines of text into a grid of cells, each line padded or cut to exactly `w` characters.
function grid(lines, w, cls = '') {
  return lines.map(line => Array.from(line.padEnd(w).slice(0, w)).map(ch => ({ ch, cls })));
}

// An empty grid, `w` wide and `h` tall.
const blank = (w, h) => Array.from({ length: h }, () => Array.from({ length: w }, () => ({ ch: ' ', cls: '' })));

// Turn a grid back into HTML: colored cells become <span>s, rows are joined with line breaks.
function toHtml(g) {
  return g.map(row =>
    row.map(c => c.cls ? `<span class="${c.cls}">${esc(c.ch)}</span>` : esc(c.ch)).join('')
  ).join('\n');
}

// Draw a drawing (a list of text lines) into grid g with its top-left corner at row r, column c,
// in the CSS class `cls`. Spaces INSIDE a line (between its first and last real character) are
// drawn too, so the drawing hides what's behind it; the spaces around it are left see-through.
// If the drawing has an accent mask (lines.accent, see "accent colors" below), the cells it marks get
// a second color on top of `cls`.
function sprite(g, r, c, lines, cls) {
  lines.forEach((line, i) => {
    const row = g[r + i];
    if (!row) return;
    const first = line.search(/\S/), last = line.length - 1 - line.split('').reverse().join('').search(/\S/);
    if (first < 0) return;   // an empty line: nothing to draw
    const mask = (lines.accent && lines.accent[i]) || '';
    for (let k = first; k <= last; k++) {
      const extra = ACCENT[mask[k]];
      if (row[c + k]) row[c + k] = { ch: line[k], cls: extra ? `${cls} ${extra}` : cls };
    }
  });
}

// Write text into a grid, one cell per character, all in one class.
function write(g, r, c, text, cls = '') {
  Array.from(text).forEach((ch, k) => { if (g[r] && g[r][c + k]) g[r][c + k] = { ch, cls }; });
}

// Put a +----+ border around some lines of text.
const frame = (inner, w) => [
  '+' + '-'.repeat(w) + '+',
  ...inner.map(line => '|' + line.padEnd(w).slice(0, w) + '|'),
  '+' + '-'.repeat(w) + '+',
];

// ---------- menu icons ----------
// A tiny 3-line face of each character, used on the title, the custom night screen and the end
// screens. Written as normal strings, so a backslash is typed \\ (two of them make one).
// (Checked against the official designs on 2026-11-08, on request: the colors in ICON_ACCENTS below and
// the details here follow the real characters. A hook or eyepatch on a character's RIGHT side is on
// the LEFT as you look at them.)
const ICONS = {
  fre: [' [_] ', '(o^o)', ' >=< '],          // Freddy: black top hat and bow tie, blue eyes
  bon: ['|\\ /|', '(o o)', ' >=< '],         // Bonnie: long ears, magenta eyes, red bow tie
  gol: [' [_] ', '(.^.)', ' >=< '],          // Golden Freddy: Freddy in gold, empty eyes with tiny pupils
  pch: [' \\|/ ', '(.>.)', ' {V} '],         // Phantom Chica: burnt, white pinprick eyes, beak and bib
  bnt: ['(\\_/)', '(o*o)', ' v v '],         // Bonnet: small and pink, green eyes, her nose
  wbn: [' |\\  ', '(  o#)', ' |vv| '],       // Withered Bonnie: no face, one ear, a red pinprick eye
  pup: ['.---.', '(o o)', '(@v@)'],          // the Puppet: white mask, red cheeks and lips
  stf: ['.---.', '|@ @|', '|VVV|'],          // the Nightmare staff bot: glowing eyes, painted grin with sharp teeth
  nfr: ['@   @', '(0^0)', '|vVv|'],          // Nightmare Freddy: Freddles, orange eyes, sharp teeth
  wfx: ['/\\ /\\', '(# o)', 'J\\vv/'],       // Withered Foxy: eyepatch on his right eye, hook on his right hand
  mon: [' .-. z', '(>U<)', " '-'  "],        // Sleepy Moon: cross eyes and a big red grin
  end: [' .-. ', '[o o]', '/|=|\\~'],        // the Flamethrower endo: welding visor, blue eyes, flames
  nfx: ['/\\_/\\', '(O O)', 'J VVV'],         // Nightmare Foxy: orange eyes, teeth, hook (no eyepatch)
  fun: ['[_]  /\\', '(o^o)(o)', ' >=<    '],  // Funtime Freddy: black hat and bow tie, BonBon on his hand
  chi: [' \\|/ ', '(o>o)', '|EAT|'],          // Chica: violet eyes, orange beak, LET'S EAT bib
  plu: ['(\\/)', '(oo)', '{vv}'],             // Plushtrap: a little brown-green rabbit plush with sharp teeth
  nch: [' \\|/ ', '(@>@)', '{VVV}'],          // Nightmare Chica: one red eye, teeth everywhere
  // the third batch
  tbo: ['/\\ /\\', '(^o^)', ' >=< '],         // Toy Bonnie: shiny blue, green eyes, red bow tie
  tch: [' \\|/ ', '(^>^)', '|PTY|'],          // Toy Chica: blue eyes, "let's party" bib
  ned: ['n(=)n', '(o.o)', '  V  '],           // Nedd Bear: round ears, red hat, green eyes, red tie
  wti: ['/\\_/\\', '(o=o)', '|/|\\|'],        // White Tiger: one lime eye, one sky blue, black stripes
  rbw: ['.~~~.', '(^v^)', '~~~~~'],           // Chica's Magic Rainbow: a smiling rainbow
  rsb: ['/\\ /\\', '(o o)', ' * * '],         // Rockstar Bonnie: green eyes, gold star buttons
  tsp: ['/\\ /\\', '(@.@)', ' ~~~ '],         // Toxic Springtrap: spiral eyes, in a cloud of fumes
  dee: ['  __J', '(^u^)', ' /|\\ '],          // Dee Dee: with her fishing rod
  ffx: ['/\\_/\\', '(* *)', '<SHO>'],         // Funtime Foxy: white and pink, yellow eyes, ready for the show
  fox: ['/\\_/\\', '(o o)', 'J\\vv/'],        // Foxy: red, yellow eyes, gold teeth, hook on his right hand
  sbn: ['/\\ /\\', '(o o)', ' VVV '],         // Shadow Bonnie: a black Toy Bonnie with white eyes and teeth
  twf: ['/\\_/\\', '(x o)', '/vVv\\'],        // Twisted Foxy: split face, red eyes, too many teeth
  // the fourth batch
  pfx: ['/\\_/\\', '(. O)', ' \\vv/'],        // Phantom Foxy: burnt crimson, white eyes, no hook
  sec: ['  o  ', '[(@)]', ' /#\\ '],           // Security: a grey camera for a head (yellow lens), red body
  lol: ['/\\_/\\', '(o o)', ' LOL '],          // Lolbit
  fch: [' \\|/ ', '(o>o)', ' $ $ '],          // Funtime Chica: white, pink eyes, orange beak, after your coins
  pir: ['(\\/)', '{oo}', ' VV '],             // Piranha Plushtrap: orange fin-ears, neon blue eyes, teeth
  mop: ['.---.', '|o~o|', '%/|\\%'],          // the Mop bucket (Bucket Bob): a bucket head, broom body, blue mitts
};
// Which line of the icon is the face (the middle one for everyone; kept so a new drawing can change it).
const FACE_ROW = {};
// A text with every character escaped for HTML (see esc above).
const escText = s => Array.from(s).map(esc).join('');
// Accent masks for a few icons (on request: a second color, used sparingly). Each line lines up with the
// icon's line above it; a letter from ACCENT (see "accent colors" below) colors the character above it,
// a space leaves it in the main color.
const ICON_ACCENTS = {
  fre: [' xxx', ' b b', ' xxx'],          // Freddy: black hat and bow tie, blue eyes
  bon: ['', ' p p', ' rrr'],              // Bonnie: magenta eyes, red bow tie
  gol: [' xxx', '', ' xxx'],              // Golden Freddy: black hat and bow tie
  chi: ['', ' vov'],                      // Chica: violet eyes, orange beak
  fox: ['', ' y y', '  kk'],              // Foxy: yellow eyes, gold teeth
  wfx: ['', '   y'],                      // Withered Foxy: his one yellow eye
  wbn: ['', '    r'],                     // Withered Bonnie: a red pinprick eye
  pch: ['', ' w w'],                      // Phantom Chica: white pinprick eyes
  pfx: ['', ' w w'],                      // Phantom Foxy: white eyes
  sbn: ['', ' w w', ' www'],              // Shadow Bonnie: white eyes and teeth on black
  nfr: ['', ' o o'],                      // Nightmare Freddy: orange eyes
  nfx: ['', ' o o'],                      // Nightmare Foxy: orange eyes
  nch: ['', ' ro'],                       // Nightmare Chica: a red eye, orange beak
  tbo: ['', ' g g', ' rrr'],              // Toy Bonnie: green eyes, red bow tie
  tch: ['', ' bob'],                      // Toy Chica: blue eyes, orange beak
  bnt: ['', ' g g'],                      // Bonnet: green eyes
  ffx: ['', ' k k'],                      // Funtime Foxy: yellow eyes
  twf: ['', ' r r'],                      // Twisted Foxy: red eyes
  fun: ['xxx  BB', ' b b BBB', ' xxx'],   // Funtime Freddy: black hat and bow tie, blue eyes, BonBon in her blue
  wti: ['', ' c l', ' x x'],              // White Tiger: one sky blue eye, one lime (heterochromia), black stripes
  rbw: ['roygb', '', 'roygb'],            // rainbow stripes
  pup: ['', '', ' rrr'],                  // the Puppet: red cheeks and lips
  rsb: ['', ' g g', ' k k'],              // Rockstar Bonnie: green eyes, gold star buttons
  stf: ['xxxxx', 'x   x', 'x   x'],       // the staff bot: black head, white eyes and teeth
  dee: ['', 'pg gp', ' pvp'],             // Dee Dee: pink cheeks, green eyes, magenta stripes, purple button
  ned: ['  r', ' g g', '  r'],            // Nedd Bear: red hat, green eyes, red tie
  mon: ['', '  r'],                       // Sleepy Moon: red grin
  end: ['', ' b b', '     o'],            // the endo: blue eyes behind the visor, an orange flame
  sec: ['', 'GGyGG'],                     // Security: grey camera head with a yellow lens (body and antenna red)
  lol: ['', '', ' vvv'],                  // Lolbit: a purple LOL
  fch: ['', ' pop', ' k k'],              // Funtime Chica: pink eyes, orange beak, gold coins
  pir: ['oooo', ' cc'],                   // Piranha Plushtrap: orange piranha ears, neon blue eyes
  mop: ['', '', 'b   b'],                 // the Mop bucket: blue mitts
};
// One line of text as HTML, with the characters its accent mask marks wrapped in their color.
const accentText = (line, mask = '') => Array.from(line).map((ch, k) =>
  ACCENT[mask[k]] ? `<span class="${ACCENT[mask[k]]}">${esc(ch)}</span>` : esc(ch)).join('');
const iconLines = id => ICONS[id].map((line, i) => accentText(line, (ICON_ACCENTS[id] || [])[i]));
// The 3-line icon as HTML, in the character's color.
const iconHtml = (c, extra = '') => `<span class="icon c-${c.id}${extra}" title="${c.name}">${iconLines(c.id).join('\n')}</span>`;
// Just the face line, for places with room for only one line, like the "Best:" line.
// `??` means "use the right side if the left side is missing", so most characters get line 1.
const faceHtml = c => `<span class="face-mini c-${c.id}" title="${c.name}">${iconLines(c.id)[FACE_ROW[c.id] ?? 1]}</span>`;

// ---------- camera rooms ----------
// The inside of each camera's room: 9 lines of 38 characters (frame() adds the border).
const ROOM_ART = {
  stage: String.raw`
 *  .  *  .  *  .  *  .  *  .  *  .  *
 /\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/
 |                                  |
 |                                  |
 |                                  |
 |__________________________________|
 ||    o        o        o        ||
 ||   /|\      /|\      /|\       ||
 ''''''''''''''''''''''''''''''''''''`,
  dining: String.raw`
   ^      ^      ^      ^      ^
  [=]    [=]    [=]    [=]    [=]
 .----------.          .----------.
 | o  o  o  |          | o  o  o  |
 '----------'          '----------'

     .----------------------.
     | o  o  o  o  o  o  o  |
     '----------------------'`,
  back: String.raw`
 .---. .---. .---.       [ ][ ][ ]
 |o o| |x x| |o -|       [ ][ ][ ]
 '---' '---' '---'       ---------
  heads on a shelf       spare parts



   __     ___      ####        __
  |__|   |___|     ####       |__|
 ------------------------------------`,
  cove: String.raw`
  .--------------------------------.
  | ~~~~~~~~ OUT OF ORDER ~~~~~~~~ |
  '--------------------------------'
     ||||||||||||||||||||||||||||
     ||||||||||||||||||||||||||||
     ||||||||||||||||||||||||||||
     ||||||||||||||||||||||||||||
     ||||||||||||||||||||||||||||
   ================================`,
  whall: String.raw`
 |\                                 /|
 | \    .-------.    .-------.     / |
 |  |   | PARTY |    | TIME! |    |  |
 |  |   '-------'    '-------'    |  |
 |  |                             |  |
 |  |                             |  |
 | /                               \ |
 |/  . . . . . . . . . . . . . . .  \|
 '------------------------------------'`,
  ehall: String.raw`
 |\                                 /|
 | \         .-----------.         / |
 |  |        | WET FLOOR |        |  |
 |  |        '-----------'        |  |
 |  |            /\               |  |
 |  |           /  \              |  |
 | /           '----'              \ |
 |/  , , , , , , , , , , , , , , ,  \|
 '------------------------------------'`,
  prize: String.raw`
   .--.   .---.   .--.
   |[]|   | ? |   |[]|    PRIZES!
   '--'   '---'   '--'

          .------------------.
          |  ~ music  box ~  |
          |                  |
          '------------------'
`,
};
// The String.raw blocks above start with a line break (so they line up nicely in the code);
// .slice(1) drops that first empty line, and split('\n') cuts each into its 9 lines.
for (const room in ROOM_ART) ROOM_ART[room] = ROOM_ART[room].split('\n').slice(1);

// Where Bonnie stands in each room: [row, column] of the top-left of his small drawing,
// counted in the framed 40 x 11 camera picture (row 0 and column 0 are the border).
const BONNIE_SLOTS = { stage: [3, 17], dining: [5, 15], back: [5, 21], whall: [5, 17], ehall: [5, 24] };
// Where Sleepy Moon hides in each room when he turns up on the cameras (away from Bonnie's spots).
const MOON_SLOTS = { stage: [3, 5], dining: [6, 31], back: [5, 6], cove: [5, 1], whall: [4, 26], ehall: [4, 7], prize: [6, 3] };
// Where the second batch of characters stand on the cameras they visit.
const CHICA_SLOTS = { back: [5, 28], dining: [5, 22], whall: [6, 11] };
const NFOXY_SLOTS = { dining: [6, 1], whall: [3, 18], ehall: [5, 29] };
// Funtime Freddy; BonBon sits 5 to his right. Placed so nobody else covers them: you have to be able
// to see whether BonBon is on his hand.
const FUN_SLOTS = { whall: [7, 21], ehall: [7, 6] };
// Where Nightmare Chica's cupcake can hide on each camera: tucked into the busy parts of the picture
// (the stars, the hats, the shelf, the sign, the floor...), so you have to really look.
const NCHICA_SPOTS = {
  stage: [[1, 20], [8, 12], [6, 30]], dining: [[2, 25], [8, 14]], back: [[2, 13], [8, 20]],
  cove: [[2, 30], [9, 15]], whall: [[3, 25], [8, 20]], ehall: [[3, 16], [8, 28]], prize: [[2, 10], [2, 27]],
};
// Where a Fazcoin ($) can lie on each camera: in open spots where it's easy to see (unlike the
// cupcake above), away from where the characters stand.
const COIN_SPOTS = {
  stage: [[4, 28], [5, 11]], dining: [[6, 8], [2, 6]], back: [[6, 14], [5, 34]], cove: [[7, 35], [4, 2]],
  whall: [[8, 31], [6, 31]], ehall: [[3, 29], [8, 20]], prize: [[1, 27], [9, 12]],
};
// Where Twisted Foxy digs up out of the floor on CAM 7 (top-left of his drawing).
const TWIST_SPOTS = [[7, 32], [3, 31]];
// The fourth batch: Piranha Plushtrap's fish tank on CAM 3 (over the spare parts, top right), and where
// the Mop bucket stands in each hall (low down by the wall, drawn first so anyone passing is in front).
const TANK_SPOT = [1, 25];
const MOP_SPOTS = { whall: [7, 4], ehall: [7, 30] };
// Where Security's face flickers on the camera he just switched you to (top left corner).
const SEC_SPOT = [1, 2];

// ---------- the characters' drawings ----------
// Each one is a list of lines. `cam` is the small camera version, `door` fits a doorway,
// `office` is drawn in the office, and `scare` is the big jumpscare (shown at 2.2x size).
const art = s => s.split('\n').slice(1);   // same trick as ROOM_ART: drop the first empty line
const SPRITES = {
  fre: {
    scare: art(String.raw`
        _______
       |       |
     __|_______|__
  .-.             .-.
 (   )  _______  (   )
  '-'  /       \  '-'
      |  O   O  |
      |    ^    |
      |  .___.  |
      |  |vvv|  |
       \ '---' /
        \_____/
          >=<`),
  },
  bon: {
    cam: art(String.raw`
/\ /\
(o o)
 >w<`),
    door: art(String.raw`
 /\  /\
|  ||  |
|  ||  |
/      \
| O  O |
|  ww  |
|\/\/\/|
 \____/
  >==<`),
    scare: art(String.raw`
     /\         /\
    |  |       |  |
    |  |       |  |
    |  |       |  |
     \  \_____/  /
     /           \
    |   O     O   |
    |      w      |
    |  |\/\/\/\|  |
    |  |/\/\/\/|  |
     \___________/
          >==<`),
  },
  // Golden Freddy is Freddy in gold with dot eyes (on request). His jumpscare is made from Freddy's
  // just below the SPRITES list, so the two always match.
  gol: {
    // Slumped in front of your desk: Freddy (hat, ears, teeth, bow tie) with dot eyes. Exactly as wide
    // as the desk monitor (15), so none of it peeks out around him.
    office: art(String.raw`
      ___
    _|___|_
(_)         (_)
/   .     .   \
|      ^      |
|    |vvv|    |
\_____________/
/_____>=<_____\ `),
  },
  // Phantom Chica: burnt, with white pinprick eyes and a bib burnt past reading.
  pch: {
    scare: art(String.raw`
       \ | /
     .-------.
    /  .   .  \
   |     /\    |
   |    /  \   |
   |    \__/   |
    \  #####  /
     '-------'
     | #E##!# |
     '--------'`),
  },
  bnt: {
    office: art(String.raw`
(\_/)
(o*o)`),
    scare: art(String.raw`
    (\     /)
    ( \___/ )
   /         \
  |  O  *  O  |
  |   \___/   |
   \_________/
     >=====<`),
  },
  wbn: {
    office: art(String.raw`
  /\
 |  |   /\
 |  |  |  |
 /  '--'  \
|  ()      |
|    ######|
|   |/\/\/||
 \________/`),
    scare: art(String.raw`
     /\
    |  |      /\
    |  |     |  |
    |  |     |  |
     \  \___/  /
     /         \
    |   (o)     |
    |      #####|
    |    |\/\/\/|
    |    |/\/\/\|
     \_________/`),
  },
  pup: {
    peek: art(String.raw`
( @  @ )`),
    scare: art(String.raw`
       .---------.
      /           \
     |  ( )   ( )  |
     |   \     /   |
     |  (@)   (@)  |
     |     ___     |
     |    /   \    |
      \   '---'   /
       '---------'
        | | | | |`),
  },
  // The Nightmare staff bot (from Security Breach). Its jumpscare and menu face are a staff robot gone
  // bad, with glaring eyes and a jagged mouth; in the office it's still shown as the caution cone that
  // warns you (both on request).
  stf: {
    // The caution cone on the desk, drawn by drawVisitors in render.js (its eyes flash while it
    // blinks, and an arrow above it points at the door to shut).
    office: art(String.raw`
 /!\
[o o]
|___|
/   \ `),
    scare: art(String.raw`
        .-------.
       /  _   _  \
      |  (@) (@)  |
      |     |     |
      |  VVVVVVV  |
      |  ^^^^^^^  |
       \_________/
          |===|
      /---|===|---\
     /    |===|    \ `),
  },
  nfr: {
    freddle: '(oo)',
    office: art(String.raw`
(@)         (@)
 \ _________ /
 / /0\   /0\ \
|      ^      |
| |\/\/\/\/\| |
| |/\/\/\/\/| |
 \___________/`),
    scare: art(String.raw`
   (@)               (@)
    \\  ___________  //
     \ /           \ /
      | /0\     /0\ |
      |      ^      |
      | |\/\/\/\/\| |
      | |/\/\/\/\/| |
      |  \_______/  |
       \___________/
         (oo)   (oo)`),
  },
  wfx: {
    peek: art(String.raw`
 /\
(o|
 \|`),
    half: art(String.raw`
  /\_/\
 (#  o )
 |  ^  |
 |/\/\/|`),
    run: art(String.raw`
 /\_/\
(#  o)>
 /|  |\ `),
    door: art(String.raw`
/\    /\
| \__/ |
|(#) o |
|  /\  |
||\/\/||
 \/\/\/
J \__/`),
    // (The eyepatch is over his RIGHT eye and the hook on his RIGHT hand: your left as you face him.)
    scare: art(String.raw`
   /\               /\
  /  \_____________/  \
  |                   |
  |   ####     ( o )  |
  |   ####            |
  |         /\        |
  |   |\/\/\/\/\/\|   |
   \  |/\/\/\/\/\/|  /
J__ \_____________/`),
  },
  mon: {
    // Small enough to hide in a corner of a camera picture: you have to look for him.
    cam: art(String.raw`
 .-. z
(>U<)
 '-'`),
    scare: art(String.raw`
          _.---._
        .'  .-.  '.   Z
       /  .'   '.  \    z
      |  /  >_<  \  |
      | |   ___   | |
      |  \ \___/ /  |
       \  '.___.'  /
        '._______.'`),
  },
  // The Flamethrower endo (a Special Delivery skin of an endoskeleton): a welding mask with a long glass
  // visor and blue eyes behind it, two fuel tanks on its back, and the flamethrower.
  end: {
    scare: art(String.raw`
       .-------.
      |[O_____O]|
      |  =====  |
       '-+-+-+-'
  [#]___|     |____[######>~~~~~~
  [#]   |_____|
        /     \
       /       \ `),
  },
  // ----- the second batch -----
  nfx: {
    cam: art(String.raw`
/\_/\
(O O)
 VVV`),
    // Inside your office he's drawn bigger the closer he gets (see NFOXY_STAGES below).
    near1: art(String.raw`
/\_/\
(o o)
 vvv`),
    near2: art(String.raw`
 /\_/\
( O O )
 \VVV/
 /   \ `),
    near3: art(String.raw`
  /\     /\
 /  \___/  \
|  (O) (O)  |
|   VVVVV   |
 \  ^^^^^  /
  '-------'`),
    scare: art(String.raw`
   /\               /\
  /  \_____________/  \
 |   ___       ___     |
 |  (_O_)     (_O_)    |
 |         ^           |
 |  VVVVVVVVVVVVVVVVV  |
 |  ^^^^^^^^^^^^^^^^^  |
J \___________________/`),
  },
  fun: {
    cam: art(String.raw`
 [_]
(o^o)
/|=|\ `),
    bonbon: art(String.raw`
/\/\
(oo)`),
    // BonBon at the other door, seen only in the flashlight.
    door: art(String.raw`
 /\  /\
(  oo  )
 ( -- )`),
    scare: art(String.raw`
       _____
      |_____|
   .-'       '-.
  /   O     O   \
 |       ^       |
 |   \_______/   |
  \             /
   '-----------'   /\/\
        >=<        (oo)`),
  },
  chi: {
    cam: art(String.raw`
 \|/
(o>o)
|EAT|`),
    // Her bib really says LET'S EAT!!! (three exclamation marks); "LET'S PARTY" is Toy Chica's.
    scare: art(String.raw`
       \ | /
     .-------.
    /  O   O  \
   |    /\     |
   |    \/     |
    \  _____  /
     '-------'
   |LET'S EAT!!!|
   '------------'`),
  },
  plu: {
    office: art(String.raw`
(\/)
(oo)`),
    scare: art(String.raw`
    (\      /)
     \\    //
    .-'----'-.
   /  O    O  \
  |     /\     |
  |   \VVVV/   |
   '----------'`),
  },
  nch: {
    cupcake: '{w}',
    // Watching from the top of your office while her cupcake is hidden (a reminder to go find it).
    office: art(String.raw`
  \ | /
.-------.
|@     @|
| /VVV\ |
| \^^^/ |
'-------'`),
    scare: art(String.raw`
      \ | | /
    .---------.
   /  @     @  \
  |    /\_/\    |
  |   /VVVVV\   |
  |   \^^^^^/   |
   \           /
    '---------'
     {w}   {w}`),
  },
  // ----- the third batch -----
  tbo: {
    scare: art(String.raw`
     /\         /\
    /  \       /  \
    |   \_____/   |
    /             \
   |   (^)   (^)   |
   |  *    o    *  |
   |    \_____/    |
    \             /
     '-----------'
         >w<`),
  },
  tch: {
    scare: art(String.raw`
        \  |  /
      .---------.
     /  ^     ^  \
    |     /\      |
    |     \/      |
     \  '-----'  /
      '---------'
      | PARTY!! |
      '---------'`),
  },
  // Nedd Bear: his red hat on a spring, crossed green eyes, and a long red striped tie.
  ned: {
    scare: art(String.raw`
          .---.
          |___|
            S
    .-.         .-.
   (   )_______(   )
    '-'         '-'
    /   O     O   \
   |      ___      |
   |     (___)     |
   |    \_____/    |
    \_____________/
          |\/|
           \/`),
  },
  wti: {
    scare: art(String.raw`
   /\               /\
  /  \_____________/  \
  |  |   |  |  |   |  |
  |    (O)     (O)    |
  | ---     /\    --- |
  | ---  \______/ --- |
   \   |VVVVVVVVVV|  /
    \__|^^^^^^^^^^|_/`),
  },
  rbw: {
    // Chasing your pointer: a small smiling rainbow.
    chase: art(String.raw`
 .-~~~-.
( ^ v ^ )
 ~~~~~~~`),
    scare: art(String.raw`
       .-~~~~~~~~~-.
     .'  .-~~~~~-.  '.
    /  .'  .---.  '.  \
   |  /   / O O \   \  |
   | |   |   v   |   | |
   | |    \_____/    | |
   ~~~~~~         ~~~~~~`),
  },
  rsb: {
    scare: art(String.raw`
     /\         /\
    |  |       |  |
    |  |       |  |
     \  \_____/  /
     /           \
    |   O     O   |      __
    |      w      |     /  )
    |  |\/\/\/\|  |____/__/
     \___*___*___/   ====#`),
  },
  tsp: {
    scare: art(String.raw`
  ~  /\    ~    /\   ~
    |  |       |  |
  ~  \  \_____/  /  ~
     /           \
    |   @     @   |  ~
  ~ |      .      |
    |  |\/\/\/\|  |  ~
     \___________/
   ~   ~  ~ ~  ~   ~`),
  },
  ffx: {
    scare: art(String.raw`
   /\               /\
  /  \_____________/  \
  |    *         *    |
  |   (O)       (O)   |
  |         ^         |
  |   \___________/   |
   \     SHOWTIME    /
    '---------------'`),
  },
  // Foxy: Withered Foxy's drawings without the eyepatch (see below the SPRITES list), plus his own
  // jumpscare.
  fox: {
    scare: art(String.raw`
   /\               /\
  /  \_____________/  \
  |                   |
  |   ( o )   ( o )   |
  |         /\        |
  |   |\/\/\/\/\/\|   |
   \  |/\/\/\/\/\/|  /
J__ \_____________/`),
  },
  twf: {
    // Digging up out of the floor on CAM 7: his head and claws.
    cam: art(String.raw`
/\_/\
(x o)
/vVv\ `),
    scare: art(String.raw`
   /\     ___     /\
  /  \___/   \___/  \
  |   (X)     (o)   |
  |   _/\_/\_/\_    |
  |  |VVVVVVVVVVV|  |
  |  |^^^^^^^^^^^|  |
   \_/ \  / \  / \_/
  ##################`),
  },
  // ----- the fourth batch -----
  // Phantom Foxy: Foxy, burnt crimson, with white eyes (one just a pinprick in an empty socket) and no
  // hook: in FNAF 3 his right forearm is gone. He's only ever seen in a doorway.
  pfx: {
    door: art(String.raw`
/\    /\
| \__/ |
|( ) O |
|  /\  |
||\/\/||
 \/\/\/
  \__/`),
    scare: art(String.raw`
   /\               /\
  /  \_____________/  \
  |  .   .  .   .  .  |
  |   ( . )   ( O )   |
  |         /\        |
  |   |\/\/\/\/\/\|   |
   \  |/\/\/\/\/\/|  /
    \_____________/`),
  },
  // Security (FNaF World: Halloween Edition): a robot with a camera for a head. He flickers in the
  // corner of the camera he just switched you to.
  sec: {
    cam: art(String.raw`
  o
[(@)]
 /#\ `),
  },
  // Lolbit's face on the LOL screen (index.html shows it with the letters to type).
  lol: {
    face: art(String.raw`
   /\         /\
  /  \_______/  \
 |   (o)   (o)   |
 |       v       |
  \  \_______/  /
   '-----------'`),
  },
  // Piranha Plushtrap: in his tank on CAM 3 (render.js draws the tank around him), and his jumpscare.
  pir: {
    tank: art(String.raw`
.~~~~~~~~~.
|(\/)     |
|{oo}   ~ |
'---------'`),
    scare: art(String.raw`
     (\        /)
      \\  __  //
    .-'--'  '--'-.
   /   O      O   \
  |  /VVVVVVVVVV\  |
  |  \^^^^^^^^^^/  |
   '--------------'
      ~  ~  ~  ~`),
  },
  // The Mop bucket in a hall. Officially Bucket Bob (Pizzeria Simulator): a silver bucket for a head with a
  // scribbled face, a body of broomsticks, and blue checkered oven mitts (the %).
  mop: {
    cam: art(String.raw`
.---.
|o~o|
%/|\%`),
  },
};
// Foxy's camera and doorway drawings are Withered Foxy's with both eyes: every '#' (the eyepatch) swapped
// for 'o'.
for (const pose of ['peek', 'half', 'run', 'door']) SPRITES.fox[pose] = SPRITES.wfx[pose].map(line => line.replace(/#/g, 'o'));
// (.map makes a new list, so the copies above don't have Withered Foxy's accent mask; the doorway ones
// get their own masks in "accent colors" below.)

// The shopkeeper on the SHOP tab: a staff bot with a monocle (on request).
const SHOPKEEPER = art(String.raw`
 .-------.
 | o  (@)|
 |  ___  |
 '-------'
  /|$$$|\ `);
// Nightmare Foxy inside your office, stage by stage: which drawing, its top-left [row, column], and
// `aim`, the middle of the drawing (where the flashlight has to be to push him back).
const NFOXY_STAGES = {
  1: { lines: SPRITES.nfx.near1, at: [12, 16], aim: [13, 18] },
  2: { lines: SPRITES.nfx.near2, at: [10, 15], aim: [11.5, 18] },
  3: { lines: SPRITES.nfx.near3, at: [8, 12], aim: [10.5, 18] },
};
// Golden Freddy's jumpscare: Freddy's, with his O eyes swapped for dots. (.map makes a new list with
// every line changed; .replace(/O/g, '.') swaps every capital O on the line for a dot.)
SPRITES.gol.scare = SPRITES.fre.scare.map(line => line.replace(/O/g, '.'));

// ---------- accent colors ----------
// A few characters got a second color on parts of their drawings first (on request: Funtime Freddy, White
// Tiger's heterochromia (two different eye colors), the Magic Rainbow, "and any more you see fit, but
// use sparingly"). On 2026-11-08 every character was checked against the official designs (on request),
// and most got their real eye colors, hats, bow ties and so on this way.
// A MASK is a copy of a drawing's shape, attached as drawing.accent. Each letter in it colors the
// character in the same place in the drawing (the colors are the acc-... classes in style.css); a space
// leaves it in the character's main color. sprite() reads the mask, so the color shows wherever the
// drawing is used.
const ACCENT = {
  r: 'acc-red', o: 'acc-orange', y: 'acc-yellow', g: 'acc-green', b: 'acc-blue', v: 'acc-violet',
  p: 'acc-pink', k: 'acc-gold', c: 'acc-sky', l: 'acc-lime', B: 'acc-bonbon', x: 'acc-black',
  w: 'acc-white', G: 'acc-grey',
};
// The Nightmare staff bot, black and white (on request): a black body and head, his face in white.
// (His caution cone on the desk stays caution orange: see c-caution in render.js.)
SPRITES.stf.scare.accent = art(String.raw`
        xxxxxxxxx
       x         x
      x           x
      x           x
      x           x
      x           x
       xxxxxxxxxxx
          xxxxx
      xxxxxxxxxxxxx
     x    xxxxx    x`);
// Funtime Freddy: a small BLACK top hat and bow tie (not pink), blue eyes, BonBon in her blue.
SPRITES.fun.cam.accent = art(String.raw`
 xxx
 b b
  x`);
SPRITES.fun.scare.accent = art(String.raw`
       xxxxx
      xxxxxxx

      b     b



                   BBBB
        xxx        BBBB`);
// The rest were added when every drawing was checked against the official designs (2026-11-08, on
// request). Freddy: black top hat and bow tie, blue eyes. Golden Freddy: the same hat and bow tie.
SPRITES.fre.scare.accent = art(String.raw`
        xxxxxxx
       xxxxxxxxx
     xxxxxxxxxxxxx



         b   b





          xxx`);
SPRITES.gol.scare.accent = SPRITES.fre.scare.accent.map(line => line.replace(/b/g, ' '));
// Bonnie: magenta eyes, red bow tie. Toy Bonnie: green eyes, rosy cheeks, red bow tie.
SPRITES.bon.scare.accent = art(String.raw`






        p     p




          rrrr`);
SPRITES.tbo.scare.accent = art(String.raw`




        g     g
      r         r



         rrr`);
// Chica: violet eyes, orange beak. Toy Chica: blue eyes, orange beak. Phantom Chica: white pinprick eyes.
SPRITES.chi.scare.accent = art(String.raw`


       v   v
        oo
        oo`);
SPRITES.tch.scare.accent = art(String.raw`


        b     b
          oo
          oo`);
SPRITES.pch.scare.accent = art(String.raw`


       w   w`);
// The foxes' eyes: Foxy yellow (and gold teeth), Withered Foxy yellow, Nightmare Foxy orange, Funtime Foxy
// yellow, Twisted Foxy red, Phantom Foxy white.
SPRITES.fox.scare.accent = art(String.raw`



        y       y

       kkkkkkkkkkk
       kkkkkkkkkkk`);
SPRITES.wfx.scare.accent = art(String.raw`



                 y`);
SPRITES.nfx.scare.accent = art(String.raw`



      o         o`);
SPRITES.ffx.scare.accent = art(String.raw`



       k         k`);
SPRITES.twf.scare.accent = art(String.raw`


       r       r`);
SPRITES.pfx.door.accent = art(String.raw`


     w`);
SPRITES.pfx.scare.accent = art(String.raw`



        w       w`);
// Nightmare Freddy: orange eyes. Nightmare Chica: one red eye. Withered Bonnie: a red pinprick eye.
// Bonnet: green eyes.
SPRITES.nfr.scare.accent = art(String.raw`



         o       o`);
SPRITES.nch.scare.accent = art(String.raw`


            r`);
SPRITES.wbn.scare.accent = art(String.raw`






         r`);
SPRITES.bnt.scare.accent = art(String.raw`



     g     g`);
// Nedd Bear: red hat on a grey spring, green eyes, red tie. The endo: blue eyes behind the visor, grey
// fuel tanks, orange flames. Sleepy Moon: a big red grin.
SPRITES.ned.scare.accent = art(String.raw`
          rrrrr
          rrrrr
            G



        g     g




          rrrr
           rr`);
SPRITES.end.scare.accent = art(String.raw`

        b     b


  GGG                      oooooo
  GGG`);
SPRITES.mon.scare.accent = art(String.raw`




            rrr
           rrrrr`);
SPRITES.wti.scare.accent = art(String.raw`



       ccc     lll`);
// The rainbow's bands: red outside, then yellow, then green around her face, with all six colors on the
// bits of cloud at the bottom.
SPRITES.rbw.scare.accent = art(String.raw`
       rrrrrrrrrrrrr
     rr  yyyyyyyyy  rr
    r  yy  ggggg  yy  r
   r  y   g     g   y  r
   r y   g       g   y r
   r y    ggggggg    y r
   roygbv         vbgyor`);
// The Puppet: purple tear stripes, red cheeks and red lips.
SPRITES.pup.scare.accent = art(String.raw`



         v     v
        rrr   rrr

          rrrrr
          rrrrr`);
// Security: a grey camera head with a yellow lens (his antenna and body are his main red).
// Piranha Plushtrap: orange piranha fin-ears and neon blue eyes.
SPRITES.sec.cam.accent = art(String.raw`

GGyGG`);
SPRITES.pir.tank.accent = art(String.raw`

 oooo
  cc`);
SPRITES.pir.scare.accent = art(String.raw`
     oo        oo


       c      c`);
// Rockstar Bonnie: green eyes, a red guitar, gold star buttons.
SPRITES.rsb.scare.accent = art(String.raw`





        g     g          rr
                        r  r
                       rrrr
         k   k`);
// The Mop bucket (Bucket Bob): blue mitts.
SPRITES.mop.cam.accent = art(String.raw`


b   b`);
// The smaller drawings: Bonnie and the foxes in the doorway, faces on the cameras, Nightmare Freddy in
// the office, Sleepy Moon's grin.
SPRITES.bon.door.accent = art(String.raw`




  p  p



  rrrr`);
SPRITES.bon.cam.accent = ['', ' p p'];
SPRITES.fox.door.accent = art(String.raw`


  y  y`);
SPRITES.wfx.door.accent = art(String.raw`


     y`);
SPRITES.chi.cam.accent = ['', ' vov'];
SPRITES.nfx.cam.accent = ['', ' o o'];
SPRITES.twf.cam.accent = ['', ' r r'];
SPRITES.mon.cam.accent = ['', '  r'];
SPRITES.nfr.office.accent = art(String.raw`


    o     o`);

// Passing out from the heat: a woozy face in heat waves (shown instead of a jumpscare).
const PASSED_OUT = art(String.raw`
    ~   ~   ~   ~   ~
  ~    .-------.    ~
     /  x     x  \
 ~  |      o      |  ~
     \   _____   /
  ~    '-------'    ~
    ~   ~ z Z ~   ~`);

// ---------- the office ----------
// The middle of the office: 36 wide and 16 tall. A poster and kids' drawings on the wall,
// the desk with the monitor in the middle, and the floor. The staff bot, the fan, Freddles,
// cupcakes and visitors are drawn on top of this by render.js.
const OFFICE_ART = art(String.raw`
____________________________________
 .--------.          .-----------.
 | SMILE! |          | o  ^  #  ~ |
 |  (^-^) |          | /|\ /\ (_) |
 '--------'          '-----------'

           .-------------.
           | .---------. |
           | |         | |
           | '---------' |
  _________'-------------'_________
 |                                |
 |________________________________|
   ||                          ||
. . . . . . . . . . . . . . . . . .
 . . . . . . . . . . . . . . . . . .`);

// Where things go in the office, as [row, column] of their top-left corner.
const STAFF_SPOT = [6, 2];        // the staff bot's caution cone, on the left end of the desk
const FAN_SPOT = [7, 28];         // the desk fan, on the right
const GOLDEN_SPOT = [3, 11];      // Golden Freddy, slumped in front of the monitor (covering it exactly)
const WITHERED_SPOT = [3, 12];    // Withered Bonnie, leaning over the desk
const NIGHTMARE_SPOT = [2, 10];   // Nightmare Freddy, looming over everything
const SCREEN_SPOT = [8, 14];      // the monitor's screen: 9 characters wide
const NCHICA_SPOT = [0, 12];      // Nightmare Chica, peering in at the top of the office
const BONNET_ROWS = [12, 14];     // Bonnet runs along the floor, between these rows
const VENT_SPOT = [5, 28];        // the duct vent into the office (whoever is at the front peeks out)
const SHOWTIME_SPOT = [5, 12];    // Funtime Foxy's SHOWTIME countdown, above the monitor

// The fan's blades in four positions; render.js shows one after another while the fan is on.
const FAN_BLADES = ['--', '\\|', '||', '|/'];

// The office for this moment, as a grid (without the visitors: render.js adds those).
function officeGrid(now) {
  const g = grid(OFFICE_ART, 36);
  // The fan: spinning blades while it's on, still blades while it's off.
  const blades = G.fan ? FAN_BLADES[Math.floor(now / 70) % 4] : '--';
  sprite(g, FAN_SPOT[0], FAN_SPOT[1], [' .--. ', `( ${blades} )`, " '||' "], G.fan ? 'fan on' : 'fan');
  // On nights with duct crawlers there's a vent grille, glowing red while the heater is on.
  if (DUCT_CRAWLERS.some(c => G[c.id].level > 0)) write(g, ...VENT_SPOT, '[####]', G.heater ? 'heater on' : 'dim');
  return g;
}

// ---------- the DUCTS tab ----------
// The duct map, 40 x 11 like a camera picture: 3 rows of 3 boxes, 12 wide and 3 tall, each with its
// name in the top border. Inside: the first letter of whoever is there (B Toy Bonnie, C Toy Chica,
// N Nedd Bear) and <)) where the audio lure is playing. Every cell of a box carries "duct d-d5" (and so
// on) so a click anywhere in it knows which room it was (input.js).
const DUCT_LETTER = { tbo: 'B', tch: 'C', ned: 'N' };
function ductGrid() {
  const g = blank(40, 11);
  for (const id of DUCT_ORDER) {
    const { r, c } = DUCTS[id];
    const top = 1 + r * 3, left = 2 + c * 12;   // where this box starts
    const name = id === DUCT_FRONT ? 'VENT' : id.toUpperCase();
    const lines = ['+-' + name + '-'.repeat(8 - name.length) + '-+', '|' + ' '.repeat(10) + '|', '+' + '-'.repeat(10) + '+'];
    const cls = `duct d-${id}` + (id === DUCT_FRONT ? ' c-stf' : ' dim');
    lines.forEach((line, i) => write(g, top + i, left, line, cls));
    let col = left + 2;
    if (G.lureRoom === id) { write(g, top + 1, left + 6, '<))', `duct d-${id} lure`); }
    for (const cr of DUCT_CRAWLERS) {
      if (G[cr.id].level > 0 && G[cr.id].room === id) { write(g, top + 1, col, DUCT_LETTER[cr.id], `duct d-${id} c-${cr.id}`); col += 2; }
    }
    // The inside of the box is clickable too (spaces need the class as well).
    for (let k = 1; k <= 10; k++) if (!g[top + 1][left + k].cls) g[top + 1][left + k].cls = `duct d-${id}`;
  }
  write(g, 10, 2, 'YOU are past the VENT (bottom right).', 'dim');
  return g;
}
