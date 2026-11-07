/* =====================================================================
   build.js: turns the game's source files into the public website.

   Run it with:   node tools/build.js
   It makes a folder called dist/ holding exactly what gets put online
   (GitHub Pages, see .github/workflows/deploy.yml). Node.js runs it;
   there is nothing to install.

   Why do we need a build at all? index.html is a "fragment" with no
   <html>, <head> or <body> (so it can also be published as a Claude
   Artifact, which adds those itself). A real website needs them, and a
   <!doctype html>, or browsers fall back to an old "quirks mode" that
   can change how things are laid out.
   The source files are never changed: dist/ is a copy.
   ===================================================================== */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

// Start from an empty dist/ so nothing old is left behind.
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'js'), { recursive: true });

// Copy the stylesheet and every script the page loads (read from index.html itself, so a new script
// file is picked up automatically).
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
fs.copyFileSync(path.join(root, 'style.css'), path.join(dist, 'style.css'));
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
for (const file of scripts) fs.copyFileSync(path.join(root, file), path.join(dist, file));

// "Cache busting": browsers keep a copy of each file for a while (GitHub Pages allows 10 minutes), so
// right after an update a player could get the new page with an old art.js, say. Adding ?v=<code> to
// each file's address fixes that: the code is made from the file's contents (a "hash", a short
// fingerprint that changes whenever the file does), so a changed file has a new address and is fetched
// fresh, and an unchanged one keeps its address and its saved copy.
const version = file => crypto.createHash('md5').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 8);
const busted = html
  .replace(/<script src="([^"]+)"/g, (m, file) => `<script src="${file}?v=${version(file)}"`)
  .replace('<link rel="stylesheet" href="style.css">', () => `<link rel="stylesheet" href="style.css?v=${version('style.css')}">`);

// The fragment starts with <meta>, <title> and <link> tags (the page's "head" material) and then has
// the visible page. Split it at the first <div: everything before goes in <head>, the rest in <body>.
const split = busted.indexOf('<div');
const page = `<!doctype html>
<html lang="en">
<head>
${busted.slice(0, split)}
</head>
<body>
${busted.slice(split)}
</body>
</html>
`;
fs.writeFileSync(path.join(dist, 'index.html'), page);

console.log(`Built dist/ with ${scripts.length} scripts.`);
