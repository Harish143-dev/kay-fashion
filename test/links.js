/* Network check: every image URL hardcoded in the HTML, plus a random sample
   from the product catalogue, must return HTTP 200.
   Catches hand-typed CDN filenames drifting from the real Shopify assets.

   Usage:  node test/links.js
*/
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

const PAGES = ['index.html', 'collection.html', 'product.html'];
const SAMPLE = 20;

function hardcoded() {
  const urls = new Set();
  PAGES.forEach(f => {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    (html.match(/https:\/\/cdn\.shopify\.com[^"')\s]+/g) || [])
      .forEach(u => urls.add(u.replace(/&amp;/g, '&')));
  });
  return [...urls].map(u => ({ u, src: 'hardcoded in HTML' }));
}

function sampled() {
  const w = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/js/data.js'), 'utf8'))(w);
  const all = w.PRODUCTS.flatMap(p => p.images);
  const out = [];
  // deterministic spread across the catalogue
  const step = Math.max(1, Math.floor(all.length / SAMPLE));
  for (let i = 0; i < all.length && out.length < SAMPLE; i += step) out.push({ u: all[i], src: 'catalogue' });
  return out;
}

async function head(url) {
  try {
    const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    return r.status;
  } catch (e) { return 'ERR ' + e.message; }
}

(async () => {
  const targets = [...hardcoded(), ...sampled()];
  console.log(`Checking ${targets.length} image URLs…\n`);
  let bad = 0;
  const results = await Promise.all(targets.map(async t => ({ ...t, status: await head(t.u) })));
  for (const r of results) {
    const good = r.status === 200 || r.status === 206;
    if (!good) { bad++; console.log(`  FAIL ${r.status}  [${r.src}]  ${r.u}`); }
  }
  console.log(bad
    ? `\n${bad} of ${targets.length} URLs failed`
    : `\nAll ${targets.length} image URLs resolve`);
  process.exit(bad ? 1 : 0);
})();
