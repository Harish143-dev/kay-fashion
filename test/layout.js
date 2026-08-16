/* Layout tests in a real browser.
 *
 * test/smoke.js runs in jsdom, which executes JavaScript but performs no
 * layout — so it cannot see a header wrapping onto a second row, a carousel
 * blowing the document out to three times the viewport width, or a buy button
 * sitting 4,000px down a phone screen. All three shipped. This file drives
 * headless Chrome at real widths and measures the boxes.
 *
 *   node test/layout.js
 *
 * Set CHROME=/path/to/chrome if it is not in one of the usual places.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(p => p && fs.existsSync(p));

if (!CHROME) {
  console.log('No Chrome or Edge found — skipping layout tests. Set CHROME=<path> to run them.');
  process.exit(0);
}

/* The probe runs inside the page and reports geometry as JSON. */
const PROBE = `
<script id="probe-src">
document.addEventListener('DOMContentLoaded', function () { setTimeout(function () {
  var W = window.innerWidth, out = { viewport: W };
  var box = function (el) { var r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height),
             top: Math.round(r.top + window.scrollY), left: Math.round(r.left) }; };

  out.docWidth = document.documentElement.scrollWidth;

  out.overflowing = [].slice.call(document.querySelectorAll('body *'))
    .filter(function (e) {
      var r = e.getBoundingClientRect();
      return r.width > W + 1 && r.width < 1e5 && getComputedStyle(e).position !== 'fixed';
    })
    .map(function (e) { return (e.tagName + '.' + (typeof e.className === 'string' ? e.className : ''))
      .trim().slice(0, 48) + '=' + Math.round(e.getBoundingClientRect().width); })
    .slice(0, 8);

  var hi = document.querySelector('.header-inner');
  if (hi) {
    var hb = box(hi), rows = [];
    [].slice.call(hi.children).forEach(function (c) {
      if (getComputedStyle(c).display === 'none') return;
      var b = box(c);
      if (b.h === 0 && b.w === 0) return;
      // Anything whose box escapes the header has wrapped to a second row.
      if (b.top < hb.top - 1 || b.top + b.h > hb.top + hb.h + 1) rows.push(c.className || c.tagName);
    });
    out.headerEscapees = rows;
    var logo = document.querySelector('.header .logo');
    if (logo) { var l = box(logo); out.logoOffCentre = Math.round(Math.abs((l.left + l.w / 2) - W / 2)); }
  }

  // Icon-only controls: no text, so the box is the whole target.
  out.smallIconControls = [].slice.call(document.querySelectorAll('a,button'))
    .filter(function (e) {
      var r = e.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      if (e.textContent.trim().length) return false;
      if (!e.querySelector('svg')) return false;
      // 44px is the touch guideline and applies at touch widths; on a
      // pointer-driven desktop WCAG 2.5.8's 24px floor is the right bar.
      var min = W <= 1024 ? 44 : 24;
      return r.height < min || r.width < min;
    })
    .map(function (e) { var r = e.getBoundingClientRect();
      return (e.className || e.tagName) + '=' + Math.round(r.width) + 'x' + Math.round(r.height); })
    .slice(0, 10);

  // Swipe rails bleed to the screen edge and pad themselves back in. If the
  // snapport is not inset to match, the first card parks flush to the edge and
  // the padding is invisible. Measure where the first card actually lands.
  out.rails = [];
  ['.newin', '.cats'].forEach(function (sel) {
    var r = document.querySelector(sel);
    if (!r || getComputedStyle(r).overflowX !== 'auto') return;
    var first = r.firstElementChild;
    if (!first) return;
    var gut = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gut')) || 0;
    out.rails.push({ sel: sel, left: Math.round(first.getBoundingClientRect().left), gut: Math.round(gut) });
  });

  // The announcement bar is three columns in one row; if the utility links grow,
  // they run straight over the rotating message instead of wrapping.
  var al = document.querySelector('.announce-links');
  var at = document.querySelector('.announce-track');
  var as = document.querySelector('.announce-social');
  var vis = function (e) { return e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
  out.announceOverlap = [];
  // Measure the links themselves, not their container: a flex row overflows its
  // grid column without the column's own box ever growing, so comparing the
  // wrappers would report no collision while text sits on top of text.
  var edge = function (el, side) {
    if (!vis(el)) return null;
    var kids = [].slice.call(el.children).filter(vis);
    if (!kids.length) return el.getBoundingClientRect()[side];
    var rects = kids.map(function (k) { return k.getBoundingClientRect()[side]; });
    return side === 'right' ? Math.max.apply(null, rects) : Math.min.apply(null, rects);
  };
  var msg = at && at.querySelector('.announce-item');
  var msgBox = vis(msg) ? msg.getBoundingClientRect() : (vis(at) ? at.getBoundingClientRect() : null);
  var linksRight = edge(al, 'right');
  var socialLeft = edge(as, 'left');
  if (linksRight !== null && msgBox && linksRight > msgBox.left + 1) {
    out.announceOverlap.push('links over message by ' + Math.round(linksRight - msgBox.left) + 'px');
  }
  if (socialLeft !== null && msgBox && msgBox.right > socialLeft + 1) {
    out.announceOverlap.push('message over socials by ' + Math.round(msgBox.right - socialLeft) + 'px');
  }

  var cta = document.querySelector('#atc') || document.querySelector('[data-notify]');
  if (cta) out.ctaDepth = Math.round(cta.getBoundingClientRect().top + window.scrollY);

  var newin = document.querySelector('#newin');
  if (newin) {
    out.newinCards = newin.querySelectorAll('.card').length;
    out.newinVisible = [].slice.call(newin.children)
      .filter(function (c) { return getComputedStyle(c).display !== 'none'; }).length;
  }

  parent.postMessage(JSON.stringify(out), '*');
}, 600); });
</script>`;

/* The page is loaded inside an iframe sized to the exact CSS width under test,
 * because --window-size cannot deliver one. Headless Chrome on Windows clamps
 * the window to roughly 500px and applies display scaling on top, so asking for
 * 390 produced a 504px viewport — the narrowest phone width, which is where
 * most of the real bugs have been, was never actually tested. An iframe
 * establishes its own viewport, so media queries and vw units resolve against
 * exactly the width we ask for. The probe posts its results up to the wrapper,
 * since --dump-dom only serialises the top document.
 */
const FRAME = (src, w, h) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#fff}iframe{border:0;display:block;width:${w}px;height:${h}px}</style>
<iframe src="${src}" scrolling="no"></iframe>
<script>
window.addEventListener('message', function (e) {
  var s = document.createElement('script');
  s.type = 'application/json'; s.id = 'probe-out';
  s.textContent = e.data;
  document.body.appendChild(s);
});
</script>`;

function measure(page, query, width, height = 900) {
  const probeFile = `_layout_probe_${process.pid}.html`;
  const frameFile = `_layout_frame_${process.pid}.html`;
  const probePath = path.join(ROOT, probeFile);
  const framePath = path.join(ROOT, frameFile);

  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  fs.writeFileSync(probePath, src.replace('</body>', PROBE + '</body>'), 'utf8');
  fs.writeFileSync(framePath, FRAME(probeFile + (query || ''), width, height), 'utf8');

  try {
    const url = 'file:///' + framePath.replace(/\\/g, '/');
    const dom = execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
      '--allow-file-access-from-files', '--virtual-time-budget=20000',
      // Window only has to be big enough to hold the frame; the frame is the
      // viewport that matters.
      `--window-size=${Math.max(width + 60, 640)},${height + 60}`, '--dump-dom', url,
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const m = /<script type="application\/json" id="probe-out">([\s\S]*?)<\/script>/.exec(dom);
    if (!m) throw new Error('probe produced no output');
    return JSON.parse(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  } finally {
    [probePath, framePath].forEach(f => { try { fs.unlinkSync(f); } catch (e) { /* already gone */ } });
  }
}

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  \u2192 ' + detail : '')); }
};

/* Depth budget for the primary CTA. Generous — a PDP legitimately carries a
 * gallery above the fold — but it caught a 4,228px stack on tablet. */
const CTA_BUDGET = 2600;

const PAGES = [
  ['index.html', ''],
  ['collection.html', '?c=Sarees'],
  ['product.html', '?h=bridal-lehenga-rust-zari'],
  ['appointments.html', ''],
  ['closet.html', ''],
  ['blog.html', ''],
  ['article.html', '?p=how-to-read-a-kanchipuram'],
  ['contact.html', ''],
];
const WIDTHS = [390, 768, 1024, 1440];

console.log(`\nLayout — ${path.basename(CHROME)}\n`);

for (const [page, query] of PAGES) {
  for (const width of WIDTHS) {
    let r;
    try { r = measure(page, query, width); }
    catch (e) { ok(`${page} @${width}`, false, e.message); continue; }

    const at = `${page} @${width}`;
    // If the browser hands back a different width, every measurement below is
    // about a viewport nobody asked for.
    ok(`${at}: viewport is the width under test`,
      Math.abs(r.viewport - width) <= 2, `asked ${width}, got ${r.viewport}`);
    ok(`${at}: no horizontal overflow`,
      r.docWidth <= r.viewport + 1, `doc ${r.docWidth} vs viewport ${r.viewport}` +
        (r.overflowing.length ? ' — ' + r.overflowing.join(', ') : ''));
    ok(`${at}: header stays on one row`,
      !r.headerEscapees || r.headerEscapees.length === 0, (r.headerEscapees || []).join(', '));
    ok(`${at}: logo is optically centred`,
      r.logoOffCentre === undefined || r.logoOffCentre <= 2, r.logoOffCentre + 'px off centre');
    ok(`${at}: icon controls meet the minimum size`,
      r.smallIconControls.length === 0, r.smallIconControls.join(', '));
    if (r.ctaDepth !== undefined) {
      ok(`${at}: add-to-cart within ${CTA_BUDGET}px of the top`,
        r.ctaDepth <= CTA_BUDGET, r.ctaDepth + 'px down');
    }
    ok(`${at}: announcement bar columns do not collide`,
      !r.announceOverlap || r.announceOverlap.length === 0, (r.announceOverlap || []).join('; '));
    (r.rails || []).forEach(rail => {
      ok(`${at}: ${rail.sel} rail keeps its edge gutter`,
        Math.abs(rail.left - rail.gut) <= 1, `first card at ${rail.left}px, gutter is ${rail.gut}px`);
    });
    if (r.newinCards !== undefined) {
      ok(`${at}: all 5 new arrivals are reachable`,
        r.newinCards === 5 && r.newinVisible === 5, `${r.newinVisible}/${r.newinCards} visible`);
    }
  }
}

console.log(`\n══════════════════════════════\n  ${pass} passed, ${fail} failed\n══════════════════════════════\n`);
process.exit(fail ? 1 : 0);
