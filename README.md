# KAY — The Fashion Bay · Redesign Prototype

A working modern-ecommerce prototype for [kayfashions.in](https://kayfashions.in/), built as
plain HTML / CSS / JS. Nothing to build, nothing to install — open `index.html` in a browser.

The **brand** is theirs (Chennai ethnic-wear house, 3 stores, sarees / bridal / festive, the
video-styling service). The **structure is not** — this is a net-new modern storefront, not a
reskin of the current site.

---

## Run it

```
open index.html          # macOS
start index.html         # Windows
```

Works straight off the filesystem — no server needed. Product imagery is loaded live from
their real Shopify CDN, so you need to be online for pictures to appear. The hero video is
local, so it plays offline.

The raw 4K HEVC source clip is gitignored (23 MB, and HEVC does not play in Chrome or
Firefox). `assets/video/hero-bridal.mp4` is the H.264 rendition actually used.

## Pages

| File | What it demonstrates |
|---|---|
| `index.html` | Homepage — looping bridal video hero with role-based entry, trust strip, categories, new-in, bridal editorial, occasions, bestsellers, concierge, provenance, reviews, UGC, stores, newsletter |
| `collection.html` | Listing page — faceted filters, sort, density toggle, chips, load-more, URL state |
| `product.html` | Product page — two-column image grid + sticky buy panel, Product Highlights overlay, lightbox, variants, readiness, delivery check, trust band, editorial detail, reviews, cross-sell |
| `appointments.html` | Booking — **Store Visit** and **Video Call** modes with different fields, slots and copy; validation and confirmation |
| `closet.html` | **Wedding Closet** — a trousseau planner with one column per wedding function, running totals and sharing |

Deep links that work: `collection.html?c=Sarees`, `?c=Bridal`, `?sale=1`, `?rts=1`,
`?occasion=Sangeet`, `?q=organza`, `?c=Sarees&fabric=Organza&sort=plh`,
`product.html?h=<handle>`, `appointments.html?mode=video`, `appointments.html?mode=store`.

## What actually works (not mocked)

- **Hero video** — a 7-second bridal loop (muted / looping / `playsinline` so mobile autoplays it), with a poster frame for instant paint and a graceful fallback. Pauses on `prefers-reduced-motion` and while the tab is hidden
- **Cart** — add / qty / remove, free-shipping progress to ₹20,000, totals, persists in `localStorage`
- **Wishlist** — toggle from cards, quick view or PDP; persists across pages
- **Faceted filtering** — category, occasion, fabric, colour, size, price, in-stock, ready-to-ship, on-sale; filters stack and intersect, and write to the URL so results are shareable
- **Sort** — featured / newest / most-reviewed / top-rated / price / A–Z
- **Search** — live overlay with instant results, `⌘K` / `Ctrl+K`, empty state, natural-language price ("under ₹5,000")
- **Quick view** — modal with size selection and add-to-bag
- **PDP image stack** — photographs run at full width down the page with a sticky buy panel beside them; click any shot for a lightbox with counter, arrows and keyboard nav. On mobile the stack becomes an edge-to-edge swipe carousel with dots
- **Pincode checker** — validates and returns an estimated delivery date
- **Sold-out state** — "Notify me" replaces add-to-cart, greyed imagery, made-to-order copy
- **Wedding Closet** — save any look against one of five wedding functions (engagement, mehendi & haldi, sangeet, muhurtham, reception); per-event and total spend, remove, share; persists in `localStorage`
- **Appointments** — two modes that genuinely differ: Store Visit offers the three Chennai stores and six daytime slots; Video Call swaps in call platforms and eight slots including late-evening IST for overseas buyers. Full validation, confirmation state, `?mode=` deep links
- **Garment readiness** — every piece is labelled Ready to Wear / Ready to Drape / Semi-Stitched / Made to Order, each with its own explanation on the product page. This is a *garment* claim and is deliberately separate from the *shipping* claim ("Ready to Ship")
- **Responsive** — desktop mega-menu → mobile drawer + bottom tab bar; filters become a drawer; categories become a swipe rail

Deliberately out of scope: checkout, accounts, real payments, review submission. These toast
"out of scope for this prototype" rather than pretending.

## Data

`assets/js/data.js` holds **75 real products** pulled from the live kayfashions.in Shopify
storefront — real titles, prices, SKUs, fabrics, colours, sizes and CDN imagery.

Demo values (clearly synthetic, so don't read these as real numbers): ratings, review counts,
compare-at/MRP prices, and stock states. Stock was deliberately rebalanced — the live store is
66% sold out, which would make the prototype impossible to evaluate.

## Tests

225 assertions driving the real pages in a headless DOM — rendering, cart maths, filter
intersection, sort ordering, URL sync, gallery, pincode, sold-out state, persistence, plus
computed-style guards that catch sized boxes collapsing to `display:inline` and icons
falling back to opaque black at unbounded size.

```
npm install jsdom
node test/smoke.js     # offline, ~2s
node test/links.js     # network: verifies every image URL returns 200
```

## Structure

```
index.html  collection.html  product.html  appointments.html  closet.html
assets/css/style.css      design tokens + all components
assets/video/             hero-bridal.mp4 (H.264 1080p, 2.5 MB) + poster jpg
assets/js/data.js         75-product catalogue
assets/js/app.js          site chrome, cart, wishlist, search, quick view
test/smoke.js             225 assertions (offline)
test/links.js             image URL checker (network)
```

`app.js` renders the header, drawers, footer and mobile nav into `#site-header` /
`#site-chrome` / `#site-footer` on every page, so the chrome is defined once.

## Design system

Ivory paper `#FAF8F4`, ink `#14100E`, bordeaux `#5E1526`, antique gold `#A8874E`.
Bodoni Moda for display, Jost for UI and body copy. Bodoni is a didone — high stroke
contrast, no weight below 400 — so display sizes were retuned and a test guards
against any display rule asking for a weight it cannot supply.

Four house rules, applied throughout: **no rounded corners** (`--r: 0`); **hairlines, not
boxes** — weight comes from whitespace, not borders; **micro-labels small and widely
tracked** against **large, tightly tracked display type**; and **slow single-property
motion** — image transforms run 1.1–1.3s, nothing bounces or lifts.

All tokens live at the top of `style.css` — change the palette there and the whole site
follows.
