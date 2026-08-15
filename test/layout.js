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

  var cta = document.querySelector('#atc') || document.querySelector('[data-notify]');
  if (cta) out.ctaDepth = Math.round(cta.getBoundingClientRect().top + window.scrollY);

  var newin = document.querySelector('#newin');
  if (newin) {
    out.newinCards = newin.querySelectorAll('.card').length;
    out.newinVisible = [].slice.call(newin.children)
      .filter(function (c) { return getComputedStyle(c).display !== 'none'; }).length;
  }

  var s = document.createElement('script');
  s.type = 'application/json'; s.id = 'probe-out';
  s.textContent = JSON.stringify(out);
  document.body.appendChild(s);
}, 600); });
</script>`;

function measure(page, query, width) {
  const tmp = path.join(ROOT, `_layout_probe_${process.pid}.html`);
  const src = fs.readFileSync(path.join(ROOT, page), 'utf8');
  fs.writeFileSync(tmp, src.replace('</body>', PROBE + '</body>'), 'utf8');
  try {
    const url = 'file:///' + path.join(ROOT, path.basename(tmp)).replace(/\\/g, '/') + (query || '');
    const dom = execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-sandbox',
      '--virtual-time-budget=15000', `--window-size=${width},1000`, '--dump-dom', url,
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const m = /<script type="application\/json" id="probe-out">([\s\S]*?)<\/script>/.exec(dom);
    if (!m) throw new Error('probe produced no output');
    return JSON.parse(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  } finally {
    fs.unlinkSync(tmp);
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
];
const WIDTHS = [390, 768, 1024, 1440];

console.log(`\nLayout — ${path.basename(CHROME)}\n`);

for (const [page, query] of PAGES) {
  for (const width of WIDTHS) {
    let r;
    try { r = measure(page, query, width); }
    catch (e) { ok(`${page} @${width}`, false, e.message); continue; }

    const at = `${page} @${width}`;
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
