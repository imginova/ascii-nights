/* =====================================================================
   config.js: the numbers you can tweak to change how the game FEELS.

   Nothing here does anything by itself; other files read these values.
   Want longer nights, cheaper doors or a lazier music box? Change a
   number here, save, and reload the page.

   Names in ALL_CAPS are a common way of saying "this is a setting that
   never changes while the game runs". Settings that depend on a
   character's level are small functions: byLevel(level, at1, at20)
   (in helpers.js) slides from the level-1 value to the level-20 value.
   ===================================================================== */

// ---------- the clock ----------
const HOUR_SECONDS = 30;   // real seconds per in-game hour (a whole night lasts 3 minutes)
const NIGHT_HOURS = 6;     // 12 AM to 6 AM

// ---------- power ----------
// Everything that uses power drains the same amount (on request): the monitor, each closed door,
// the flashlight and the fan each cost UNIT_DRAIN % per second while in use. The mask is free.
// (It was 0.5. With 17 characters, checking the cameras for everyone used more power than the battery
// holds, so the biggest challenges couldn't be won; the owner chose 0.35 for everything.)
const UNIT_DRAIN = 0.35;
const POWER_OUT_WAIT = [5, 13];   // seconds of darkness after a power-out before something gets you

// ---------- difficulty levels (custom night) ----------
const MIN_LEVEL = 0;       // level 0 switches a character off for the night
const MAX_LEVEL = 20;

// Keeps any number inside 0..20 and makes it a whole number.
// Used whenever we load or change a level, so a bad value can never sneak in.
const clampLevel = n => Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(Number(n) || MIN_LEVEL)));

// How hard each level really plays (on request: easier, so that even All 20 stays humanly possible
// when more characters are added later). Level 0 stays off and level 1 stays level 1, but every step
// above 1 only counts LEVEL_SCALE of a step: with 0.5, level 20 plays like level 10.5.
// Everything a level controls goes through this (newGame in game.js turns each level into its
// "playing" level). The setup screen, the score and the challenges still use the real level.
// (0.6 with 12 characters; lowered to 0.5 when the second batch made it 17.)
const LEVEL_SCALE = 0.5;
const effLevel = level => level === 0 ? 0 : 1 + (level - 1) * LEVEL_SCALE;

// Crowded nights. Every character acts every so often even at level 1, so with lots of them on at once
// there's no time left to react to each one. So the more characters are on tonight, the slower they all
// act: with up to CROWD_CALM on, at full speed; above that, at sqrt(CROWD_CALM / how many) of it (with
// 29 on and CROWD_CALM 12, about 64%). Only their timers slow down: the time you get to react (shut the
// door, put the mask on...) stays the same. (Added 2026-11-07 with the third batch: the bot showed 29
// characters at level 8 were won 11 times in 40, and the 17 older ones alone 31 times.)
const CROWD_CALM = 12;
const crowdPace = count => Math.min(1, Math.sqrt(CROWD_CALM / Math.max(1, count)));

// A character at level L gets a chance to act every so often, and each chance works L times in 20.
const moveChance = level => level / 20;

// Seconds you get to react once something is at your door or in your office
// (shut the door, put on the mask...): 4.0 s at level 1 down to 2.9 s at level 20.
const reactWindow = level => byLevel(level, 4.0, 2.9);

// ---------- the flashlight ----------
// It lights up a patch around the mouse pointer and "flashes" whatever is inside it.
// The patch is measured in characters of the ASCII picture: BEAM_COLS across and BEAM_ROWS up/down
// from the pointer (a character is about twice as tall as it is wide, so fewer rows than columns).
const BEAM_COLS = 5;
const BEAM_ROWS = 2.5;

// ---------- Freddy ----------
const FREDDY_INTERVAL = 6;   // seconds between his chances to move (and laugh)
const FREDDY_LAUGHS = 3;     // the 3rd laugh means he's at the right door

// ---------- Bonnie ----------
const BONNIE_INTERVAL = 5;   // seconds between his chances to move a room closer

// ---------- Golden Freddy ----------
// The chance he's sitting in your office when you flip the monitor down, and how long you get
// to tap the mask on.
const goldenChance = level => byLevel(level, 0.03, 0.35);
// (Raised from 2.0-1.2 s after Moon's rework: hunting him means more monitor flips, so more chances
// for Golden Freddy, and the bot test showed slower players too often couldn't make 1.2-1.5 s.)
const goldenWindow = level => byLevel(level, 2.3, 1.6);

// ---------- Phantom Chica ----------
// The chance she shows up when you flip the monitor down (every flip at level 20, on request),
// how many shadow cupcakes you must click (1, 2 or 3 by level), how long you have, and what
// failing costs you: a jumpscare and 10% of your power (not the night).
const chicaChance = level => level / 20;
// (Written with effLevel so it's still 1 cupcake for levels 1-7, 2 for 8-13 and 3 for 14-20.)
const cupcakeCount = level => level < effLevel(8) ? 1 : level < effLevel(14) ? 2 : 3;
// Her time limit grows with the number of cupcakes: 2 seconds, plus 2.5 per cupcake at level 1 down
// to 1.6 per cupcake at level 20. (It used to be one time for any number of cupcakes, 3.5 s at level
// 20, which the bot test showed was too short for a person to find 3.)
const chicaTime = (level, cups) => 2 + cups * byLevel(level, 2.5, 1.6);
const CHICA_COST = 10;

// ---------- Bonnet ----------
// Seconds between her runs (a random time in this range), how long a run across the office takes,
// and how fast she dodges away from your mouse pointer (in characters per second).
// She dodges, but slower than a person can move a mouse, so you can always catch her.
const bonnetWait = level => rand(byLevel(level, 45, 14), byLevel(level, 70, 24));
const bonnetTime = level => byLevel(level, 7, 4);
const BONNET_DODGE = 7;

// ---------- Withered Bonnie ----------
// His appearance timer is a random time in this range. With the monitor up the timer keeps
// counting but can't reach 0: he only appears once you flip it down.
const witheredWait = level => rand(byLevel(level, 30, 12), byLevel(level, 54, 22));
const MASK_HOLD = 2.0;       // seconds of mask that send him away (taking it off early restarts it)

// ---------- the Puppet's music box ----------
// % per second the box unwinds: 0.8 at level 1 (about 2 minutes from full) up to 3.2 at level 20
// (about 31 seconds). One tap of Wind winds it all the way back to 100%, however low it was
// (on request; it used to add 25% per tap).
const boxDrain = level => byLevel(level, 0.8, 3.2);
const BOX_LOW = 35;          // below this, the warning symbol shows and a chime plays
const PUPPET_DELAY = 4.5;    // seconds from the box running out to the Puppet getting you

// ---------- the Nightmare staff bot ----------
// Seconds between its warnings, and how long you get to shut the door its arrow points to
// (a second more than usual, so you have time to look at the arrow).
const staffWait = level => rand(byLevel(level, 40, 12), byLevel(level, 60, 20));
const staffWindow = level => reactWindow(level) + 1;
const BLINK_EVERY = 0.5;     // seconds between its blinking beeps

// ---------- Nightmare Freddy ----------
// Seconds between new Freddles on the desk, how long the light must stay on one to send it off, and
// how long all 3 can sit there before he comes. Once he's come he stays for the rest of the night.
const freddleWait = level => byLevel(level, 24, 7) * rand(0.7, 1.3);
const FREDDLE_SHINE = 0.5;
const nightmareArrive = level => byLevel(level, 8, 4);

// ---------- Foxy and Withered Foxy ----------
// Foxy gets ready in Pirate Cove (a chance every FOXY_INTERVAL seconds, stalled while you're on the
// cameras) and runs to the left door. Withered Foxy used to do that; now (on request) he just turns up
// in the West hall every witheredFoxyWait seconds and runs from there. Both run for FOXY_RUN seconds.
const FOXY_INTERVAL = 5;     // seconds between Foxy's chances to get ready in Pirate Cove
const FOXY_RUN = 2.5;        // seconds from leaving the cove (or the West hall) to reaching the left door
const FOXY_DOOR_COST = 5;    // % power Foxy knocks out of the battery when he slams into the shut door
const witheredFoxyWait = level => rand(byLevel(level, 50, 18), byLevel(level, 75, 30));
const FOXY_WAIT = [3, 6];    // seconds he waits behind the shut door before the stomp
const FOXY_FLASH = 0.6;      // seconds of light (in all) it takes to send him away
const STOMP_EVERY = 3;       // seconds between stomps while he waits for you

// ---------- Sleepy Moon ----------
// Reworked on request: every so often (a random time in moonWait's range) he turns up on one of the
// cameras, and while he's out your sleep meter fills at moonRate % per second (from wide awake to
// asleep: about 60 s at level 1, about 18 s at level 20 after the level easing). Find him on the
// cameras and click him: he leaves and you wake right up. Nothing else keeps you awake any more.
const moonWait = level => rand(byLevel(level, 45, 15), byLevel(level, 70, 28));
const moonRate = level => byLevel(level, 1.6, 8);

// ---------- the office heat ----------
// The office slowly heats up all night, every night, whoever is on (on request): AMBIENT_HEAT % per
// second, so if you never used the fan you'd pass out at about 4:30 AM. While the fan is on it cools
// the office by FAN_COOL % per second instead. At 100% you pass out and the night is over.
// HOT_WARN: a heavy breath plays when the heat passes each of these, as a warning.
const AMBIENT_HEAT = 0.75;
const FAN_COOL = 6;
const HOT_WARN = [70, 85];

// ---------- the Flamethrower endo ----------
// Seconds between visits, how long a visit lasts, and how much faster the office heats up while
// he's there (% per second, on top of AMBIENT_HEAT). While he's there the fan can't cool the office:
// it only slows the heating down to FAN_SLOW of it.
const endoWait = level => rand(byLevel(level, 60, 20), byLevel(level, 90, 35));
const endoStay = level => byLevel(level, 10, 16);
const endoHeat = level => byLevel(level, 5, 11);
const FAN_SLOW = 0.25;

// ---------- Nightmare Foxy ----------
// He moves (silently!) from the Dining area into the West or East hall and then to that door, a
// chance every NFOXY_INTERVAL seconds. In a hall he always waits at least NFOXY_HALL_MIN seconds, so
// someone checking the cameras has time to shut the door. Once he's inside, every NFOXY_CREEP
// seconds he may creep one stage closer (3 stages; past the last one he gets you), and every
// NFOXY_PUSH seconds of flashlight on him push him back one stage. He never leaves (on request).
// (Interval 6 -> 7 s and hall wait 4 -> 6 s after the bot test: with every character on, the
// camera checks needed to catch him cost too much power.)
const NFOXY_INTERVAL = 7;
const NFOXY_HALL_MIN = 6;
const NFOXY_CREEP = 5;
const NFOXY_PUSH = 0.8;

// ---------- Funtime Freddy and BonBon ----------
// Seconds between his visits, and how long you get once he's made his sound: time to raise the
// monitor, find which hall he's in and see whether BonBon is on his hand. FUN_FLASH: seconds of
// light it takes to send BonBon away when she's at the other door.
const funWait = level => rand(byLevel(level, 50, 18), byLevel(level, 75, 30));
// (+4 s became +6 s, then +8 s, after bot tests: with lots going on, his several steps didn't fit.)
const funWindow = level => reactWindow(level) + 8;
const FUN_FLASH = 0.4;

// ---------- Chica ----------
// She walks Backstage -> Dining area -> West hall, slowly and without a sound: a chance every
// CHICA_INTERVAL seconds. From the West hall her next move gets you, but she always waits there at
// least CHICA_HALL_MIN seconds first, so checking the cameras gives you time. Clicking her on her
// camera sends her back one room.
// (9 -> 12 s and 5 -> 6 s after the bot test, for the same reason as Nightmare Foxy.)
const CHICA_INTERVAL = 12;
const CHICA_HALL_MIN = 6;

// ---------- Plushtrap ----------
// Seconds between his visits, and the short time you have to get any flashlight on him once he
// giggles (it takes no time at all for him to go).
const plushWait = level => rand(byLevel(level, 45, 15), byLevel(level, 70, 26));
const plushTime = level => byLevel(level, 3.5, 2.2);

// ---------- Nightmare Chica ----------
// Seconds between her visits, and how long you have to find her hidden cupcake on the cameras
// and click it.
const nchicaWait = level => rand(byLevel(level, 55, 20), byLevel(level, 80, 32));
// (20-12 s became 24-16 s after the bot test: searching every camera for something hidden takes a while
// when other things keep interrupting.)
const nchicaTime = level => byLevel(level, 24, 16);

// ======================= the third batch: systems =======================

// ---------- the ducts ----------
// Toy Bonnie, Toy Chica and Nedd Bear crawl through the ducts (a 3 x 3 map on the DUCTS tab) toward the
// front, the vent into your office. Each moves a room a chance every few seconds (its `interval` in
// data.js). The AUDIO LURE (click a duct room) isn't instant or sure (on request): on each move, a duct
// character heads toward the lure instead of the front with its own chance (its `lure` in data.js), and
// the lure only lasts LURE_TIME seconds. LURE_COOLDOWN: seconds before the next lure.
// The HEATER (Q): while it's on, every HEATER_STEP seconds each duct character is pushed one room back
// toward the start (on request: "sent back not immediately but quickly"). It uses power like everything
// else and heats the office HEATER_HEAT % per second on top of the normal heat.
const LURE_TIME = 8;
const LURE_COOLDOWN = 3;
const HEATER_STEP = 0.8;
const HEATER_HEAT = 2.5;
// At the front: Toy Bonnie needs the mask on within reactWindow (then he's sent back to the start).
// Toy Chica and Nedd Bear get you (on request: "straight away"), after frontWindow seconds so a lure or
// the heater still has a moment to pull them back.
const frontWindow = level => byLevel(level, 3, 2);

// ---------- Fazcoins and the shop ----------
// A coin turns up on a random camera every COIN_EVERY seconds (twice as long with Dee Dee) and stays
// there COIN_STAY seconds; click it to pick it up. Fending off a character in a clear way (a bonk, the
// mask working, a cupcake found...) also gives one. Every night starts at 0 coins (on request).
const COIN_EVERY = 10;
const COIN_STAY = 20;
const COINS_ON_CAMS = 3;     // at most this many coins lying around on the cameras at once
// The shop (the SHOP tab, run by a staff bot with a monocle):
const DEATH_COIN_COST = 15;  // removes any one character for the rest of the night
const DEATH_COINS = 3;       // how many can be bought per night
const BATTERY_COST = 5;      // +BATTERY_POWER % power
const BATTERY_STOCK = 5;
const BATTERY_POWER = 10;
// Rockstar Bonnie's guitar: the price depends on his level (on request).
const guitarCost = level => Math.round(byLevel(level, 5, 15));

// ======================= the third batch: characters =======================

// ---------- White Tiger ----------
// If you use any one thing without a break for longer than tigerLimit seconds (a door, the monitor, the
// flashlight, the fan or the mask) he jumpscares you and that thing stops working for TIGER_DISABLE
// seconds. It doesn't end the night. He leaves things alone when they must stay on (the fan while the
// endo is there, the left door while Withered Foxy waits, the mask with Nightmare Freddy in the room,
// the fan and doors while Toxic Springtrap's fumes are clearing).
const tigerLimit = level => byLevel(level, 20, 8);
const TIGER_DISABLE = 5;

// ---------- Chica's Magic Rainbow ----------
// Every so often she appears (over the office or the cameras) and chases your mouse pointer, a bit
// slower than you can move it. Dodge her for RAINBOW_TIME seconds and she leaves; if she touches the
// pointer, you die. Her speed and how close counts as touching are in "view widths" (1 = the whole
// width of the game view).
const rainbowWait = level => rand(byLevel(level, 60, 20), byLevel(level, 90, 35));
const RAINBOW_TIME = 8;
const rainbowSpeed = level => byLevel(level, 0.3, 0.55);
const RAINBOW_CATCH = 0.035;

// ---------- Toxic Springtrap ----------
// Every so often his fumes fill the office (it turns purple) and a toxin meter rises toxinRate % per
// second. With the fan on AND both doors open, the air clears instead (TOXIN_CLEAR % per second); once
// it's back to 0 he gives up. At 100% you pass out and he gets you.
const toxicWait = level => rand(byLevel(level, 70, 25), byLevel(level, 100, 40));
// (3 to 7 % a second, cleared at 10, until the bot test: on busy nights a door often has to be shut.)
const toxinRate = level => byLevel(level, 2.5, 5.5);
const TOXIN_CLEAR = 12;

// ---------- Dee Dee ----------
// At the start of the night, with a chance of her level / 20, she takes one random character out of the
// night and gives every other one DEEDEE_BOOST more levels (past 20 if need be), and coins turn up half
// as often.
const DEEDEE_BOOST = 5;

// ---------- Funtime Foxy ----------
// A countdown in your office ("SHOWTIME"); when it reaches 0 the left door had better be shut. There's
// no other cue. Then it starts again with a new time.
const funFoxyWait = level => rand(byLevel(level, 45, 18), byLevel(level, 70, 30));

// ---------- Shadow Bonnie ----------
// Every so often the office and the cameras go dark for shadowTime seconds; the flashlight lets you see
// what it lights.
const shadowWait = level => rand(byLevel(level, 60, 25), byLevel(level, 90, 40));
const shadowTime = level => byLevel(level, 10, 20);

// ---------- Twisted Foxy ----------
// Every so often, gravelly noises: he's digging his way up out of the floor in the Prize Corner. Tap
// (click) him there twistTaps times before twistTime runs out.
// (twistTime was 10 to 6 s and twistTaps 3 to 7 until the bot test: with everyone on, there often isn't
// time to get to CAM 7 while other things need you.)
const twistWait = level => rand(byLevel(level, 55, 20), byLevel(level, 80, 32));
const twistTaps = level => Math.round(byLevel(level, 3, 6));
const twistTime = level => byLevel(level, 15, 10);
