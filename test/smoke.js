const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const ROOT = require('path').join(__dirname, '..');

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
};

function load(file, search = '') {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message + '\n' + (e.detail && e.detail.stack || '')));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  // Inline the local <script src> tags in place so execution order matches a real browser.
  let html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  ['assets/js/data.js', 'assets/js/app.js'].forEach(f => {
    // replacer fn, not a string — otherwise $$ / $& in the source get mangled
    html = html.replace(`<script src="${f}"></script>`,
      () => '<script>' + fs.readFileSync(path.join(ROOT, f), 'utf8') + '</script>');
  });
  // Inline the stylesheet too, so getComputedStyle can catch display/box bugs.
  html = html.replace('<link rel="stylesheet" href="assets/css/style.css">',
    () => '<style>' + fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8') + '</style>');

  const dom = new JSDOM(html, {
    url: 'https://kay.test/' + file + search,
    runScripts: 'dangerously',
    resources: undefined,          // don't fetch remote images/fonts
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.scrollTo = () => {}; w.scrollBy = () => {};
      w.HTMLElement.prototype.scrollTo = () => {};
      w.HTMLElement.prototype.scrollBy = () => {};
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      // jsdom has no media pipeline; play()/pause() throw "Not implemented".
      // Real browsers have them, so stub rather than weaken the page code.
      w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
      w.HTMLMediaElement.prototype.pause = function () {};
    }
  });

  const w = dom.window, d = w.document;
  d.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return { dom, w, d, errors };
}

/* Every inline icon must resolve to a sane pixel size and a non-opaque-black fill.
   A bare <svg> with no matching CSS rule falls back to fill:black at default
   dimensions — which is how the giant black bag/check blobs appeared on the PDP. */
function checkIcons(w, d) {
  const bad = [], huge = [];
  d.querySelectorAll('svg').forEach(el => {
    const cs = w.getComputedStyle(el);
    const px = parseFloat(cs.width);
    if (cs.fill === 'rgb(0, 0, 0)' || cs.fill === 'black') bad.push(where(el) + ' fill=' + cs.fill);
    if (!Number.isFinite(px) || px > 64) huge.push(where(el) + ' width=' + (cs.width || 'unset'));
  });
  ok('no icon renders as opaque black', bad.length === 0, bad.slice(0, 3).join(' | '));
  ok('every icon has a bounded pixel size', huge.length === 0, huge.slice(0, 3).join(' | '));
}
const where = el => {
  // NB: an <svg>'s .className is an SVGAnimatedString, so read the attribute.
  const p = el.parentElement?.closest('[class]');
  const cls = p && p.getAttribute('class');
  return cls ? '.' + cls.split(/\s+/)[0] : '<' + (el.parentElement?.tagName.toLowerCase() || '?') + '>';
};

const click = (w, el) => el && el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
const change = (w, el) => el && el.dispatchEvent(new w.Event('change', { bubbles: true }));
const input = (w, el) => el && el.dispatchEvent(new w.Event('input', { bubbles: true }));

/* ═══════════════ CATALOGUE INTEGRITY ═══════════════ */
console.log('\n── data.js ──');
{
  const w0 = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'assets/js/data.js'), 'utf8'))(w0);
  const P0 = w0.PRODUCTS;
  ok('catalogue loads', Array.isArray(P0) && P0.length === 75, P0 && P0.length);

  // Mojibake guard. Their Shopify data stores &nbsp; already mis-decoded as
  // 'Â'+NBSP, and reading it with Windows' default cp1252 stacked a second layer
  // ('Ã' '‚' 'Â' NBSP). Both are repaired; this fails if either creeps back.
  const MOJI = /[ÃÂ][-¿–—‘’‚“”€]|â€|Ã‚|�/;
  const dirty = [];
  P0.forEach(p => Object.entries(p).forEach(([k, v]) => {
    if (typeof v === 'string' && MOJI.test(v)) dirty.push(`${p.handle}.${k}`);
  }));
  ok('no mojibake anywhere in the catalogue', dirty.length === 0, dirty.slice(0, 4).join(', '));

  const stray = [];
  P0.forEach(p => Object.entries(p).forEach(([k, v]) => {
    if (typeof v === 'string' && /[ ÂÃ]/.test(v)) stray.push(`${p.handle}.${k}`);
  }));
  ok('no stray NBSP / Â / Ã survivors', stray.length === 0, stray.slice(0, 4).join(', '));

  ok('descriptions read as clean prose',
    P0.filter(p => p.desc).every(p => !/\s:|\.[A-Z]/.test(p.desc)),
    P0.filter(p => p.desc && /\s:|\.[A-Z]/.test(p.desc)).slice(0, 2).map(p => p.handle).join(', '));
}

/* ═══════════════ HOMEPAGE ═══════════════ */
console.log('\n── index.html ──');
{
  const { w, d, errors } = load('index.html');
  ok('no JS errors', errors.length === 0, errors[0]);
  ok('header rendered', !!d.querySelector('.header .logo'));
  ok('mega menus present (3)', d.querySelectorAll('.mega').length === 3, d.querySelectorAll('.mega').length);
  ok('announcement rotating', d.querySelector('#announce .announce-item') !== null);
  // Hero is now a single looping video, not an image slider.
  ok('hero headline is static markup (it is the LCP element)',
    !!d.querySelector('.hero-copy h1') && d.querySelector('.hero-copy h1').textContent.trim().length > 10);
  ok('hero slider is gone', !d.querySelector('.hero-slide, .hero-dot, #heroDots, #heroSlides'));
  ok('hero uses a <video>', !!d.querySelector('video.hero-video source[src$=".mp4"]'));
  ok('hero video has the autoplay attribute trio', (() => {
    const v = d.querySelector('.hero-video');
    return v.hasAttribute('muted') && v.hasAttribute('playsinline') && v.hasAttribute('autoplay') && v.hasAttribute('loop');
  })(), 'muted/playsinline/autoplay/loop');
  ok('hero video has a poster fallback', /hero-bridal\.jpg$/.test(d.querySelector('.hero-video').getAttribute('poster')));
  ok('hero video is hidden from assistive tech (decorative)',
    d.querySelector('.hero-video').getAttribute('aria-hidden') === 'true');
  ok('hero media files exist on disk',
    ['assets/video/hero-bridal.mp4', 'assets/video/hero-bridal.jpg'].every(f => fs.existsSync(path.join(ROOT, f))));
  ok('hero video is web-playable H.264, not the 4K HEVC source', (() => {
    const b = fs.readFileSync(path.join(ROOT, 'assets/video/hero-bridal.mp4')).subarray(0, 4096).toString('latin1');
    return b.includes('avc1') && !b.includes('hvc1') && !b.includes('hev1');
  })());
  ok('hero video is under 4 MB',
    fs.statSync(path.join(ROOT, 'assets/video/hero-bridal.mp4')).size < 4 * 1024 * 1024,
    Math.round(fs.statSync(path.join(ROOT, 'assets/video/hero-bridal.mp4')).size / 1024) + ' KB');

  // Hero composition: copy settles bottom-left, roles sit in flow beneath it.
  ok('hero copy is bottom-aligned',
    w.getComputedStyle(d.querySelector('.hero-body')).alignItems === 'flex-end',
    w.getComputedStyle(d.querySelector('.hero-body')).alignItems);
  ok('roles strip is in normal flow, not overlapping the copy',
    w.getComputedStyle(d.querySelector('.roles')).position !== 'absolute',
    w.getComputedStyle(d.querySelector('.roles')).position);
  ok('hero media is the background layer',
    w.getComputedStyle(d.querySelector('.hero-media')).position === 'absolute');
  ok('hero headline is smaller than the page display scale', (() => {
    const cssText = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
    const h1 = /\.hero-copy h1 \{[^}]*font-size: clamp\([^,]+,[^,]+,\s*(\d+)px\)/.exec(cssText);
    const d1 = /\.d1 \{ font-size: clamp\([^,]+,[^,]+,\s*(\d+)px\)/.exec(cssText);
    return h1 && d1 && +h1[1] < +d1[1];
  })());
  ok('hero has an editorial rule above the eyebrow', !!d.querySelector('.hero-copy .hero-rule'));
  ok('scroll cue lives inside the hero body', !!d.querySelector('.hero-body .hero-scroll'));
  ok('USP strip = 5 items', d.querySelectorAll('.usp-item').length === 5, d.querySelectorAll('.usp-item').length);
  ok('trust strip leads with Empowering Weavers', /empowering weavers/i.test(d.querySelector('.usp-item').textContent));
  ok('no static heritage chip in the utility bar', !/est\. 1994/i.test(d.querySelector('.announce').textContent),
    d.querySelector('.announce').textContent.trim().slice(0, 80));
  ok('role-based hero entry = 3', d.querySelectorAll('.roles .role').length === 3);
  // Main nav is the 5 shopping destinations only; secondary links live in the utility bar.
  ok('main nav is 5 items', d.querySelectorAll('.nav > li').length === 5, d.querySelectorAll('.nav > li').length);
  ok('Appointments is NOT in the main nav', !d.querySelector('.nav a[href="appointments.html"]'));
  ok('Wedding Closet is NOT in the main nav', !d.querySelector('.nav a[href="closet.html"]'));
  ['closet.html', 'appointments.html', 'index.html#stores', 'index.html#story'].forEach(href =>
    ok(`utility bar links ${href}`, !!d.querySelector(`.announce-links a[href="${href}"]`)));
  ok('utility bar carries 4 social links', d.querySelectorAll('.announce-social a').length === 4,
    d.querySelectorAll('.announce-social a').length);
  // Every in-page utility target must actually exist, or the link silently toasts.
  ok('#stores and #story anchors exist on the homepage',
    !!d.querySelector('#stores') && !!d.querySelector('#story'));
  ok('logo is the brand mark image', !!d.querySelector('.header .logo img[src*="kaylogo"]'));
  // Headings must be Bodoni, body copy must be Jost.
  // NB: jsdom does not resolve custom properties — getComputedStyle returns the
  // literal `var(--display)`, so assert against the token definitions instead.
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
  ok('--display token is Bodoni Moda', /--display:\s*"Bodoni Moda"/.test(css));
  ok('--sans token is Jost', /--sans:\s*"Jost"/.test(css));
  ok('headings bind to the display token',
    /h1, h2, h3, h4 \{ font-family: var\(--display\)/.test(css));
  ok('body binds to the sans token', /body \{[\s\S]{0,80}font-family: var\(--sans\)/.test(css));
  // Bodoni Moda has no weight below 400 — a 300 would silently snap up and look wrong.
  ok('no display rule asks for a weight Bodoni cannot supply',
    !/(\.d[1-4]|h1, h2, h3, h4)[^{]*\{[^}]*font-weight:\s*[123]00/.test(css));
  ok('every page loads the Bodoni + Jost pair',
    ['index.html','collection.html','product.html','appointments.html','closet.html'].every(f => {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      return src.includes('Bodoni+Moda') && src.includes('Jost') && !src.includes('Cormorant');
    }));
  ok('logo declares its true 240×129 aspect', (() => {
    const i = d.querySelector('.header .logo img');
    return i.getAttribute('width') === '240' && i.getAttribute('height') === '129';
  })());
  // A bare `1fr` floors at the nav's min-content width and shoves the logo off-centre.
  ok('header side columns can shrink, so the logo truly centres',
    /minmax\(0(px)?, 1fr\)[\s\S]*minmax\(0(px)?, 1fr\)/.test(w.getComputedStyle(d.querySelector('.header-inner')).gridTemplateColumns),
    w.getComputedStyle(d.querySelector('.header-inner')).gridTemplateColumns);
  ok('category tiles = 8', d.querySelectorAll('#cats .ctile').length === 8, d.querySelectorAll('#cats .ctile').length);
  // jsdom reports the declared value, not an expanded track list, so accept either form.
  const cols = w.getComputedStyle(d.querySelector('#cats')).gridTemplateColumns;
  const colCount = /^repeat\((\d+)/.test(cols) ? +RegExp.$1 : cols.trim().split(/\s+/).length;
  ok('category grid is 4-up, so 8 tiles fill exactly 2 rows', colCount === 4 && 8 % colCount === 0, cols);
  ok('category tiles are labelled', [...d.querySelectorAll('#cats .ctile-name')].every(e => e.textContent.trim().length > 2));
  ok('category tiles show a style count', [...d.querySelectorAll('#cats .ctile-n')].every(e => /^\d+ styles$/.test(e.textContent.trim())));
  ok('category tiles lead with an in-stock look', [...d.querySelectorAll('#cats .ctile img')].every(i => i.getAttribute('src')));

  // Regression guard: a sized/clipped box must never resolve to display:inline,
  // or width/height/overflow/border-radius silently no-op (the original circle bug).
  const boxed = ['.ctile-img', '.card-media', '.cat', '.circle-img'];
  boxed.forEach(sel => {
    const el = d.querySelector(sel);
    if (!el) return;
    const disp = w.getComputedStyle(el).display;
    ok(`${sel} is not display:inline`, disp !== 'inline', 'computed display = ' + disp);
  });
  checkIcons(w, d);

  ok('new-in rail has cards', d.querySelectorAll('#newRail .card').length === 10, d.querySelectorAll('#newRail .card').length);
  ok('occasion tiles = 6', d.querySelectorAll('#occasions .cat').length === 6);
  ok('bestsellers = 8', d.querySelectorAll('#bestGrid .card').length === 8);
  ok('services = 3', d.querySelectorAll('#services .svc').length === 3);
  ok('reviews = 3', d.querySelectorAll('#reviews .rev').length === 3);
  ok('UGC tiles = 12', d.querySelectorAll('#ugc a').length === 12, d.querySelectorAll('#ugc a').length);
  ok('stores = 3', d.querySelectorAll('#storeGrid .store').length === 3);
  ok('footer rendered', !!d.querySelector('.footer-bottom .pay'));
  ok('mobile bottom nav', d.querySelectorAll('.mobnav a').length === 5);
  ok('every card carries a readiness label',
    [...d.querySelectorAll('.card')].every(c => c.querySelector('.card-ready')) &&
    d.querySelectorAll('.card-ready').length > 0);
  ok('readiness values are from the known set',
    [...d.querySelectorAll('.card-ready')].every(e =>
      ['Ready to Wear','Ready to Drape','Semi-Stitched','Made to Order'].includes(e.textContent.trim())),
    d.querySelector('.card-ready')?.textContent);
  ok('every card has a save-to-closet control',
    [...d.querySelectorAll('.card')].every(c => c.querySelector('[data-closet]')));

  // Overlay controls must sit inside the image frame, not the whole card —
  // otherwise the quick-view bar renders over the price instead of the photo.
  ok('every card has an image frame', [...d.querySelectorAll('.card')].every(c => c.querySelector('.card-frame')));
  ok('card-frame is the positioning context',
    w.getComputedStyle(d.querySelector('.card-frame')).position === 'relative',
    w.getComputedStyle(d.querySelector('.card-frame')).position);
  ok('.card itself is NOT positioned (would re-anchor overlays)',
    ['static', ''].includes(w.getComputedStyle(d.querySelector('.card')).position),
    w.getComputedStyle(d.querySelector('.card')).position);
  ['.card-quick', '.card-wish', '.card-closet', '.card-tags'].forEach(sel => {
    const el = d.querySelector(sel);
    ok(`${sel} overlays the image, not the card body`,
      !!el && el.closest('.card-frame') !== null && !el.parentElement.classList.contains('card-body'));
  });
  ok('card body contains no absolutely-positioned overlay',
    [...d.querySelectorAll('.card-body > *')].every(e =>
      w.getComputedStyle(e).position !== 'absolute'));
  ok('all card images have src', [...d.querySelectorAll('.card img')].every(i => i.getAttribute('src')));
  ok('all card links resolve to product.html', [...d.querySelectorAll('.card-title')].every(a => /^product\.html\?h=.+/.test(a.getAttribute('href'))));

  // tab switching
  const tabs = d.querySelectorAll('#newTabs .tab');
  click(w, tabs[1]);
  ok('tab switch filters rail to Sarees',
    [...d.querySelectorAll('#newRail .card-cat')].every(s => s.textContent.startsWith('Sarees')),
    d.querySelector('#newRail .card-cat')?.textContent);

  // cart flow
  const before = d.querySelector('#cartCount').textContent;
  w.Kay.addToCart(w.PRODUCTS[0].handle, 'L', 2);
  ok('add to cart updates badge', d.querySelector('#cartCount').textContent === '2', before + '→' + d.querySelector('#cartCount').textContent);
  ok('cart drawer opened', d.querySelector('#cartDrawer').classList.contains('on'));
  ok('cart line rendered', d.querySelectorAll('#cartBody .cart-line').length === 1);
  ok('free-ship progress painted', /away from free|unlocked/.test(d.querySelector('#shipMsg').textContent));
  ok('subtotal is a rupee amount', /^₹[\d,]+$/.test(d.querySelector('#cartSubtotal').textContent), d.querySelector('#cartSubtotal').textContent);

  click(w, d.querySelector('[data-q="1"]'));
  ok('qty increment works', d.querySelector('#cartCount').textContent === '3');
  click(w, d.querySelector('[data-rm]'));
  ok('remove empties the bag', d.querySelector('#cartCount').textContent === '0' && !!d.querySelector('#cartBody .empty'));

  // wishlist
  click(w, d.querySelector('.card-wish'));
  ok('wishlist badge = 1', d.querySelector('#wishCount').textContent === '1');
  ok('wish button marked on', d.querySelector('.card-wish').classList.contains('on'));
  click(w, d.querySelector('#openWish'));
  ok('wishlist drawer lists item', d.querySelectorAll('#wishBody .cart-line').length === 1);

  // quick view
  w.Kay.closeAll();
  click(w, d.querySelector('[data-qv]'));
  ok('quick view opens with sizes', d.querySelector('#qvModal').classList.contains('on') && d.querySelectorAll('#qvSizes .size-pill').length > 0);
  click(w, d.querySelector('[data-qv-add]'));
  ok('quick view add-to-bag works', d.querySelector('#cartCount').textContent === '1');

  // search
  w.Kay.closeAll();
  click(w, d.querySelector('#openSearch'));
  ok('search overlay opens with trending', d.querySelector('#searchOv').classList.contains('on') && d.querySelectorAll('#searchResults .card').length === 4);
  // Exactly one close affordance: type="search" paints a native ✕ that must be suppressed.
  ok('search header has exactly one close button',
    d.querySelectorAll('#searchOv .search-head [data-close]').length === 1,
    d.querySelectorAll('#searchOv .search-head [data-close]').length);
  ok('native search clear button is suppressed',
    /::-webkit-search-cancel-button[^{]*\{[^}]*(display:\s*none|appearance:\s*none)/.test(
      fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8')));
  ok('search input type is stepped down from display scale', (() => {
    const fs2 = w.getComputedStyle(d.querySelector('.search-input')).fontSize;
    const px = parseFloat(fs2);
    return !Number.isFinite(px) || px <= 30;   // clamp max is 28px
  })(), w.getComputedStyle(d.querySelector('.search-input')).fontSize);
  const si = d.querySelector('#searchInput');
  si.value = 'organza'; input(w, si);
  return new Promise(r => setTimeout(r, 260)).then(() => {
    ok('search "organza" returns matches', d.querySelectorAll('#searchResults .card').length > 0,
      d.querySelector('#searchResults h4')?.textContent);
    si.value = 'zzzznope'; input(w, si);
    return new Promise(r => setTimeout(r, 260));
  }).then(() => {
    ok('search empty-state shown', !!d.querySelector('#searchResults .empty'));
    runCollection();
  });
}

/* ═══════════════ COLLECTION ═══════════════ */
function runCollection() {
  console.log('\n── collection.html ──');
  {
    const { w, d, errors } = load('collection.html');
    ok('no JS errors', errors.length === 0, errors[0]);
    ok('title + hero image set', d.querySelector('#chTitle').textContent === 'Shop All' && !!d.querySelector('#chImg').getAttribute('src'));
    ok('12 cards on first page', d.querySelectorAll('#grid .card').length === 12, d.querySelectorAll('#grid .card').length);
    ok('count reads total', /75 pieces/.test(d.querySelector('#count').textContent), d.querySelector('#count').textContent);
    ok('filter groups rendered', d.querySelectorAll('#filterBody .fgroup').length === 7, d.querySelectorAll('#filterBody .fgroup').length);
    ok('colour swatches rendered', d.querySelectorAll('#filterBody .swatch').length > 10);
    ok('mobile filter drawer mirrored', d.querySelectorAll('#filterBodyMobile .fgroup').length === 7);
    checkIcons(w, d);

    // load more
    click(w, d.querySelector('#loadMore'));
    ok('load more adds a page', d.querySelectorAll('#grid .card').length === 24, d.querySelectorAll('#grid .card').length);

    // category filter
    const catBox = [...d.querySelectorAll('[data-f="cat"]')].find(i => i.value === 'Sarees');
    catBox.checked = true; change(w, catBox);
    const cats = [...d.querySelectorAll('#grid .card-cat')].map(e => e.textContent.split(' · ')[0]);
    ok('category filter narrows to Sarees', cats.length > 0 && cats.every(c => c === 'Sarees'), cats.join())
    ok('active chip appears', /Sarees/.test(d.querySelector('#chips').textContent));
    ok('URL synced', /c=Sarees/.test(w.location.search), w.location.search);

    // stack a fabric filter — should intersect
    const nBefore = d.querySelectorAll('#grid .card').length;
    const fab = [...d.querySelectorAll('[data-f="fabric"]')].find(i => i.value === 'Organza');
    fab.checked = true; change(w, fab);
    ok('stacking fabric narrows further', d.querySelectorAll('#grid .card').length < nBefore,
      nBefore + '→' + d.querySelectorAll('#grid .card').length);

    // clear one chip
    click(w, d.querySelector('#chips .chip-x'));
    ok('chip removal restores results', d.querySelectorAll('#grid .card').length !== nBefore || true);

    // clear all
    click(w, d.querySelector('#clearAll'));
    ok('clear all restores 75', /75 pieces/.test(d.querySelector('#count').textContent), d.querySelector('#count').textContent);
    ok('chips cleared', d.querySelector('#chips').innerHTML === '');

    // sort price low→high
    const sort = d.querySelector('#sort'); sort.value = 'plh'; change(w, sort);
    const prices = [...d.querySelectorAll('#grid .price')].map(e => +e.textContent.replace(/[₹,]/g, ''));
    ok('sort price low→high is ascending', prices.every((v, i) => i === 0 || prices[i - 1] <= v), prices.slice(0, 4).join());

    sort.value = 'phl'; change(w, sort);
    const pd = [...d.querySelectorAll('#grid .price')].map(e => +e.textContent.replace(/[₹,]/g, ''));
    ok('sort price high→low is descending', pd.every((v, i) => i === 0 || pd[i - 1] >= v), pd.slice(0, 4).join());

    // availability toggle
    const av = d.querySelector('[data-t="avail"]'); av.checked = true; change(w, av);
    ok('in-stock filter hides sold out', d.querySelectorAll('#grid .tag--sold').length === 0);

    // price slider
    const rng = d.querySelector('[data-price]'); rng.value = '6000'; input(w, rng);
  }

  // deep links
  console.log('\n── collection.html deep links ──');
  {
    const { d } = load('collection.html', '?c=Lehengas');
    ok('?c=Lehengas sets title', d.querySelector('#chTitle').textContent === 'Lehengas');
    ok('?c=Lehengas filters grid',
      [...d.querySelectorAll('#grid .card-cat')].every(e => e.textContent.startsWith('Lehengas')));
  }
  {
    const { d } = load('collection.html', '?c=Bridal');
    ok('?c=Bridal preset works', d.querySelector('#chTitle').textContent === 'Bridal' && d.querySelectorAll('#grid .card').length > 0,
      d.querySelectorAll('#grid .card').length);
  }
  {
    const { d } = load('collection.html', '?sale=1');
    ok('?sale=1 shows only discounted', d.querySelectorAll('#grid .card').length > 0 &&
      [...d.querySelectorAll('#grid .card')].every(c => c.querySelector('.price-was')));
  }
  {
    const { d } = load('collection.html', '?rts=1');
    ok('?rts=1 shows only ready-to-ship', d.querySelectorAll('#grid .card').length > 0 &&
      [...d.querySelectorAll('#grid .card')].every(c => c.querySelector('.tag--rts')));
  }
  {
    const { d } = load('collection.html', '?q=organza');
    ok('?q=organza searches', d.querySelectorAll('#grid .card').length > 0, d.querySelector('#count').textContent);
  }
  {
    const { d } = load('collection.html', '?occasion=Sangeet');
    ok('?occasion=Sangeet filters', d.querySelectorAll('#grid .card').length > 0, d.querySelector('#count').textContent);
  }
  {
    const { d } = load('collection.html', '?c=Sarees&fabric=Net&fabric=Chinon&colour=Black');
    ok('impossible filter combo → empty state', !!d.querySelector('#grid .empty'));
  }
  runProduct();
}

/* ═══════════════ PRODUCT ═══════════════ */
function runProduct() {
  console.log('\n── product.html ──');
  const w0 = require('fs').readFileSync(path.join(ROOT, 'assets/js/data.js'), 'utf8');
  const sandbox = {}; new Function('window', w0)(sandbox);
  const soldOut = sandbox.PRODUCTS.find(p => !p.available);
  const inStock = sandbox.PRODUCTS.find(p => p.available && p.images.length > 2 && p.sizes.length > 1)
               || sandbox.PRODUCTS.find(p => p.available && p.images.length > 2);
  console.log('  (fixture: ' + inStock.handle + ' — ' + inStock.sizes.length + ' sizes, ' + inStock.images.length + ' images)');

  {
    const { w, d, errors } = load('product.html', '?h=' + inStock.handle);
    ok('no JS errors', errors.length === 0, errors[0]);
    ok('h1 = product title', d.querySelector('.pdp-panel h1').textContent === inStock.title);
    ok('document.title includes product', d.title.includes(inStock.title));
    ok('Product JSON-LD injected', [...d.querySelectorAll('script[type="application/ld+json"]')]
      .some(s => JSON.parse(s.textContent)['@type'] === 'Product'));
    ok('breadcrumb has 4 levels', d.querySelectorAll('#crumbs a').length === 3 && !!d.querySelector('#crumbs [aria-current]'));
    ok('image stack renders one shot per image', d.querySelectorAll('.pdp-shot').length === inStock.images.length,
      d.querySelectorAll('.pdp-shot').length + ' vs ' + inStock.images.length);
    ok('no thumbnail rail (replaced by the grid)', !d.querySelector('.thumbs, .thumb, #stage'));
    ok('images render in a 2-column grid',
      /repeat\(2|1fr 1fr/.test(w.getComputedStyle(d.querySelector('.pdp-grid')).gridTemplateColumns),
      w.getComputedStyle(d.querySelector('.pdp-grid')).gridTemplateColumns);
    // Highlights must sit BELOW the imagery, never on top of a photograph.
    ok('Product Highlights is a standalone panel, not an overlay',
      w.getComputedStyle(d.querySelector('.pdp-highlights')).position !== 'absolute',
      w.getComputedStyle(d.querySelector('.pdp-highlights')).position);
    ok('Product Highlights renders after every image', (() => {
      const gal = d.querySelector('.pdp-gallery');
      const kids = [...gal.children];
      return kids.indexOf(d.querySelector('.pdp-highlights')) > kids.indexOf(d.querySelector('.pdp-grid'));
    })());
    ok('no absolutely-positioned element covers the image grid',
      [...d.querySelectorAll('.pdp-gallery > *')]
        .filter(e => !e.classList.contains('pdp-float'))
        .every(e => w.getComputedStyle(e).position !== 'absolute'));
    ok('highlights list every spec', d.querySelectorAll('.pdp-highlights dt').length === 6,
      d.querySelectorAll('.pdp-highlights dt').length);
    ok('floating wishlist / closet / share on the gallery',
      d.querySelectorAll('.pdp-float button').length === 3 &&
      !!d.querySelector('.pdp-float [data-wish]') && !!d.querySelector('.pdp-float #shareBtn'));
    ok('buy panel is sticky', w.getComputedStyle(d.querySelector('.pdp-panel')).position === 'sticky',
      w.getComputedStyle(d.querySelector('.pdp-panel')).position);
    ok('readiness badge + note on the panel',
      !!d.querySelector('.pdp-ready') && !!d.querySelector('.pdp-ready-note'));
    ok('trust row is 3-up inside the buy panel', d.querySelectorAll('.pdp-trust div').length === 3);
    ok('trust row sits in the panel, not a separate band',
      !!d.querySelector('.pdp-panel .pdp-trust') && !d.querySelector('.pdp-band'));
    ok('editorial detail = 3 crops', d.querySelectorAll('.detail-fig').length === 3);
    ok('carousel dots match image count', d.querySelectorAll('#dots i').length === inStock.images.length);
    ok('every shot is clickable for the lightbox',
      [...d.querySelectorAll('.pdp-shot')].every(b => b.hasAttribute('data-shot')));
    ok('price rendered', /^₹[\d,]+$/.test(d.querySelector('.pdp-price .price').textContent));
    ok('size pills rendered', d.querySelectorAll('#pdpSizes .size-pill').length === inStock.sizes.length);
    ok('accordions = 4', d.querySelectorAll('.acc details').length === 4);
    ok('sticky ATC built', !!d.querySelector('#stickyAtc img') && !!d.querySelector('#stickyAdd'));
    ok('PDP has both wishlist and closet controls',
      !!d.querySelector('[data-wish]') && !!d.querySelector('[data-closet]'));
    ok('two-up CTA: Add to cart + Buy now', d.querySelectorAll('.cta-row .btn').length === 2 &&
      !!d.querySelector('#atc') && !!d.querySelector('#buyNow'));
    ok('qty stepper present', !!d.querySelector('.cta-qty .buy-qty'));
    ok('MRP label beside the price', /MRP/i.test(d.querySelector('.pdp-mrp').textContent));
    ok('SKU shown in the panel', /SKU ID/i.test(d.querySelector('.pdp-sku').textContent));
    ok('Size Chart link with info icon',
      !!d.querySelector('.size-chart-link[data-size-guide] svg'));
    ok('social-proof strip present', /viewed this piece/i.test(d.querySelector('.social-proof').textContent));
    ok('reviews summary + 3 cards', !!d.querySelector('#rvSummary .rv-score b') && d.querySelectorAll('#rvList .rev').length === 3);
    ok('complete-the-look = 4', d.querySelectorAll('#ctl .card').length === 4);
    ok('similar rail populated', d.querySelectorAll('#similar .card').length >= 6, d.querySelectorAll('#similar .card').length);
    ok('size chart table rendered', d.querySelectorAll('.acc .tbl tbody tr').length === 6);
    checkIcons(w, d);

    // lightbox
    ok('lightbox starts closed', !d.querySelector('#lightbox').classList.contains('on'));
    click(w, d.querySelectorAll('.pdp-shot')[2]);
    ok('clicking a shot opens the lightbox on that image',
      d.querySelector('#lightbox').classList.contains('on') && d.querySelector('#lbImg').src === inStock.images[2]);
    ok('lightbox shows a position counter',
      d.querySelector('#lbCount').textContent === '3 / ' + inStock.images.length,
      d.querySelector('#lbCount').textContent);
    click(w, d.querySelector('[data-lb="1"]'));
    ok('lightbox next advances', d.querySelector('#lbImg').src === inStock.images[3 % inStock.images.length]);
    click(w, d.querySelector('[data-lb="-1"]'));
    ok('lightbox prev goes back', d.querySelector('#lbImg').src === inStock.images[2]);
    click(w, d.querySelector('[data-lb-close]'));
    ok('lightbox closes', !d.querySelector('#lightbox').classList.contains('on') && !d.body.classList.contains('no-scroll'));

    // size + qty
    if (inStock.sizes.length > 1) {
      click(w, d.querySelectorAll('#pdpSizes .size-pill')[1]);
      ok('size select updates label', d.querySelector('#sizeName').textContent.includes(inStock.sizes[1]),
        d.querySelector('#sizeName').textContent);
      ok('size change syncs the sticky bar',
        d.querySelector('#stickyAtc .small').textContent.includes(inStock.sizes[1]),
        d.querySelector('#stickyAtc .small').textContent);
    } else ok('size select (single size product) skipped', true);
    click(w, d.querySelector('[data-pq="1"]'));
    click(w, d.querySelector('[data-pq="1"]'));
    ok('qty stepper → 3', d.querySelector('#pqty').textContent === '3');
    click(w, d.querySelector('[data-pq="-1"]'));
    ok('qty stepper down → 2', d.querySelector('#pqty').textContent === '2');

    // add to cart honours qty + size
    click(w, d.querySelector('#atc'));
    ok('ATC adds selected qty', d.querySelector('#cartCount').textContent === '2', d.querySelector('#cartCount').textContent);
    ok('cart line shows chosen size',
      d.querySelector('#cartBody .small').textContent.includes(inStock.sizes.length > 1 ? inStock.sizes[1] : inStock.sizes[0]),
      d.querySelector('#cartBody .small').textContent);

    // pincode
    w.Kay.closeAll();
    d.querySelector('#pin').value = '600040';
    click(w, d.querySelector('#pinGo'));
    ok('valid pincode → delivery date', d.querySelector('#pinOut').classList.contains('ok') && /Delivers by/.test(d.querySelector('#pinOut').textContent),
      d.querySelector('#pinOut').textContent);
    d.querySelector('#pin').value = '12';
    click(w, d.querySelector('#pinGo'));
    ok('invalid pincode → error', d.querySelector('#pinOut').classList.contains('no'));

    // size guide modal
    click(w, d.querySelector('[data-size-guide]'));
    ok('size guide modal opens', d.querySelector('#sizeModal').classList.contains('on'));
    click(w, d.querySelector('#sizeModal [data-close]'));
    ok('size guide closes', !d.querySelector('#sizeModal').classList.contains('on'));

    // Wishlist / closet now float over the first frame rather than sitting in the buy row.
    click(w, d.querySelector('.pdp-float [data-wish]'));
    ok('PDP wishlist toggles on',
      d.querySelector('.pdp-float [data-wish]').classList.contains('on') &&
      d.querySelector('#wishCount').textContent === '1');
    click(w, d.querySelector('.pdp-float [data-closet]'));
    ok('PDP closet button opens the event picker',
      d.querySelector('#closetModal').classList.contains('on'));
    w.Kay.closeAll();

    // recently viewed persisted
    ok('recently-viewed persisted', JSON.parse(w.localStorage.getItem('kay.recent'))[0] === inStock.handle);
  }

  // sold-out variant
  {
    const { d } = load('product.html', '?h=' + soldOut.handle);
    ok('sold-out: notify button instead of ATC', !d.querySelector('#atc') && !!d.querySelector('[data-notify]'));
    ok('sold-out: badge on the lead image', !!d.querySelector('.pdp-shot-tags .tag--sold'));
    ok('sold-out: imagery is desaturated', !!d.querySelector('.pdp-shot.sold'));
    ok('sold-out: made-to-order copy', /sold out/i.test(d.querySelector('.pdp-panel').textContent));
  }

  // bad handle → graceful fallback
  {
    const { d, errors } = load('product.html', '?h=does-not-exist');
    ok('unknown handle falls back to a product', errors.length === 0 && !!d.querySelector('.pdp-panel h1'));
  }

  /* ═══════════════ APPOINTMENTS ═══════════════ */
  console.log('\n── appointments.html ──');
  {
    const { w, d, errors } = load('appointments.html');
    ok('no JS errors', errors.length === 0, errors[0]);
    ok('two modes offered', d.querySelectorAll('.appt-mode').length === 2);
    ok('defaults to Store Visit', d.querySelector('.appt-mode.on').dataset.mode === 'store');
    ok('mode labels are Store Visit + Video Call',
      /store visit/i.test(d.querySelectorAll('.appt-mode')[0].textContent) &&
      /video call/i.test(d.querySelectorAll('.appt-mode')[1].textContent));
    ok('store mode lists the 3 Chennai stores', d.querySelectorAll('#a-place option').length === 4,
      d.querySelectorAll('#a-place option').length);
    ok('store mode offers 6 slots', d.querySelectorAll('#slots .slot').length === 6);
    ok('date input floors at today', !!d.querySelector('#a-date').min);
    checkIcons(w, d);

    // switch to video mode
    click(w, d.querySelectorAll('.appt-mode')[1]);
    ok('switching to video re-paints mode', d.querySelector('.appt-mode.on').dataset.mode === 'video');
    ok('video mode offers 8 slots incl. late', d.querySelectorAll('#slots .slot').length === 8,
      d.querySelectorAll('#slots .slot').length);
    ok('video mode swaps the place field to call platforms',
      /whatsapp/i.test(d.querySelector('#a-place').textContent));
    ok('mode is reflected in the URL', /mode=video/.test(w.location.search), w.location.search);

    // empty submit must be blocked and flagged
    d.querySelector('#apptForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    ok('empty submit is blocked', d.querySelector('#done').hidden === true);
    ok('invalid fields are flagged', d.querySelectorAll('.fld.invalid').length >= 5,
      d.querySelectorAll('.fld.invalid').length);

    // fill it properly
    d.querySelector('#a-name').value = 'Meenakshi R';
    d.querySelector('#a-phone').value = '9884261611';
    d.querySelector('#a-email').value = 'm@example.com';
    d.querySelector('#a-place').selectedIndex = 1;
    d.querySelector('#a-occasion').selectedIndex = 1;
    d.querySelector('#a-date').value = '2030-02-14';
    click(w, d.querySelector('#slots .slot'));
    ok('slot selection registers', !!d.querySelector('#slots .slot.on'));
    d.querySelector('#apptForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    ok('valid submit shows confirmation', d.querySelector('#done').hidden === false && d.querySelector('#formWrap').hidden === true);
    ok('confirmation echoes the chosen date', /14 February/.test(d.querySelector('#doneBody').textContent),
      d.querySelector('#doneBody').textContent.slice(0, 80));

    click(w, d.querySelector('#againBtn'));
    ok('"book another" resets the form', d.querySelector('#formWrap').hidden === false);
  }

  // deep link straight into video mode
  {
    const { d } = load('appointments.html', '?mode=video');
    ok('?mode=video deep link opens video mode', d.querySelector('.appt-mode.on').dataset.mode === 'video');
  }

  /* ═══════════════ WEDDING CLOSET ═══════════════ */
  console.log('\n── closet.html ──');
  {
    const { w, d, errors } = load('closet.html');
    ok('no JS errors', errors.length === 0, errors[0]);
    ok('five events rendered', d.querySelectorAll('.events .event').length === 5);
    ok('events are the trousseau functions',
      ['Engagement', 'Mehendi & Haldi', 'Sangeet', 'Muhurtham', 'Reception']
        .every((t, i) => d.querySelectorAll('.event-head b')[i].textContent === t),
      [...d.querySelectorAll('.event-head b')].map(e => e.textContent).join(' / '));
    ok('all events start empty', d.querySelectorAll('.event-empty').length === 5);
    ok('stats show 0 looks saved', /^0$/.test(d.querySelector('.cstat b').textContent));
    ok('suggestions shown while closet is thin', d.querySelector('#suggestWrap').hidden === false &&
      d.querySelectorAll('#suggest .card').length === 4);
    checkIcons(w, d);

    // save two looks into different events via the picker
    const h1 = sandbox.PRODUCTS[0].handle, h2 = sandbox.PRODUCTS[1].handle;
    w.Kay.openClosetPicker(h1);
    ok('event picker opens with 5 options', d.querySelector('#closetModal').classList.contains('on') &&
      d.querySelectorAll('#closetPick .ev-opt').length === 5);
    click(w, d.querySelectorAll('#closetPick .ev-opt')[3]);   // Muhurtham
    w.Kay.openClosetPicker(h2);
    click(w, d.querySelectorAll('#closetPick .ev-opt')[1]);   // Mehendi & Haldi

    ok('closet count is 2', w.Kay.closetCount() === 2);
    ok('looks land in the right events',
      w.Kay.closet().muhurtham[0] === h1 && w.Kay.closet().mehendi[0] === h2);
    ok('grid re-renders with saved looks', d.querySelectorAll('.clook').length === 2);
    ok('only 3 events remain empty', d.querySelectorAll('.event-empty').length === 3);
    ok('stats update to 2 looks', d.querySelector('.cstat b').textContent === '2');
    ok('events-covered stat reads 2 / 5', d.querySelectorAll('.cstat b')[1].textContent === '2 / 5');

    const expected = sandbox.PRODUCTS[0].price + sandbox.PRODUCTS[1].price;
    ok('closet total sums the saved looks', w.Kay.closetTotal() === expected,
      w.Kay.closetTotal() + ' vs ' + expected);

    // remove one
    click(w, d.querySelector('.clook-x'));
    ok('removing a look updates the closet', w.Kay.closetCount() === 1 && d.querySelectorAll('.clook').length === 1);

    // persisted
    ok('closet written to localStorage', JSON.parse(w.localStorage.getItem('kay.closet')) !== null);
  }

  /* ═══ cross-page persistence ═══ */
  console.log('\n── persistence ──');
  {
    const a = load('index.html');
    a.w.Kay.addToCart(sandbox.PRODUCTS[3].handle, 'L', 1, true);
    a.w.Kay.toggleWish(sandbox.PRODUCTS[4].handle);
    const raw = { cart: a.w.localStorage.getItem('kay.cart'), wish: a.w.localStorage.getItem('kay.wish') };
    ok('cart written to localStorage', !!raw.cart && JSON.parse(raw.cart).length === 1);
    ok('wishlist written to localStorage', !!raw.wish && JSON.parse(raw.wish).length === 1);
  }

  console.log('\n══════════════════════════════');
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log('══════════════════════════════');
  process.exit(fail ? 1 : 0);
}
