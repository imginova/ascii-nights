# ASCII Nights: project handoff

This file holds everything a new Claude session, or a person, needs to keep working on this project. Claude Code reads `CLAUDE.md` automatically when it starts in this folder. [`README.md`](README.md) is the beginner-friendly guide.

## What this is

**ASCII Nights** is a free, browser-based **FNAF fan game**: a single custom night drawn in ASCII art. It was made on 2026-11-02 as a separate project from *Bare Bones Custom Night* (`C:\git\bbcn`, repo `imginova/bbcn`). It reused that game's code layout, setup screen, sound engine and game loop, but none of BBCN's threats, ★ modifiers, modes, vents, ads, kill tally or analytics. The owner designed every character's mechanics.

- **Owner:** the `imginova` GitHub account (Jake Harris's son). They're new to programming, so explain changes in plain language and avoid jargon.
- **Folder:** `C:\git\ascii-nights`. **GitHub:** https://github.com/imginova/ascii-nights (public; the owner created it on 2026-11-03 and pushed the first commit).
- **Public website:** https://imginova.github.io/ascii-nights/ (GitHub Pages, redeployed on every push to `main`). Live since 2026-11-03: Pages was switched on (Settings → Pages → Source = GitHub Actions) and the link was added as the repo's About → Website. The very first deploy had failed only because Pages wasn't on yet.
- This Windows computer has no `gh` or Node.js; the GitHub API can be read with `curl` (for example `https://api.github.com/repos/imginova/ascii-nights/actions/runs`).

## Fan game rules (keep these)

- **It stays free.** No price, ads or donations: that's what keeps a FNAF fan game safe.
- **It must say it's a fan game.** The title screen and the top bar say so, along with "Not affiliated with Scott Cawthon or Five Nights at Freddy's". Don't remove that, and never name it as if it were an official FNAF game.
- **Nothing is copied from the real games.** The ASCII drawings, sounds and tunes are all original. Never paste in sprites, sound files, music (for example Freddy's real power-out song), the logo or word-for-word text from the games. The character names and looks are used on purpose (the owner asked for that).

## Working agreements with the owner

- **Make a plan before big features**, and ask about genuinely ambiguous design choices. Small requests can be done directly.
- **Commit only when asked.** After each change, ask "Commit these changes?". Commit as `imginova <107283216+imginova@users.noreply.github.com>` (run `git config user.email` on a new computer). No work email may appear in files or commits.
- **A harder challenge loses its ✓:** when a change makes a challenge harder (by itself or because a character in it got stronger), raise that challenge's `v` in `PRESETS`. Only the ones the change affects.
- **Never wipe saved progress.** The only saved ✓s the game may drop are older versions of a challenge whose `v` went up (`outdated` in `game.js`). Everything else in `store` stays, even what this version doesn't recognise.
- **Every challenge must stay humanly possible** (on request, 2026-11-03: "not just beatable but humanly possible"). When a character is added or made stronger, re-run the human-limits bot (see "Balance") on every challenge and re-tune (`LEVEL_SCALE` or the character's numbers) until a person could still win each one, All 20 included. The owner is fine with re-tuning each time characters are added, rather than leaving room for them in advance.
- **Keep the split by job and keep the comments.** New code goes in the file whose job it matches, commented in the same beginner-friendly style (explain *why*, define jargon the first time).

## Gameplay

- **The night:** 12 AM to 6 AM, 30 real seconds per hour (`HOUR_SECONDS`).
- **Power:** starts at 100%. The monitor, each closed door, the flashlight and the fan each drain `UNIT_DRAIN` (0.5%/s). The mask is free and nothing drains while idle. At 0%: doors open, everything shuts off and, after 5–13 s, **Sleepy Moon** gets you if he's on tonight; otherwise **Freddy** does.
- **Flashlight** (on request): it lights an oval around the mouse pointer (`BEAM_COLS` 5 × `BEAM_ROWS` 2.5 characters) and "flashes" what's inside. Hold `F`, the **right mouse button** or the Flashlight button. Needs the monitor down. `aim` (in `game.js`, filled in by `updateAim` in `input.js`) says which picture the pointer is over (`'L'`, `'office'`, `'R'`) and which character cell. `beamOn(r, c)` and `beamOnDoor(side)` are the hit tests. A shut door blocks the light.
- **Mask:** `W` in the office, or the button. It can't be worn with the monitor up, and the monitor can't be raised with it on. It covers the view except for two eye holes (an SVG), and clicks only go through the holes.
- **Controls:** `A`/`D` doors, `Space`/`S` monitor, `1`–`7` cameras, `W` mask (office) or wind (CAM 7), `E` fan, `F` flashlight, `P`/`Esc` pause, `M` mute.
- **Cameras:** 7 new rooms (`ROOMS`, `ROOM_ART`): Show stage, Dining area, Backstage, Pirate cove, West hall, East hall, Prize corner. The map layout is in `.map` in `style.css`.

### The characters (each 0–20; 0 = off; a chance to act works L times in 20)

Every level plays easier than its number: `effLevel(level)` in `config.js` is `1 + (level − 1) × LEVEL_SCALE` (0.6), so level 20 plays like 12.4 and level 1 is unchanged. `levelOf` in `game.js` applies it to every character in `newGame`; the setup screen, score and challenge matching use the real levels. `cupcakeCount` is written with `effLevel` so the cupcake numbers still go 1 / 2 / 3 at levels 1–7 / 8–13 / 14–20.

| Character | Rules as built (`game.js`) |
|---|---|
| Freddy | Every `FREDDY_INTERVAL` s he may move; each move plays `sfx.laugh(n)`. Never on cams or in the doorway. After the 3rd laugh he's at the right door: shut it within `reactWindow` for a bonk (count resets) |
| Bonnie | `BONNIE.routes`: Stage → Dining → Backstage → West hall → L, or Stage → Dining → East hall → R. On cams (`BONNIE_SLOTS`) and in the doorway. Shut the door: bonk, back to the stage |
| Golden Freddy | When you lower the monitor (`lookedBack`), a `goldenChance` he's in the office. Mask on within `goldenWindow` (one tap) |
| Phantom Chica | When you lower the monitor, a `chicaChance` (playing level / 20, so about 62% of flips at level 20) she appears with `cupcakeCount` (1/2/3) shadow cupcakes `{^}` at random `CUPCAKE_SPOTS`. Click them all within `chicaTime`, or a mini jumpscare costs `CHICA_COST` (10%) power, but not the night |
| Bonnet | On a `bonnetWait` timer she runs along the floor (`BONNET_ROWS`) across the office in `bonnetTime`. Click her nose (`.bnt-nose`) to boop her away. She dodges the pointer up/down, or forward if it's behind her (never backwards), at `BONNET_DODGE`, so coming at her from the front works |
| Withered Bonnie | `witheredWait` timer keeps counting with the monitor up but only fires once it's down. Mask on within `reactWindow`, held `MASK_HOLD` (2 s); taking it off early restarts |
| The Puppet | Box on CAM 7 drains `boxDrain`. One tap of Wind (or `W` on CAM 7, key repeats ignored) winds it straight back to 100%, however low it was (on request, 2026-11-03; it used to add 25% per tap). Below `BOX_LOW` a blinking ♪! shows on the Camera button and on CAM 7's map button. Empty: tune, then death after `PUPPET_DELAY` |
| Nightmare staff bot | Sits on the desk. On a `staffWait` timer it beeps (`sfx.blink(side)`) and shows `<<<`/`>>>`. Shut that door within `staffWindow` (reaction + 1 s) for a bonk. If that door is already shut when it starts, it waits (`stalled`) until you open it, then you get a fresh window. Shutting the other door does nothing |
| Nightmare Freddy | Freddles `(oo)` appear on `FREDDLE_SPOTS` every `freddleWait`. Keeping the flashlight on one for `FREDDLE_SHINE` removes it. All 3 for `nightmareArrive` s → he comes: mask on within `reactWindow` and keep it on `NIGHTMARE_HOLD` (5 s). Mask off while he's there = death |
| Withered Foxy | `phase`: `cove` (stages 0 shut, 1 peek, 2 half out; CAM 4) → `run` (CAM 5, `FOXY_RUN` s) → `door` (shut in time) → `wait` (`FOXY_WAIT`; opening now sends him back to `door`) → `ready` (stomps every `STOMP_EVERY`) → open → `open` (flash him for `FOXY_FLASH`) → `flashed` → shut → back to the cove. Shutting before the flash puts him back to `wait` |
| Sleepy Moon | `sleep` meter fills at `moonRate` while the monitor is down and the flashlight off, and drains at `MOON_WAKE` otherwise. The view darkens (`#sleepShade`), yawns at 50% and 80%, death at 100%. He's the power-out killer when on |
| Flamethrower endo | On an `endoWait` timer he stays `endoStay` s and adds `endoHeat` %/s to the office heat (below); while he's there the fan can't cool, only slows the rise to `FAN_SLOW` (0.25). Flames along the office floor. If the heat hits 100% while he's there, he gets the blame (`lose(ENDO)`) |

**Office heat** (on request, 2026-11-03: "have heat not just be a thing for endo"): `G.heat` rises `AMBIENT_HEAT` (0.75 %/s) on **every** night, whoever is on, so with no fan at all you pass out about 4:30 AM. The fan cools it by `FAN_COOL` (6 %/s) when the endo isn't there. A heavy breath (`sfx.hot`) at each `HOT_WARN` mark (70%, 85%). At 100%: `passOut()` in `game.js`, a game over with the `PASSED_OUT` drawing (`art.js`), the `sfx.faint` sound and no shake (`showScare(..., false)`). It's not a character, so it has no kill count or level. The HEAT meter shows every night; the red glow (`#heatGlow`) only starts at 70% (`HOT_WARN[0]`, on request) and is full by 90% (`GLOW_FULL` in `render.js`, on request, so it's solid red before you pass out at 100%). `updateHeat` runs last in `update`. Before this, heat only existed with the endo and cooled down on its own (`COOL_RATE`, removed).

**Defaults that were chosen, not specified by the owner** (tell them if asked, change on request): Nightmare Freddy stays 5 s; opening early on Foxy makes him lunge again; Foxy waits behind the shut door forever until you do his routine (costs door power); Freddy is the power-out killer when Moon is off; Golden Freddy/Chica trigger on lowering the monitor; the numbers in `config.js` are first guesses.

**Challenges:** 28 in `PRESETS` (`data.js`), built with `lv({ id: level })` or `everyone(level)`, levels only, with ✓ saved as `clearKey` ("Name v1") and `FLAVOR` text. 15 were added on 2026-11-03 (on request, "a bunch of new challenges"): Quiet night, Everyone at 5, Night light, Bunny trouble, Freddy fever, Withered away, Snack time, Hot and sleepy, Music lesson, Nightmare crew, Door duty, Masquerade, Power hungry, Click frenzy, Everyone at 18. The list is written in difficulty order, from the bot results below (Warm-up first, **All 20**, 240 points, last). Easing the game didn't make any challenge harder, so no `v` changed and every saved ✓ still counts. On request, Withered Foxy was taken out of **The classics** and **Classic 20** (in case a standard Foxy is added later); that made them easier, so they kept `v: 1` and their ✓, and The classics (now 21 points) moved before Quiet night. A standard Foxy, if added, is the natural fit for those two. Phantom Chica (14) was added to **Power hungry** on request ("it literally takes power"), which made it harder, so it went to `v: 2` (its old ✓ no longer counts) and moved after Classic 20 (70 points); the bot still won it 30/30 for both profiles.

## Balance (keep every challenge humanly possible)

- **`tools/bot.js`** is a test bot kept in the repo (not loaded by the game, not deployed). It plays with a person's limits: it reacts only to cues a player gets (sounds anywhere; office sights only with the monitor down; it lowers the monitor to read the staff bot's arrow), each reaction takes `react` × a random 0.8–1.5, one action at a time (`gap` s each), the mouse moves at `mouse` characters per second (Bonnet's real dodge code runs against it, and the flashlight only lights what the mouse has reached), and each cupcake takes `find` × 0.7–1.4 s to spot. Profiles: `BOT.average` (0.75 s / 0.45 s / 1.2 s / 40) and `BOT.beginner` (1.1 s / 0.6 s / 1.8 s / 25).
- **How to run it:** serve the folder (no Node/Python here: a PowerShell `HttpListener` script works), open it in the browser pane, then run `(0, eval)(await fetch('tools/bot.js').then(r => r.text()))` and `botReport(30)`. A full report takes about a minute, which is longer than the browser tool's 45 s limit, so start it without waiting (put results on `window`) and read them afterwards.
- **Results on 2026-11-03** (30 nights each, average / beginner): the first 22 challenges 30/30 for both; Snack time 27 / 20 (Bonnet runs across while you hunt cupcakes); Everyone at 5 30 / 25; at 10 24 / 22; at 15 26 / 21; at 18 26 / 13; **All 20 20 / 10**. Before `LEVEL_SCALE`, a realistic player lost All 20 every time (0/30), mostly to power-outs (Moon) and Golden Freddy's short window.
- **After the office heat** (same day; the bot turns the fan on at the first hot breath, 70%, and off below 10%): the first 22 still 30/30 for both; Everyone at 5 27 / 28; Snack time 24 / 23 (so the two swapped places); Everyone at 10 29 / 22; at 15 25 / 21; at 18 18 / 15; **All 20 11 / 9**. Nobody passed out; the fan's power cost shows up as more power-outs (Moon) in All 20. Every challenge went up one `v` (Power hungry to v3), so all old ✓s stopped counting.
- **When characters are added or changed:** add the new character to the bot (one cue and one action, like the others), rerun `botReport`, and tune until every challenge is humanly possible again (owner's request). Then reorder `PRESETS` if the results moved.

**Menu icons:** `ICONS` in `art.js`, a tiny 3-line ASCII face per character (on request: "change the icons to look like the characters"; they used to be three-letter tags). `iconHtml` draws the whole face (title, setup rows); `faceHtml` draws one line (`FACE_ROW`, usually the middle), on the Best line and the win screen.

## How the code is organized

Same pattern as BBCN: `index.html` (a page **fragment**: no doctype/html/head/body), `style.css`, and classic scripts in `js/`, loaded in order and sharing the global scope (so **names must be unique across files**): `helpers.js` (`$`, `store` with prefix `asciinights:`, `pick`, `rand`, `byLevel`), `config.js`, `data.js`, `sound.js`, `art.js`, `game.js`, `render.js`, `screens.js`, `input.js`, `main.js`. `window.asciiNights` is a test hook (`.state`, `.speed`).

### Gotchas

- **Art is ASCII only** (other glyphs have different widths). Drawings use ``String.raw`...` ``, and **a line can't end with `\` right before the closing backtick** (`` \` `` is an escaped backtick, which caused a syntax error once). Add a trailing space there.
- `sprite()` draws the spaces between a line's first and last character (so a drawing hides what's behind it) but leaves the spaces around it see-through.
- Clicks on things that are redrawn often (cupcakes, Bonnet's nose) use **mousedown** (left button) plus **pointerdown** for touch, because a second mouse button pressed while the right one holds the flashlight doesn't fire a new pointerdown.
- Keep `<meta charset="utf-8">` at the top of `index.html` and `[hidden] { display: none !important; }` in `style.css`, so double-clicking `index.html` works.
- The loop only runs during a night and stops when paused or on menus; a hidden tab pauses and puts sound to sleep. Don't add timers that run outside a night.

## Hosting

`.github/workflows/deploy.yml` (copied from BBCN): syntax check plus `node tools/build.js` on every PR; deploys `dist/` to GitHub Pages on push to `main`. `tools/build.js` wraps the fragment in a full page (no analytics). One-time setting: Settings → Pages → Source = GitHub Actions.

## Testing

- **No Node.js or Python on this Windows computer.** For the Claude desktop app's browser pane, a small PowerShell `HttpListener` server can serve the folder (a script in the session scratchpad served `http://127.0.0.1:8765/index.html`). The pane can't run `file://` pages.
- **Tested on 2026-11-02** (scripted, in the browser): every character's main rules (appear, counter, success, death), the masks, wind taps, staff bot stall, Foxy's whole routine including opening early, Moon, the endo with and without the fan, power-out killers, 6 AM win and the ✓ save. Real mouse clicks on cupcakes and Bonnet's nose, aiming the flashlight at a Freddle, phone width (375 px, no sideways scroll).
- **Not tested:** the sounds (never heard), play-balance with a real person, holding the right mouse button for real (tests set `flashKey`), touch play, the GitHub Pages deploy, and the face icons inside the jumpscare/win screens on a phone.
