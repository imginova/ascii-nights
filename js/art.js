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
function sprite(g, r, c, lines, cls) {
  lines.forEach((line, i) => {
    const row = g[r + i];
    if (!row) return;
    const first = line.search(/\S/), last = line.length - 1 - line.split('').reverse().join('').search(/\S/);
    if (first < 0) return;   // an empty line: nothing to draw
    for (let k = first; k <= last; k++) {
      if (row[c + k]) row[c + k] = { ch: line[k], cls };
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
const ICONS = {
  fre: [' [_] ', '(o^o)', ' >=< '],          // Freddy: top hat and bow tie
  bon: ['|\\ /|', '(o o)', ' >w< '],         // Bonnie: long ears
  gol: [' [_] ', '(.^.)', ' >=< '],          // Golden Freddy: Freddy, in gold, with dot eyes
  pch: [' \\|/ ', '(x o)', ' {V} '],         // Phantom Chica: burnt eye, beak and bib
  bnt: ['(\\_/)', '(o*o)', ' v v '],         // Bonnet: small, with her nose
  wbn: [' |\\  ', '(  o#)', ' |vv| '],       // Withered Bonnie: no face, one ear
  pup: ['.---.', '(o o)', '(@v@)'],          // the Puppet: mask with red cheeks
  stf: ['.---.', '|@ @|', '|VVV|'],          // the Nightmare staff bot: robot head, glaring eyes, jagged mouth
  nfr: ['@   @', '(0^0)', '|vVv|'],          // Nightmare Freddy: Freddles and sharp teeth
  wfx: ['/\\ /\\', '(# o)', ' \\vv/J'],      // Withered Foxy: eyepatch and hook
  mon: [' .-. z', '( -_-)', " '-'  "],       // Sleepy Moon: dozing
  end: ['<O_O>', '|=+=|~~', '/   \\'],       // the endo and its flamethrower
  nfx: ['/\\_/\\', '(O O)', ' VVV '],         // Nightmare Foxy: ears and a mouthful of teeth
  fun: ['[_]  /\\', '(o^o)(o)', ' >=<    '],  // Funtime Freddy with BonBon on his hand
  chi: [' \\|/ ', '(o>o)', '|EAT|'],          // Chica: beak and bib
  plu: ['(\\/)', '(oo)', ' || '],             // Plushtrap: a little rabbit plush
  nch: [' \\|/ ', '(@>@)', '{VVV}'],          // Nightmare Chica: teeth everywhere
};
// Which line of the icon is the face (the middle one, except for the endo, whose face is on top).
const FACE_ROW = { end: 0 };
// A text with every character escaped for HTML (see esc above).
const escText = s => Array.from(s).map(esc).join('');
// The 3-line icon as HTML, in the character's color.
const iconHtml = (c, extra = '') => `<span class="icon c-${c.id}${extra}" title="${c.name}">${ICONS[c.id].map(escText).join('\n')}</span>`;
// Just the face line, for places with room for only one line, like the "Best:" line.
// `??` means "use the right side if the left side is missing", so most characters get line 1.
const faceHtml = c => `<span class="face-mini c-${c.id}" title="${c.name}">${escText(ICONS[c.id][FACE_ROW[c.id] ?? 1])}</span>`;

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
  pch: {
    scare: art(String.raw`
       \ | /
     .-------.
    /  X   o  \
   |     /\    |
   |    /  \   |
   |    \__/   |
    \  #####  /
     '-------'
     | EAT!! |
     '-------'`),
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
  // The Nightmare staff bot (from Security Breach): a staff robot gone bad, with glaring eyes and a
  // jagged mouth (on request: it used to be drawn as a caution cone).
  stf: {
    // Drawn in the office by drawVisitors in render.js: while it blinks its eyes flash (line 1) and
    // its arm points at the door to shut (line 4, see STAFF_POINT).
    office: art(String.raw`
.---.
|@ @|
|VVV|
'-+-'
/|=|\ `),
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
  \__/ J`),
    scare: art(String.raw`
   /\               /\
  /  \_____________/  \
  |                   |
  |   ####     ( o )  |
  |   ####            |
  |         /\        |
  |   |\/\/\/\/\/\|   |
   \  |/\/\/\/\/\/|  /
    \_____________/ __J`),
  },
  mon: {
    // Small enough to hide in a corner of a camera picture: you have to look for him.
    cam: art(String.raw`
 .-. z
( -_)
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
  end: {
    scare: art(String.raw`
       .-------.
      | O     O |
      |  =====  |
       '-+-+-+-'
    ____|     |____[######>~~~~~~
        |_____|
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
  \___________________/  J`),
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
    scare: art(String.raw`
       \ | /
     .-------.
    /  O   O  \
   |    /\     |
   |    \/     |
    \  _____  /
     '-------'
     | EAT!! |
     '-------'`),
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
  |   \____/   |
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
};
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
const STAFF_SPOT = [5, 3];        // the staff bot, standing on the left end of the desk
// Its body line while it points at a door (it replaces line 4 of its drawing, starting one column
// further left for the left arm): [column offset, text].
const STAFF_POINT = { L: [-1, '<-|=|\\'], R: [0, '/|=|->'] };
const FAN_SPOT = [7, 28];         // the desk fan, on the right
const GOLDEN_SPOT = [3, 11];      // Golden Freddy, slumped in front of the monitor (covering it exactly)
const WITHERED_SPOT = [3, 12];    // Withered Bonnie, leaning over the desk
const NIGHTMARE_SPOT = [2, 10];   // Nightmare Freddy, looming over everything
const SCREEN_SPOT = [8, 14];      // the monitor's screen: 9 characters wide
const NCHICA_SPOT = [0, 12];      // Nightmare Chica, peering in at the top of the office
const BONNET_ROWS = [12, 14];     // Bonnet runs along the floor, between these rows

// The fan's blades in four positions; render.js shows one after another while the fan is on.
const FAN_BLADES = ['--', '\\|', '||', '|/'];

// The office for this moment, as a grid (without the visitors: render.js adds those).
function officeGrid(now) {
  const g = grid(OFFICE_ART, 36);
  // The fan: spinning blades while it's on, still blades while it's off.
  const blades = G.fan ? FAN_BLADES[Math.floor(now / 70) % 4] : '--';
  sprite(g, FAN_SPOT[0], FAN_SPOT[1], [' .--. ', `( ${blades} )`, " '||' "], G.fan ? 'fan on' : 'fan');
  return g;
}
