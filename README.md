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
| `index.html` | Homepage — looping bridal video hero with role-based entry, **new arrivals**, trust strip, categories, more-new-in, bridal editorial, occasions, bestsellers, concierge, provenance, reviews, UGC, stores, newsletter |
| `collection.html` | Listing page — faceted filters, sort, density toggle, chips, load-more, URL state |
| `product.html` | Product page — gallery (shoot film first where there is one) + sticky buy panel, Product Highlights below the images, lightbox, variants, readiness, delivery check, trust band, editorial detail, reviews, cross-sell |
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
- **PDP gallery** — photographs beside a sticky buy panel; click any shot for a lightbox with counter, arrows and keyboard nav. Below 1024px it becomes a swipe carousel with dots, so the buy panel stays within reach instead of sitting under a full stack of images
- **Shoot film** — the Rust Bridal Lehenga leads its gallery with an 8-second film (muted, looping, `playsinline`, poster-backed). It is a gallery panel, not a lightbox target, so image indices are untouched. Pauses under `prefers-reduced-motion` and while the tab is hidden
- **Pincode checker** — validates and returns an estimated delivery date
- **Sold-out state** — "Notify me" replaces add-to-cart, greyed imagery, made-to-order copy
- **Wedding Closet** — save any look against one of five wedding functions (engagement, mehendi & haldi, sangeet, muhurtham, reception); per-event and total spend, remove, share; persists in `localStorage`
- **Appointments** — two modes that genuinely differ: Store Visit offers the three Chennai stores and six daytime slots; Video Call swaps in call platforms and eight slots including late-evening IST for overseas buyers. Full validation, confirmation state, `?mode=` deep links
- **Garment readiness** — every piece is labelled Ready to Wear / Ready to Drape / Semi-Stitched / Made to Order, each with its own explanation on the product page. This is a *garment* claim and is deliberately separate from the *shipping* claim ("Ready to Ship")
- **Responsive** — desktop mega-menu → burger drawer below 1024px, bottom tab bar below 760px. The drawer carries everything the small-screen header and utility bar drop (concierge links, stores, contact, socials) so nothing is orphaned on a phone; all tap targets are ≥44px. Filters become a drawer, categories a swipe rail

Deliberately out of scope: checkout, accounts, real payments, review submission. These toast
"out of scope for this prototype" rather than pretending.

## Data

`assets/js/data.js` holds **80 products**. 75 are pulled from the live kayfashions.in Shopify
storefront — real titles, prices, SKUs, fabrics, colours, sizes and CDN imagery. The other 5 are
the house's own shoot (see below); their commerce values are prototype data like everything else
marked demo here.

Demo values (clearly synthetic, so don't read these as real numbers): ratings, review counts,
compare-at/MRP prices, and stock states. Stock was deliberately rebalanced — the live store is
66% sold out, which would make the prototype impossible to evaluate.

## Tests

Two suites, because they catch different things.

`test/smoke.js` — 256 assertions in a headless DOM: rendering, cart maths, filter intersection,
sort ordering, URL sync, gallery, pincode, sold-out state, persistence, plus computed-style
guards for boxes collapsing to `display:inline` and icons falling back to opaque black.

`test/layout.js` — 112 assertions in **real Chrome** at 390 / 768 / 1024 / 1440px. jsdom executes
JavaScript but performs no layout, so it cannot see a header wrapping to a second row, a carousel
blowing the document out to three times the viewport, or a buy button 4,000px down a phone
screen. All three shipped before this suite existed. It measures actual boxes: horizontal
overflow, header row integrity, logo centring, tap-target sizes, swipe-rail gutters and how far
down the page the primary CTA sits.

Each page is loaded inside an iframe sized to the exact CSS width under test. `--window-size`
cannot deliver one: headless Chrome on Windows clamps the window to roughly 500px and applies
display scaling on top, so asking for 390 quietly produced a 504px viewport — the narrowest
phone width, where most of the reported bugs have been, was never actually being tested. An
iframe establishes its own viewport, so media queries and `vw` units resolve against the real
number. The suite now asserts the viewport it got matches the one it asked for, so that class of
silent drift cannot come back.

```
npm install jsdom
node test/smoke.js     # offline, ~2s
node test/layout.js    # drives headless Chrome, ~2min (skips if none found)
node test/links.js     # network: verifies every remote image URL returns 200
```

## Structure

```
index.html  collection.html  product.html  appointments.html  closet.html
assets/css/style.css      design tokens + all components
assets/video/             hero-bridal.mp4 + the Rust Bridal Lehenga film, each with a poster
assets/images/products/   the house shoot, WebP (see Images)
assets/js/data.js         80-product catalogue
assets/js/app.js          site chrome, cart, wishlist, search, quick view
tools/build-images.py     originals -> renamed, resized WebP
tools/add-new-arrivals.py puts the house shoot at the front of the catalogue
test/smoke.js             256 assertions (offline)
test/layout.js            112 assertions in real Chrome at four widths
test/links.js             remote image URL checker (network)
```

`app.js` renders the header, drawers, footer and mobile nav into `#site-header` /
`#site-chrome` / `#site-footer` on every page, so the chrome is defined once.

## Images

The client's own shoot lives in `assets/images/Kay_Fashion/<Folder>/` as 2-3 MB PNGs with
timestamp filenames. Those originals are left untouched; `tools/build-images.py` is the only
thing that reads them.

It renames each frame to its product handle, orders the frames so the full-length front view
leads, and writes WebP at two sizes — 1000px for the product page and lightbox, 520px for the
card grids, since a grid never needs more. **67.4 MB of PNG becomes 4.7 MB of WebP, 93% smaller**,
with no visible loss at the sizes the site actually renders.

```
python tools/build-images.py        # rebuild from the originals
python tools/add-new-arrivals.py    # re-seed the catalogue entries
```

The Rust Bridal Lehenga also has an 8-second shoot film. It arrived already H.264 720x1280,
faststart and 1.8 MB, so it is served exactly as delivered — only renamed to the handle, with a
poster frame pulled at 1.2s.

Both scripts are idempotent. The five pieces are ordinary products — cards, PDP, cart, wishlist and the
Wedding Closet all work on them — but they carry `newIn: true` and the lowest `n`, so they lead
the homepage and every newest-first sort.

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
