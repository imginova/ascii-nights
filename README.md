# ASCII Nights

A custom-night fan game in the style of Five Nights at Freddy's, drawn in ASCII art and played in the browser. You sit in the office from 12 AM to 6 AM with two doors, a flashlight, a mask, a fan, a heater, a monitor (7 cameras, a duct map and a shop) and a battery that drains whenever you use anything. Twenty-nine characters each get their own level from 0 to 20 on the custom night screen, and each one works its own way (the rules are in the game's **How to play**).

> **A fan game.** ASCII Nights is not affiliated with Scott Cawthon or Five Nights at Freddy's. The characters belong to their creator. The game is free and must stay free: no price, no ads, no donations. All the drawings and sounds were made from scratch for this game.

## Playing it

- **Online:** https://imginova.github.io/ascii-nights/ (updated automatically on every push to `main`).
- **On your computer:** double-click `index.html`. No installing, no internet needed (except for the fonts).
- **The code:** https://github.com/imginova/ascii-nights

## How the code is organized

The game is split into files by job. Every file starts with a comment that explains what it's for, and the code is commented for learning.

| File | Its job |
|---|---|
| `index.html` | The page's structure: screens, buttons and empty boxes the game draws into. Also the How to play text |
| `style.css` | How everything looks: colors (one per character), fonts, layout, the flashlight's glow |
| `js/helpers.js` | Tiny tools: `$`, `store` (saving in the browser), `pick`, `rand`, `byLevel` |
| `js/config.js` | **The numbers to tweak**: power, timings and how hard each level is |
| `js/data.js` | The rooms, the 29 characters, the ducts, the office spots and the challenges |
| `js/sound.js` | Every sound effect, generated in code (there are no sound files) |
| `js/art.js` | The ASCII pictures: rooms, the office and every character's drawings |
| `js/game.js` | The rules: what each character does, doors, power, winning and losing |
| `js/render.js` | Draws the night onto the screen (never changes the rules) |
| `js/screens.js` | Switching screens, the custom night screen, the win and game over screens |
| `js/input.js` | Mouse and keyboard controls, including aiming the flashlight |
| `js/main.js` | The game loop and start-up |

The scripts are loaded in that order at the bottom of `index.html`, and **the order matters**: each file can use what the files above it made.

## Changing things

- **Make something easier or harder:** change its numbers in `js/config.js`. Most are written as `byLevel(level, at1, at20)`: the value at level 1 and the value at level 20.
- **Add a challenge:** add a line to `PRESETS` in `js/data.js`, and a line of flavour text to `FLAVOR`.
- **How hard every level plays:** `LEVEL_SCALE` in `js/config.js` (0.5 means level 20 plays like 10.5), `CROWD_CALM` (how many characters can be on before they all start acting a bit slower) and `UNIT_DRAIN` (how much power each thing uses per second).
- **Check it's still humanly possible:** `tools/bot.js` is a test bot that plays every challenge with a person's reaction times and mouse speed (the comment at its top says how to run it). Use it after adding or changing a character.
- **Made a challenge harder?** Raise its `v` in `PRESETS` (for example `v: 1` to `v: 2`), so its ✓ has to be earned again. Only do this for the challenges your change actually affects.

## Putting it online (GitHub Pages)

`.github/workflows/deploy.yml` checks the code on every pull request, and on every push to `main` it runs `node tools/build.js` and puts the `dist/` folder online. One-time setup on GitHub: the repository's **Settings → Pages → Source = GitHub Actions**.
