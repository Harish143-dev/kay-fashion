/* ==========================================================================
   KAY — shared application layer
   Renders site chrome (header / drawers / footer / mobile nav) and drives
   cart, wishlist, search, quick view and toasts across every page.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------- Utilities ---------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const P  = window.PRODUCTS || [];

  const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const money = n => '₹' + inr.format(Math.round(n));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('kay.' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('kay.' + k, JSON.stringify(v)); } catch { /* private mode */ } }
  };

  const byHandle = h => P.find(p => p.handle === h);
  const FREE_SHIP = 20000;

  /* The five events a Chennai trousseau is actually bought for. */
  const EVENTS = [
    { k: 'engagement', t: 'Engagement',      s: 'The first look' },
    { k: 'mehendi',    t: 'Mehendi & Haldi', s: 'Daytime, lightweight' },
    { k: 'sangeet',    t: 'Sangeet',         s: 'Built to move in' },
    { k: 'muhurtham',  t: 'Muhurtham',       s: 'The ceremony' },
    { k: 'reception',  t: 'Reception',       s: 'The last impression' }
  ];
  window.KayEvents = EVENTS;

  /* ---------------- Icons ---------------- */
  const I = {
    search:  '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    play:    '<path d="M9 6.5l9 5.5-9 5.5v-11z"/>',
    user:    '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    heart:   '<path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20z"/>',
    bag:     '<path d="M6 8h12l1 12H5L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    menu:    '<path d="M4 7h16M4 12h16M4 17h10"/>',
    x:       '<path d="M6 6l12 12M18 6L6 18"/>',
    down:    '<path d="M4 8l6 6 6-6"/>',
    left:    '<path d="M14 5l-7 7 7 7"/>',
    right:   '<path d="M9 5l7 7-7 7"/>',
    plus:    '<path d="M12 5v14M5 12h14"/>',
    minus:   '<path d="M5 12h14"/>',
    check:   '<path d="M4 12l5 5L20 6"/>',
    star:    '<path d="M12 2.5l2.9 5.9 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.4l1.2-6.5L2.5 9.3l6.6-.9L12 2.5z"/>',
    truck:   '<path d="M2 7h11v9H2z"/><path d="M13 10h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    swap:    '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    shield:  '<path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z"/><path d="M9.2 12.2l2 2 3.6-4"/>',
    pin:     '<path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    phone:   '<path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 6.2 2 2 0 0 1 5 4z"/>',
    mail:    '<path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/>',
    clock:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    video:   '<path d="M3 7h11v10H3z"/><path d="M14 11l6-3.5v9L14 13z"/>',
    scissors:'<circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><path d="M8 7.5L20 18M8 16.5L20 6"/>',
    sparkle: '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3z"/><path d="M18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/>',
    gift:    '<path d="M3 10h18v10H3z"/><path d="M3 7h18v3H3zM12 7v13"/><path d="M12 7S10 3.5 8 4.5 9 7 12 7zM12 7s2-3.5 4-2.5S15 7 12 7z"/>',
    ig:      '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/>',
    fb:      '<path d="M14.5 8.5H17V5.5h-2.5C12.6 5.5 11 7 11 9v2H8.5v3H11v6h3v-6h2.3l.7-3H14V9.4c0-.5.2-.9.5-.9z"/>',
    yt:      '<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M11 9.8l4 2.2-4 2.2z"/>',
    pin2:    '<path d="M9 19c2-3 1.5-6 1.5-6M12 3.5a6 6 0 0 0-2.5 11.4"/><circle cx="12" cy="9.5" r="6"/>',
    wa:      '<path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.85c0 1.9.5 3.7 1.44 5.3L2 22l4.98-1.6a9.8 9.8 0 0 0 5.06 1.4c5.44 0 9.84-4.4 9.84-9.85C21.88 6.4 17.48 2 12.04 2zm5.72 13.9c-.24.68-1.4 1.3-1.94 1.35-.5.06-1.13.08-1.82-.11a15 15 0 0 1-1.65-.61c-2.9-1.26-4.8-4.2-4.94-4.4-.15-.2-1.2-1.58-1.2-3.02 0-1.44.76-2.14 1.03-2.44.27-.3.58-.37.78-.37h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.11.31.02.5-.09.2-.13.31-.27.48l-.4.47c-.13.14-.27.29-.12.56.15.28.67 1.1 1.43 1.79.99.87 1.82 1.15 2.08 1.28.26.14.41.12.56-.07.15-.2.65-.75.82-1.01.17-.26.34-.22.57-.13.24.09 1.5.7 1.76.83.26.13.43.2.5.31.06.11.06.64-.18 1.32z" fill="currentColor" stroke="none"/>',
    home:    '<path d="M4 11l8-6.5 8 6.5v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    grid:    '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
    grid2:   '<rect x="4" y="4" width="16" height="7"/><rect x="4" y="13" width="16" height="7"/>',
    filter:  '<path d="M3 6h18M6 12h12M10 18h4"/>',
    ruler:   '<path d="M3 9h18v6H3z"/><path d="M7 9v3M11 9v4M15 9v3M19 9v4"/>',
    tag:     '<path d="M3 12V4h8l9 9-8 8-9-9z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
    leaf:    '<path d="M20 4C10 4 4 9 4 16c0 2 .8 3.4.8 3.4S8 12 20 4z"/><path d="M4.8 19.4C4.8 19.4 12 20 16 15"/>',
    loom:    '<path d="M3 5h18M3 19h18"/><path d="M6 5v14M10 5v14M14 5v14M18 5v14"/><path d="M3 12h18"/>',
    hanger:  '<path d="M12 7a2 2 0 1 1 2-2"/><path d="M12 7v2.5L3.5 15.5a1 1 0 0 0 .6 1.8h15.8a1 1 0 0 0 .6-1.8L12 9.5"/>',
    cal:     '<rect x="3.5" y="5" width="17" height="15.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    share:   '<circle cx="18" cy="5.5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4"/>',
    info:    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6v.6"/>',
    store:   '<path d="M4 10v10h16V10"/><path d="M3 5h18l1 5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M10 20v-6h4v6"/>'
  };
  const ico = (n, cls) => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${I[n] || ''}</svg>`;
  window.KayIcon = ico;

  const stars = r => {
    let h = '<span class="stars" aria-hidden="true">';
    for (let i = 1; i <= 5; i++) h += `<svg viewBox="0 0 24 24"${i <= Math.round(r) ? '' : ' class="off"'}>${I.star}</svg>`;
    return h + '</span>';
  };
  window.KayStars = stars;

  /* ---------------- Nav data ---------------- */
  const MEGA = {
    Sarees: {
      cols: [
        ['Shop by Weave', ['Kanchipuram Silk', 'Banarasi', 'Soft Silk', 'Handloom', 'Linen Silk', 'Organza']],
        ['Shop by Craft', ['Zari Woven', 'Embroidered', 'Printed', 'Patola', 'Chanderi']],
        ['Shop by Price', ['Under ₹5,000', '₹5,000 – ₹10,000', '₹10,000 – ₹20,000', 'Above ₹20,000']],
        ['Featured', ['New Arrivals', 'Bestsellers', 'Ready to Ship', 'Bridal Sarees', 'Gifting']]
      ],
      card: { t: 'The Handloom Edit', s: 'Woven in Kanchipuram', href: 'collection.html?c=Sarees' }
    },
    Lehengas: {
      cols: [
        ['Shop by Style', ['Bridal Lehenga', 'Lehenga Choli', 'Ready Choli', 'Sharara Set', 'Gharara']],
        ['Shop by Fabric', ['Net', 'Georgette', 'Organza', 'Silk', 'Velvet']],
        ['Shop by Occasion', ['Wedding', 'Reception', 'Sangeet', 'Mehendi', 'Engagement']],
        ['Featured', ['New Arrivals', 'Ready to Ship', 'Under ₹20,000', 'Bridal Trousseau']]
      ],
      card: { t: 'Bridal 2026', s: 'The Trousseau Edit', href: 'collection.html?c=Lehengas' }
    },
    'Festive Wear': {
      cols: [
        ['Silhouettes', ['Anarkali', 'Palazzo Set', 'Salwar Suit', 'Croptop Set', 'Gown', 'Kurti']],
        ['Shop by Fabric', ['Georgette', 'Silk', 'Chanderi', 'Organza', 'Crepe']],
        ['Shop by Occasion', ['Festive', 'Cocktail', 'Sangeet', 'Mehendi', 'Everyday']],
        ['Featured', ['New Arrivals', 'Ready to Ship', 'Under ₹10,000', 'Bestsellers']]
      ],
      card: { t: 'Festive Pret', s: 'Ready to wear, ready to go', href: 'collection.html?c=Festive' }
    }
  };

  /* ---------------- Site chrome ---------------- */
  function headerHTML() {
    const megaCard = k => {
      const m = MEGA[k], img = pickImage(k);
      return `<a class="mega-card" href="${m.card.href}">
        <img src="${img}" alt="" loading="lazy" width="420" height="315">
        <figcaption><b>${esc(m.card.t)}</b><span>${esc(m.card.s)}</span></figcaption></a>`;
    };
    const megaFor = k => `<div class="mega"><div class="wrap"><div class="mega-inner">
      ${MEGA[k].cols.map(([h, items]) => `<div><h5>${esc(h)}</h5><ul>${
        items.map(i => `<li><a href="collection.html?q=${encodeURIComponent(i)}">${esc(i)}</a></li>`).join('')
      }</ul></div>`).join('')}
      ${megaCard(k)}
    </div></div></div>`;

    const social = [['ig', 'Instagram', 'https://instagram.com/kay_annanagar'],
                    ['fb', 'Facebook', 'https://facebook.com/kayfashions'],
                    ['yt', 'YouTube', '#youtube'], ['pin2', 'Pinterest', '#pinterest']];
    const util = [['Wedding Closet', 'closet.html'], ['Appointments', 'appointments.html'],
                  ['Stores', 'index.html#stores'], ['Our Story', 'index.html#story']];

    return `
    <div class="announce">
      <div class="wrap">
        <nav class="announce-links" aria-label="Secondary">
          ${util.map(([t, u]) => `<a class="announce-side" href="${u}">${t}</a>`).join('')}
        </nav>
        <div class="announce-track" id="announce"></div>
        <div class="announce-social">
          ${social.map(([i, l, u]) => `<a href="${u}" aria-label="${l}">${ico(i)}</a>`).join('')}
        </div>
      </div>
    </div>
    <header class="header" id="header">
      <div class="wrap header-inner">
        <button class="iconbtn burger" id="burger" aria-label="Open menu">${ico('menu')}</button>
        <nav aria-label="Primary"><ul class="nav">
          <li class="has-mega"><button aria-expanded="false">Sarees ${ico('down', 'nav-caret')}</button>${megaFor('Sarees')}</li>
          <li class="has-mega"><button aria-expanded="false">Lehengas ${ico('down', 'nav-caret')}</button>${megaFor('Lehengas')}</li>
          <li class="has-mega"><button aria-expanded="false">Festive Wear ${ico('down', 'nav-caret')}</button>${megaFor('Festive Wear')}</li>
          <li><a href="collection.html?c=Bridal">Bridal</a></li>
          <li><a href="collection.html?sale=1" class="hot">Sale</a></li>
        </ul></nav>

        <a class="logo" href="index.html" aria-label="Kay the Fashion Bay — home">
          <img src="assets/images/kaylogo.png" alt="Kay the Fashion Bay" width="240" height="129">
        </a>

        <div class="header-actions">
          <button class="iconbtn" id="openSearch" aria-label="Search">${ico('search')}</button>
          <a class="iconbtn desk-only" href="#account" aria-label="Account">${ico('user')}</a>
          <button class="iconbtn" id="openWish" aria-label="Wishlist">${ico('heart')}<i class="badge-count" id="wishCount">0</i></button>
          <button class="iconbtn" id="openCart" aria-label="Shopping bag">${ico('bag')}<i class="badge-count" id="cartCount">0</i></button>
        </div>
      </div>
    </header>`;
  }

  function pickImage(key) {
    const map = { Sarees: 'Sarees', Lehengas: 'Lehengas', 'Festive Wear': 'Gowns' };
    const p = P.find(x => x.category === map[key]) || P[0];
    return p ? p.images[0] : '';
  }

  function footerHTML() {
    const col = (h, items) => `<div><h5>${h}</h5><ul>${items.map(([t, u]) =>
      `<li><a href="${u}">${esc(t)}</a></li>`).join('')}</ul></div>`;
    return `
    <footer class="footer" id="footer">
      <div class="wrap footer-top">
        <div class="footer-brand">
          <a class="logo logo--footer" href="index.html"><img src="assets/images/kaylogo.png" alt="Kay the Fashion Bay" width="240" height="129"></a>
          <p>Chennai's ethnic wear house since 1994. Handloom sarees, bridal lehengas and festive pret — sourced from weaving clusters across India and finished in our own ateliers.</p>
          <div class="socials">
            <a href="https://instagram.com/kay_annanagar" aria-label="Instagram">${ico('ig')}</a>
            <a href="https://facebook.com/kayfashions" aria-label="Facebook">${ico('fb')}</a>
            <a href="#youtube" aria-label="YouTube">${ico('yt')}</a>
            <a href="#pinterest" aria-label="Pinterest">${ico('pin2')}</a>
          </div>
        </div>
        ${col('Shop', [['New Arrivals', 'collection.html?sort=new'], ['Sarees', 'collection.html?c=Sarees'],
          ['Lehengas', 'collection.html?c=Lehengas'], ['Gowns', 'collection.html?c=Gowns'],
          ['Anarkalis', 'collection.html?c=Anarkalis'], ['Sale', 'collection.html?sale=1']])}
        ${col('Services', [['Book an Appointment', 'appointments.html'], ['Video Call Styling', 'appointments.html?mode=video'],
          ['Wedding Closet', 'closet.html'], ['Custom Tailoring', 'appointments.html?mode=store'],
          ['Gift Cards', '#gift'], ['Store Locator', 'index.html#stores']])}
        ${col('Help', [['Shipping & Delivery', '#shipping'], ['Returns & Exchange', '#returns'],
          ['Size Guide', '#size'], ['Fabric Care', '#care'], ['Track Order', '#track'], ['FAQs', '#faq']])}
        <div>
          <h5>Get in touch</h5>
          <ul class="contact-list stack" style="--s:12px">
            <li>${ico('phone')}<span><a href="tel:+914442155740">+91 44 4215 5740</a><br><a href="https://wa.me/919884261611">WhatsApp +91 98842 61611</a></span></li>
            <li>${ico('mail')}<a href="mailto:info@kayfashions.in">info@kayfashions.in</a></li>
            <li>${ico('clock')}<span>Mon – Sun · 10:30 am – 8:30 pm IST</span></li>
          </ul>
        </div>
      </div>
      <div class="wrap footer-bottom">
        <p>© ${new Date().getFullYear()} Kay the Fashion Bay · Chennai, India. Concept redesign prototype.</p>
        <div class="row" style="gap:24px;flex-wrap:wrap">
          <div class="pay" aria-label="Payment methods">
            <span>UPI</span><span>VISA</span><span>MASTERCARD</span><span>RUPAY</span><span>AMEX</span><span>NETBANKING</span><span>EMI</span><span>COD</span>
          </div>
          <div class="row" style="gap:16px">
            <a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#refund">Refunds</a>
          </div>
        </div>
      </div>
    </footer>`;
  }

  function chromeHTML() {
    return `
    <div class="scrim" id="scrim"></div>

    <!-- Mobile menu. Carries everything the small-screen header and utility bar
         drop, so nothing becomes unreachable below 1024px. -->
    <aside class="drawer drawer--left" id="menuDrawer" aria-label="Menu" aria-hidden="true">
      <div class="drawer-head">
        <a class="logo logo--drawer" href="index.html"><img src="assets/images/kaylogo.png" alt="Kay the Fashion Bay" width="240" height="129"></a>
        <button class="close-x" data-close aria-label="Close menu">${ico('x')}</button>
      </div>
      <div class="drawer-body">
        <nav class="mnav" aria-label="Mobile">
          ${['Sarees', 'Lehengas', 'Festive Wear'].map(k => `
            <details class="mnav-group">
              <summary>${esc(k)} ${ico('down')}</summary>
              <div class="mnav-sub">
                ${MEGA[k].cols[0][1].map(i =>
                  `<a href="collection.html?q=${encodeURIComponent(i)}">${esc(i)}</a>`).join('')}
                <a href="${MEGA[k].card.href}" class="mnav-all">View all ${esc(k.toLowerCase())} ${ico('right')}</a>
              </div>
            </details>`).join('')}

          <a class="mnav-link" href="collection.html?c=Bridal">Bridal ${ico('right')}</a>
          <a class="mnav-link mnav-link--sale" href="collection.html?sale=1">Sale ${ico('right')}</a>

          <div class="mnav-sec">
            <h5>Concierge</h5>
            <a href="appointments.html">Book an appointment</a>
            <a href="appointments.html?mode=video">Video call styling</a>
            <a href="closet.html">My Wedding Closet</a>
            <a href="index.html#stores">Our stores</a>
            <a href="index.html#story">Our story</a>
            <a href="#track">Track my order</a>
          </div>

          <div class="mnav-contact">
            <a href="tel:+914442155740">${ico('phone')}+91 44 4215 5740</a>
            <a href="mailto:info@kayfashions.in">${ico('mail')}info@kayfashions.in</a>
            <div class="mnav-social">
              <a href="https://instagram.com/kay_annanagar" aria-label="Instagram">${ico('ig')}</a>
              <a href="https://facebook.com/kayfashions" aria-label="Facebook">${ico('fb')}</a>
              <a href="#youtube" aria-label="YouTube">${ico('yt')}</a>
              <a href="#pinterest" aria-label="Pinterest">${ico('pin2')}</a>
            </div>
          </div>
        </nav>
      </div>
      <div class="drawer-foot">
        <a class="btn btn--block" href="https://wa.me/919884261611">${ico('wa')} Chat with a stylist</a>
      </div>
    </aside>

    <!-- Cart -->
    <aside class="drawer" id="cartDrawer" aria-label="Shopping bag" aria-hidden="true">
      <div class="drawer-head">
        <div><h3>Shopping Bag</h3><p class="small" id="cartSub">0 items</p></div>
        <button class="close-x" data-close aria-label="Close">${ico('x')}</button>
      </div>
      <div class="ship-bar" id="shipBar">
        <p id="shipMsg"></p><div class="ship-track"><div class="ship-fill" id="shipFill"></div></div>
      </div>
      <div class="drawer-body" id="cartBody"></div>
      <div class="drawer-foot" id="cartFoot" hidden>
        <div class="totals">
          <div><span>Subtotal</span><span class="tnum" id="cartSubtotal">₹0</span></div>
          <div><span>Shipping</span><span id="cartShip">Calculated at checkout</span></div>
          <div class="grand"><span>Total</span><span class="tnum" id="cartTotal">₹0</span></div>
        </div>
        <button class="btn btn--wine btn--block" id="checkoutBtn">Proceed to checkout</button>
        <p class="small center" style="margin-top:12px;font-size:11.5px">Secure payment · UPI, Cards, NetBanking, EMI &amp; COD</p>
      </div>
    </aside>

    <!-- Wishlist -->
    <aside class="drawer" id="wishDrawer" aria-label="Wishlist" aria-hidden="true">
      <div class="drawer-head">
        <div><h3>Wishlist</h3><p class="small" id="wishSub">0 saved</p></div>
        <button class="close-x" data-close aria-label="Close">${ico('x')}</button>
      </div>
      <div class="drawer-body" id="wishBody"></div>
    </aside>

    <!-- Search -->
    <div class="search-ov" id="searchOv" role="dialog" aria-label="Search">
      <div class="search-head"><div class="wrap">
        ${ico('search', 'sicon')}
        <input class="search-input" id="searchInput" type="search" placeholder="Search sarees, lehengas, fabrics…" autocomplete="off">
        <button class="close-x" data-close aria-label="Close search">${ico('x')}</button>
      </div></div>
      <div class="wrap section-tight">
        <p class="eyebrow">Popular searches</p>
        <div class="search-suggest">
          ${['Kanchipuram Saree', 'Bridal Lehenga', 'Anarkali', 'Organza', 'Handloom', 'Under ₹5,000', 'Ready to Ship']
            .map(t => `<button class="chip" data-suggest="${esc(t)}">${esc(t)}</button>`).join('')}
        </div>
        <div id="searchResults" style="margin-top:38px"></div>
      </div>
    </div>

    <!-- Quick view -->
    <div class="modal" id="qvModal" role="dialog" aria-label="Quick view">
      <div class="modal-card"><button class="close-x modal-close" data-close aria-label="Close">${ico('x')}</button>
        <div id="qvBody"></div>
      </div>
    </div>

    <!-- Wedding Closet event picker -->
    <div class="modal" id="closetModal" role="dialog" aria-label="Save to Wedding Closet">
      <div class="modal-card modal-card--sm"><button class="close-x modal-close" data-close aria-label="Close">${ico('x')}</button>
        <div style="padding:40px 38px">
          <p class="eyebrow">Wedding Closet</p>
          <h3 class="d3" style="margin:10px 0 8px" id="closetPickTitle">Save this look</h3>
          <p class="small">Which event is it for? You can move it later, and everything stays saved between visits.</p>
          <div class="ev-pick" id="closetPick"></div>
          <a class="link-u" href="closet.html" style="margin-top:26px;display:inline-block">Open my Wedding Closet</a>
        </div>
      </div>
    </div>

    <!-- Size guide -->
    <div class="modal" id="sizeModal" role="dialog" aria-label="Size guide">
      <div class="modal-card modal-card--sm"><button class="close-x modal-close" data-close aria-label="Close">${ico('x')}</button>
        <div style="padding:34px">
          <p class="eyebrow">Fit</p><h3 class="d3" style="margin:8px 0 6px">Size Guide</h3>
          <p class="small" style="margin-bottom:22px">All measurements in inches. Our stitched garments include 2" of let-out allowance at the side seams.</p>
          <div class="table-scroll"><table class="tbl">
            <thead><tr><th>Size</th><th>Bust</th><th>Waist</th><th>Hip</th><th>Kurta length</th></tr></thead>
            <tbody>
              <tr><td>XS</td><td>32</td><td>26</td><td>35</td><td>44</td></tr>
              <tr><td>S</td><td>34</td><td>28</td><td>37</td><td>44</td></tr>
              <tr><td>M</td><td>36</td><td>30</td><td>39</td><td>45</td></tr>
              <tr><td>L</td><td>38</td><td>32</td><td>41</td><td>45</td></tr>
              <tr><td>XL</td><td>40</td><td>34</td><td>43</td><td>46</td></tr>
              <tr><td>2XL</td><td>42</td><td>36</td><td>45</td><td>46</td></tr>
            </tbody>
          </table></div>
          <p class="small" style="margin-top:20px">Between sizes, or need a custom fit?
            <a href="https://wa.me/919884261611" style="color:var(--wine);text-decoration:underline">WhatsApp our fit team</a> — custom tailoring adds 5–7 days.</p>
        </div>
      </div>
    </div>

    <div class="toasts" id="toasts" aria-live="polite"></div>

    <a class="fab" href="https://wa.me/919884261611" aria-label="Chat on WhatsApp">${ico('wa')}<span>Chat with a stylist</span></a>

    <nav class="mobnav" aria-label="Mobile">
      <a href="index.html" data-mob="home">${ico('home')}Home</a>
      <a href="collection.html" data-mob="shop">${ico('grid')}Shop</a>
      <a href="#" id="mobSearch">${ico('search')}Search</a>
      <a href="#" id="mobWish">${ico('heart')}<i class="badge-count" id="wishCount2">0</i>Saved</a>
      <a href="#" id="mobCart">${ico('bag')}<i class="badge-count" id="cartCount2">0</i>Bag</a>
    </nav>`;
  }

  /* ---------------- Toasts ---------------- */
  function toast(msg, icon = 'check') {
    const box = $('#toasts'); if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = ico(icon) + '<span>' + esc(msg) + '</span>';
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2900);
  }

  /* ---------------- Overlay control ---------------- */
  let openEl = null;
  function open(sel) {
    const el = $(sel); if (!el) return;
    if (openEl && openEl !== el) openEl.classList.remove('on');
    el.classList.add('on');
    el.setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('on');
    document.body.classList.add('no-scroll');
    openEl = el;
    const f = el.querySelector('input, button');
    if (f && el.id === 'searchOv') setTimeout(() => f.focus(), 260);
  }
  function closeAll() {
    $$('.drawer.on, .modal.on, .search-ov.on').forEach(el => { el.classList.remove('on'); el.setAttribute('aria-hidden', 'true'); });
    $('#scrim')?.classList.remove('on');
    document.body.classList.remove('no-scroll');
    openEl = null;
  }
  window.KayClose = closeAll;
  window.KayOpen = open;

  /* ---------------- Cart ---------------- */
  let cart = store.get('cart', []);
  let wish = store.get('wish', []);

  const cartKey = (h, s) => h + '::' + s;

  function addToCart(handle, size, qty = 1, silent) {
    const p = byHandle(handle); if (!p) return;
    size = size || p.sizes[0];
    const k = cartKey(handle, size);
    const line = cart.find(l => l.k === k);
    if (line) line.q += qty; else cart.push({ k, handle, size, q: qty });
    saveCart();
    if (!silent) { renderCart(); open('#cartDrawer'); toast(`${p.title} added to your bag`, 'bag'); }
  }
  function setQty(k, d) {
    const l = cart.find(x => x.k === k); if (!l) return;
    l.q += d;
    if (l.q < 1) cart = cart.filter(x => x.k !== k);
    saveCart(); renderCart();
  }
  function removeLine(k) { cart = cart.filter(x => x.k !== k); saveCart(); renderCart(); toast('Removed from bag', 'x'); }
  function saveCart() { store.set('cart', cart); paintCounts(); }
  const cartTotal = () => cart.reduce((s, l) => { const p = byHandle(l.handle); return s + (p ? p.price * l.q : 0); }, 0);
  const cartCount = () => cart.reduce((s, l) => s + l.q, 0);

  function paintCounts() {
    const c = cartCount(), w = wish.length;
    [['#cartCount', c], ['#cartCount2', c], ['#wishCount', w], ['#wishCount2', w]].forEach(([sel, n]) => {
      const el = $(sel); if (!el) return;
      el.textContent = n; el.classList.toggle('on', n > 0);
    });
    // Match on the data attribute, not a class — wishlist buttons appear as
    // .card-wish, .wishbig and the PDP floating control, and all must repaint.
    $$('[data-wish]').forEach(b => b.classList.toggle('on', wish.includes(b.dataset.wish)));
    $$('[data-closet]').forEach(b => b.classList.toggle('on', inCloset(b.dataset.closet)));
    const cc = closetCount();
    $$('[data-closet-count]').forEach(el => { el.textContent = cc; });
  }

  function renderCart() {
    const body = $('#cartBody'), foot = $('#cartFoot'); if (!body) return;
    $('#cartSub').textContent = cartCount() === 1 ? '1 item' : cartCount() + ' items';

    if (!cart.length) {
      body.innerHTML = `<div class="empty">${ico('bag')}<h4>Your bag is empty</h4>
        <p>Saved something you loved? It's waiting in your wishlist.</p>
        <a class="btn btn--ghost" href="collection.html">Start shopping</a></div>`;
      foot.hidden = true; $('#shipBar').style.display = 'none';
      return;
    }
    foot.hidden = false; $('#shipBar').style.display = '';

    body.innerHTML = cart.map(l => {
      const p = byHandle(l.handle); if (!p) return '';
      return `<div class="cart-line">
        <a href="product.html?h=${p.handle}"><img src="${p.images[0]}" alt="${esc(p.title)}" loading="lazy"></a>
        <div>
          <div class="between" style="align-items:flex-start">
            <div><h4><a href="product.html?h=${p.handle}">${esc(p.title)}</a></h4>
              <p class="small">${esc(p.fabric)} · Size ${esc(l.size)}</p></div>
            <b class="tnum" style="font-size:14px">${money(p.price * l.q)}</b>
          </div>
          <div class="cart-line-foot">
            <div class="qty">
              <button data-q="-1" data-k="${l.k}" aria-label="Decrease">${ico('minus')}</button>
              <span>${l.q}</span>
              <button data-q="1" data-k="${l.k}" aria-label="Increase">${ico('plus')}</button>
            </div>
            <button class="remove" data-rm="${l.k}">Remove</button>
          </div>
        </div></div>`;
    }).join('');

    const t = cartTotal();
    $('#cartSubtotal').textContent = money(t);
    $('#cartTotal').textContent = money(t);
    $('#cartShip').textContent = t >= FREE_SHIP ? 'Free' : '₹150';
    if (t < FREE_SHIP) $('#cartTotal').textContent = money(t + 150);

    const pct = Math.min(100, (t / FREE_SHIP) * 100);
    $('#shipFill').style.width = pct + '%';
    $('#shipMsg').innerHTML = t >= FREE_SHIP
      ? `${ico('check')} You've unlocked <b>free express shipping</b> — worldwide.`
      : `You're <b>${money(FREE_SHIP - t)}</b> away from free international shipping.`;
  }

  /* ---------------- Wishlist ---------------- */
  function toggleWish(handle) {
    const p = byHandle(handle); if (!p) return;
    const i = wish.indexOf(handle);
    if (i > -1) { wish.splice(i, 1); toast('Removed from wishlist', 'heart'); }
    else { wish.push(handle); toast(`${p.title} saved to wishlist`, 'heart'); }
    store.set('wish', wish); paintCounts(); renderWish();
  }
  function renderWish() {
    const body = $('#wishBody'); if (!body) return;
    $('#wishSub').textContent = wish.length === 1 ? '1 saved' : wish.length + ' saved';
    if (!wish.length) {
      body.innerHTML = `<div class="empty">${ico('heart')}<h4>Nothing saved yet</h4>
        <p>Tap the heart on any piece to keep it here across visits.</p>
        <a class="btn btn--ghost" href="collection.html">Browse the collection</a></div>`;
      return;
    }
    body.innerHTML = wish.map(h => {
      const p = byHandle(h); if (!p) return '';
      return `<div class="cart-line">
        <a href="product.html?h=${p.handle}"><img src="${p.images[0]}" alt="${esc(p.title)}" loading="lazy"></a>
        <div>
          <h4><a href="product.html?h=${p.handle}">${esc(p.title)}</a></h4>
          <p class="small">${esc(p.fabric)} · ${esc(p.category)}</p>
          <b class="tnum" style="display:block;margin-top:6px">${money(p.price)}</b>
          <div class="cart-line-foot">
            ${p.available
              ? `<button class="btn btn--sm" data-add="${p.handle}">Add to bag</button>`
              : `<button class="btn btn--sm btn--ghost" data-notify="${p.handle}">Notify me</button>`}
            <button class="remove" data-unwish="${p.handle}">Remove</button>
          </div>
        </div></div>`;
    }).join('');
  }

  /* ---------------- Wedding Closet ----------------
     A per-event trousseau planner. A bride buys for five events, not one
     basket, so looks are grouped by event rather than piled into a wishlist. */
  let closet = store.get('closet', {});

  const closetAll = () => EVENTS.flatMap(e => (closet[e.k] || []).map(h => ({ ev: e.k, handle: h })));
  const closetCount = () => closetAll().length;
  const inCloset = h => EVENTS.some(e => (closet[e.k] || []).includes(h));
  const closetTotal = () => closetAll().reduce((s, l) => { const p = byHandle(l.handle); return s + (p ? p.price : 0); }, 0);

  function closetToggle(handle, evKey) {
    const list = closet[evKey] || (closet[evKey] = []);
    const i = list.indexOf(handle);
    const ev = EVENTS.find(e => e.k === evKey);
    if (i > -1) { list.splice(i, 1); toast(`Removed from ${ev.t}`, 'x'); }
    else { list.push(handle); toast(`Saved to ${ev.t}`, 'hanger'); }
    store.set('closet', closet);
    paintCounts(); paintClosetPick(handle);
    document.dispatchEvent(new CustomEvent('kay:closet'));
  }
  function closetRemove(handle, evKey) {
    closet[evKey] = (closet[evKey] || []).filter(h => h !== handle);
    store.set('closet', closet); paintCounts();
    toast('Removed from your closet', 'x');
    document.dispatchEvent(new CustomEvent('kay:closet'));
  }

  let pickHandle = null;
  function paintClosetPick(handle) {
    const box = $('#closetPick'); if (!box) return;
    box.innerHTML = EVENTS.map(e => {
      const on = (closet[e.k] || []).includes(handle);
      return `<button class="ev-opt${on ? ' on' : ''}" data-ev="${e.k}">
        <span><b>${esc(e.t)}</b><span>${esc(e.s)}</span></span>${ico('check')}</button>`;
    }).join('');
  }
  function openClosetPicker(handle) {
    const p = byHandle(handle); if (!p) return;
    pickHandle = handle;
    $('#closetPickTitle').textContent = p.title;
    paintClosetPick(handle);
    open('#closetModal');
  }

  /* ---------------- Product card ---------------- */
  function card(p, opts = {}) {
    const off = p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
    const tags = [];
    if (!p.available) tags.push('<span class="tag tag--sold">Sold Out</span>');
    else if (off) tags.push(`<span class="tag tag--sale">${off}% Off</span>`);
    else if (p.badge === 'New In') tags.push('<span class="tag tag--new">New In</span>');
    else if (p.badge === 'Bestseller') tags.push('<span class="tag">Bestseller</span>');
    if (p.available && p.readyToShip) tags.push('<span class="tag tag--rts">Ready to Ship</span>');

    const img2 = p.images[1] || p.images[0];
    // Locally hosted shots ship a 520px rendition for grids; the Shopify CDN
    // products have no thumb and fall back to the full image.
    const img1 = p.thumb || p.images[0];
    // .card-frame is the positioning context for every overlay control, so they
    // resolve against the IMAGE box rather than the full card (body included).
    return `<article class="card">
      <div class="card-frame">
        <a class="card-media${p.available ? '' : ' sold'}" href="product.html?h=${p.handle}" aria-label="${esc(p.title)}">
          <img class="img-a" src="${img1}" alt="${esc(p.title)}" loading="lazy" width="600" height="750">
          <img class="img-b" src="${img2}" alt="" loading="lazy" aria-hidden="true" width="600" height="750">
        </a>
        <div class="card-tags">${tags.join('')}</div>
        <button class="card-closet${inCloset(p.handle) ? ' on' : ''}" data-closet="${p.handle}" aria-label="Save ${esc(p.title)} to Wedding Closet">${ico('hanger')}</button>
        <button class="card-wish" data-wish="${p.handle}" aria-label="Save ${esc(p.title)}">${ico('heart')}</button>
        ${p.available ? `<button class="card-quick" data-qv="${p.handle}">Quick view</button>` : ''}
      </div>
      <div class="card-body">
        <span class="card-cat">${esc(p.category)} · ${esc(p.fabric)}</span>
        <a class="card-title" href="product.html?h=${p.handle}">${esc(p.title)}</a>
        <div class="card-price">
          <span class="price tnum">${money(p.price)}</span>
          ${p.compareAt ? `<span class="price-was tnum">${money(p.compareAt)}</span><span class="price-off">${off}% off</span>` : ''}
        </div>
        <span class="card-ready" data-r="${esc(p.readiness)}">${esc(p.readiness)}</span>
        <div class="card-meta">${stars(p.rating)}<span>${p.rating} (${p.reviews})</span></div>
        ${opts.noSwatch ? '' : `<div class="card-swatches"><span class="sw on" style="background:${p.hex}" title="${esc(p.color)}"></span>
          ${relatedColors(p).map(c => `<span class="sw" style="background:${c}"></span>`).join('')}</div>`}
      </div>
    </article>`;
  }
  window.KayCard = card;

  function relatedColors(p) {
    return P.filter(x => x.category === p.category && x.hex !== p.hex)
            .slice(0, 3).map(x => x.hex);
  }

  /* ---------------- Quick view ---------------- */
  function quickView(handle) {
    const p = byHandle(handle); if (!p) return;
    const off = p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
    $('#qvBody').innerHTML = `<div class="qv">
      <div class="qv-media"><img src="${p.images[0]}" alt="${esc(p.title)}"></div>
      <div class="qv-body">
        <span class="pdp-cat">${esc(p.category)}</span>
        <h2 class="d3" style="margin:8px 0 10px">${esc(p.title)}</h2>
        <div class="pdp-rate">${stars(p.rating)}<span>${p.rating} · ${p.reviews} reviews</span></div>
        <div class="pdp-price">
          <span class="price tnum">${money(p.price)}</span>
          ${p.compareAt ? `<span class="price-was tnum">${money(p.compareAt)}</span><span class="price-off">${off}% off</span>` : ''}
        </div>
        <p class="small" style="margin-top:2px">Inclusive of all taxes · ${esc(p.fabric)} · SKU ${esc(p.sku)}</p>

        <div class="opt-block">
          <div class="opt-head"><b>Colour: <span>${esc(p.color)}</span></b></div>
          <div class="color-row"><span class="color-dot on" style="background:${p.hex}"></span></div>
        </div>
        <div class="opt-block">
          <div class="opt-head"><b>Size</b><button data-size-guide>Size guide</button></div>
          <div class="size-grid" id="qvSizes">
            ${p.sizes.map((s, i) => `<button class="size-pill${i === 0 ? ' on' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>
        </div>
        <div class="pdp-actions">
          <button class="btn btn--wine" data-qv-add="${p.handle}">Add to bag</button>
          <button class="wishbig" data-wish="${p.handle}" aria-label="Save">${ico('heart')}</button>
        </div>
        <a class="link-u" href="product.html?h=${p.handle}" style="margin-top:20px;align-self:flex-start">View full details</a>
      </div></div>`;
    open('#qvModal');
    paintCounts();
  }

  /* ---------------- Search ---------------- */
  function search(q) {
    q = q.trim().toLowerCase();
    const box = $('#searchResults');
    if (!q) { box.innerHTML = trending(); return; }

    const priceCap = /under\s*₹?\s*([\d,]+)/.exec(q);
    let hits = P.filter(p => {
      const hay = `${p.title} ${p.category} ${p.fabric} ${p.color} ${p.type} ${p.occasions.join(' ')} ${p.sku}`.toLowerCase();
      return q.split(/\s+/).every(w => hay.includes(w.replace(/[₹,]/g, '')) || hay.includes(w));
    });
    if (priceCap) {
      const cap = +priceCap[1].replace(/,/g, '');
      hits = P.filter(p => p.price <= cap);
    }
    if (/ready.?to.?ship/.test(q)) hits = P.filter(p => p.readyToShip && p.available);

    box.innerHTML = hits.length
      ? `<div class="between" style="margin-bottom:20px"><p class="eyebrow">${hits.length} result${hits.length > 1 ? 's' : ''}</p>
           <a class="link-u" href="collection.html?q=${encodeURIComponent(q)}">See all in shop</a></div>
         <div class="pgrid">${hits.slice(0, 8).map(p => card(p, { noSwatch: true })).join('')}</div>`
      : `<div class="empty">${ico('search')}<h4>No matches for "${esc(q)}"</h4>
           <p>Try a fabric (organza, silk), an occasion (sangeet, reception) or a silhouette (anarkali).</p>
           <a class="btn btn--ghost" href="collection.html">Browse everything</a></div>`;
    paintCounts();
  }
  function trending() {
    const t = P.filter(p => p.available).slice(0, 4);
    return `<p class="eyebrow" style="margin-bottom:20px">Trending now</p>
      <div class="pgrid">${t.map(p => card(p, { noSwatch: true })).join('')}</div>`;
  }

  /* ---------------- Reveal on scroll ---------------- */
  function reveal() {
    if (!('IntersectionObserver' in window)) { $$('.rv').forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: .05 });
    $$('.rv').forEach(e => io.observe(e));
  }
  window.KayReveal = reveal;

  /* ---------------- Announcement rotator ---------------- */
  function announce() {
    const msgs = [
      '<b>Trusted by Chennai since 1994</b> · three generations of weavers',
      'Free express shipping in India · <b>Worldwide free above ₹20,000</b>',
      '<b>15-day easy returns</b> · exchange at any Chennai store',
      'New in: <b>The Kanchipuram Handloom Edit</b> — woven to order',
      'Book a <b>free video styling call</b> with our bridal team'
    ];
    const el = $('#announce'); if (!el) return;
    let i = 0;
    const paint = () => { el.innerHTML = `<div class="announce-item">${msgs[i]}</div>`; };
    paint();
    setInterval(() => { i = (i + 1) % msgs.length; paint(); }, 4200);
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    const h = $('#site-header'), f = $('#site-footer'), c = $('#site-chrome');
    if (h) h.innerHTML = headerHTML();
    if (f) f.innerHTML = footerHTML();
    if (c) c.innerHTML = chromeHTML();

    announce();
    renderCart(); renderWish(); paintCounts();
    reveal();

    // header shadow on scroll
    const head = $('#header');
    if (head) {
      const onScroll = () => head.classList.toggle('scrolled', window.scrollY > 8);
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }

    // Global delegated events
    document.addEventListener('click', (e) => {
      const t = e.target;
      const hit = s => t.closest(s);

      if (hit('#openCart') || hit('#mobCart')) { e.preventDefault(); renderCart(); open('#cartDrawer'); return; }
      if (hit('#openWish') || hit('#mobWish')) { e.preventDefault(); renderWish(); open('#wishDrawer'); return; }
      if (hit('#openSearch') || hit('#mobSearch')) { e.preventDefault(); search(''); open('#searchOv'); return; }
      if (hit('#burger')) { e.preventDefault(); open('#menuDrawer'); return; }
      if (hit('[data-close]') || t.id === 'scrim') { e.preventDefault(); closeAll(); return; }

      const wishBtn = hit('[data-wish]');
      if (wishBtn) { e.preventDefault(); toggleWish(wishBtn.dataset.wish); return; }

      const unwish = hit('[data-unwish]');
      if (unwish) { e.preventDefault(); toggleWish(unwish.dataset.unwish); return; }

      const cl = hit('[data-closet]');
      if (cl) { e.preventDefault(); openClosetPicker(cl.dataset.closet); return; }

      const evOpt = hit('[data-ev]');
      if (evOpt && pickHandle) { e.preventDefault(); closetToggle(pickHandle, evOpt.dataset.ev); return; }

      const evRm = hit('[data-closet-rm]');
      if (evRm) { e.preventDefault(); closetRemove(evRm.dataset.closetRm, evRm.dataset.ev2); return; }

      const qv = hit('[data-qv]');
      if (qv) { e.preventDefault(); quickView(qv.dataset.qv); return; }

      const qvAdd = hit('[data-qv-add]');
      if (qvAdd) {
        const size = $('#qvSizes .size-pill.on')?.dataset.s;
        addToCart(qvAdd.dataset.qvAdd, size); return;
      }
      const add = hit('[data-add]');
      if (add) { e.preventDefault(); addToCart(add.dataset.add); return; }

      const notify = hit('[data-notify]');
      if (notify) { e.preventDefault(); toast('We\'ll email you the moment it\'s back in stock', 'mail'); return; }

      const sizePill = hit('#qvSizes .size-pill');
      if (sizePill) { $$('#qvSizes .size-pill').forEach(b => b.classList.remove('on')); sizePill.classList.add('on'); return; }

      const cardSize = hit('.card-size');
      if (cardSize) { e.preventDefault(); addToCart(cardSize.dataset.h, cardSize.textContent.trim()); return; }

      if (hit('[data-size-guide]')) { e.preventDefault(); open('#sizeModal'); return; }

      const q = hit('[data-q]');
      if (q) { setQty(q.dataset.k, +q.dataset.q); return; }
      const rm = hit('[data-rm]');
      if (rm) { removeLine(rm.dataset.rm); return; }

      const sug = hit('[data-suggest]');
      if (sug) { $('#searchInput').value = sug.dataset.suggest; search(sug.dataset.suggest); return; }

      if (hit('#checkoutBtn')) {
        toast('Checkout is out of scope for this prototype', 'shield'); return;
      }

      // demo-only links
      const a = hit('a[href^="#"]');
      if (a && a.getAttribute('href').length > 1 && !document.querySelector(a.getAttribute('href'))) {
        e.preventDefault(); toast('Page not built in this prototype', 'sparkle');
      }
    });

    // search typing
    const si = $('#searchInput');
    if (si) {
      let t; si.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => search(si.value), 130); });
      si.addEventListener('keydown', e => { if (e.key === 'Enter' && si.value.trim()) location.href = 'collection.html?q=' + encodeURIComponent(si.value.trim()); });
    }

    // newsletter
    document.addEventListener('submit', e => {
      if (e.target.matches('[data-news]')) {
        e.preventDefault(); e.target.reset();
        toast('You\'re on the list — welcome to Kay', 'sparkle');
      }
    });

    // keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAll();
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); search(''); open('#searchOv'); }
    });
  }

  // Published synchronously so page scripts can rely on it regardless of listener order.
  window.Kay = {
    addToCart, toggleWish, toast, card, money, P, byHandle, quickView, open, closeAll,
    paintCounts, stars, esc, ico,
    EVENTS, closet: () => closet, closetAll, closetCount, closetTotal, closetRemove, openClosetPicker, inCloset
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
