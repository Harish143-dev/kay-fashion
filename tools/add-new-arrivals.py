#!/usr/bin/env python3
"""Put the client's five new pieces at the front of the catalogue.

They are ordinary products — cards, PDP, cart, wishlist and the Wedding Closet
all work on them — but they carry `newIn: true` so the homepage can lead with
them, and they take the lowest `n` values so every "newest first" sort surfaces
them ahead of the Shopify pull.

Idempotent: rerunning replaces the five rather than duplicating them.

    python tools/add-new-arrivals.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets/js/data.js"
IMG = "assets/images/products"

# Commerce values (price, sizes, rating, reviews) are prototype data in the same
# spirit as the rest of the catalogue — see the note at the top of data.js.
NEW = [
    {
        "id": 9100000000001,
        "handle": "bridal-lehenga-rust-zari",
        "title": "Rust Bridal Lehenga",
        "type": "Bridal Lehenga",
        "category": "Lehengas",
        "color": "Rust",
        "hex": "#C2532C",
        "fabric": "Raw Silk",
        "occasions": ["Bridal", "Muhurtham", "Reception"],
        "sizes": ["XS", "S", "M", "L", "XL"],
        "price": 68500,
        "compareAt": 0,
        "sku": "KF26001",
        "frames": 6,
        # The only piece with a shoot film. Already H.264 720x1280 and faststart,
        # so it is served as delivered; the poster is frame 1.2s.
        "video": "assets/video/bridal-lehenga-rust-zari.mp4",
        "videoPoster": "assets/video/bridal-lehenga-rust-zari.jpg",
        "desc": "Rust raw silk lehenga with gold zari butis across the skirt and a "
                "kalira-worked border.\nBlouse: Elbow-sleeve blouse with matching zari.\n"
                "Dupatta: Organza dupatta with a scalloped gold edge and latkans.\n"
                "Cut and finished in our Anna Nagar atelier.",
        "available": True, "rating": 4.9, "reviews": 7,
        "readyToShip": False, "readiness": "Made to Order",
    },
    {
        "id": 9100000000002,
        "handle": "bridal-lehenga-champagne-thread",
        "title": "Champagne Thread-Work Lehenga",
        "type": "Bridal Lehenga",
        "category": "Lehengas",
        "color": "Champagne",
        "hex": "#D7C3A2",
        "fabric": "Net",
        "occasions": ["Bridal", "Reception", "Engagement"],
        "sizes": ["XS", "S", "M", "L", "XL"],
        "price": 74900,
        "compareAt": 0,
        "sku": "KF26002",
        "frames": 6,
        "desc": "Champagne net lehenga worked end to end in tonal thread and sequins, "
                "weighted at the hem so the flare holds.\nBlouse: Sleeveless blouse with "
                "a scalloped neckline.\nDupatta: Matching net dupatta, thread-worked border.\n"
                "Three fittings included.",
        "available": True, "rating": 4.8, "reviews": 4,
        "readyToShip": False, "readiness": "Made to Order",
    },
    {
        "id": 9100000000003,
        "handle": "lehenga-royal-blue-zari",
        "title": "Royal Blue Zari Lehenga",
        "type": "Lehenga",
        "category": "Lehengas",
        "color": "Royal Blue",
        "hex": "#2534A0",
        "fabric": "Georgette",
        "occasions": ["Sangeet", "Reception", "Festive"],
        "sizes": ["XS", "S", "M", "L", "XL"],
        "price": 42500,
        "compareAt": 0,
        "sku": "KF26003",
        "frames": 6,
        "desc": "Royal blue georgette lehenga with silver zari panelling and a woven "
                "border.\nBlouse: Short-sleeve blouse with a deep V neckline.\n"
                "Dupatta: Net dupatta with a gold gota edge.\nBuilt to move in: "
                "the skirt is knife-pleated for a full twirl.",
        "available": True, "rating": 4.8, "reviews": 11,
        "readyToShip": True, "readiness": "Semi-Stitched",
    },
    {
        "id": 9100000000004,
        "handle": "gown-navy-sequin-cape",
        "title": "Navy Sequin Cape Gown",
        "type": "Gown",
        "category": "Gowns",
        "color": "Navy",
        "hex": "#1C2445",
        "fabric": "Net",
        "occasions": ["Cocktail", "Reception"],
        "sizes": ["S", "M", "L", "XL"],
        "price": 38900,
        "compareAt": 0,
        "sku": "KF26004",
        "frames": 6,
        "desc": "Midnight navy fishtail gown in hand-sequinned net.\nSleeves: Sheer "
                "embroidered full sleeves with a high neck.\nBack: Open back with a "
                "concealed hook fastening.\nCape: Detachable chiffon cape falls from "
                "the shoulder.\nFully lined, boned bodice.",
        "available": True, "rating": 4.9, "reviews": 9,
        "readyToShip": True, "readiness": "Ready to Wear",
    },
    {
        "id": 9100000000005,
        "handle": "saree-kanchipuram-royal-blue",
        "title": "Royal Blue Kanchipuram Silk Saree",
        "type": "Saree",
        "category": "Sarees",
        "color": "Royal Blue",
        "hex": "#2A2FA0",
        "fabric": "Kanchipuram Silk",
        "occasions": ["Bridal", "Muhurtham", "Festive"],
        "sizes": ["Free Size"],
        "price": 32750,
        "compareAt": 0,
        "sku": "KF26005",
        "frames": 5,
        "desc": "Pure Kanchipuram silk in royal blue with a contrast maroon korvai "
                "border and a green zari pallu.\nBlouse: Unstitched maroon silk blouse "
                "piece attached.\nZari: Half-fine gold zari, woven in Kanchipuram.\n"
                "Fall and pico stitched free before dispatch.",
        "available": True, "rating": 4.9, "reviews": 6,
        "readyToShip": True, "readiness": "Ready to Drape",
    },
]


def build(rec, n):
    p = {k: v for k, v in rec.items() if k != "frames"}
    h, frames = rec["handle"], rec["frames"]
    for f in range(1, frames + 1):
        if not (ROOT / IMG / f"{h}-{f:02d}.webp").is_file():
            sys.exit(f"missing image: {IMG}/{h}-{f:02d}.webp — run tools/build-images.py first")
    for key in ("video", "videoPoster"):
        if rec.get(key) and not (ROOT / rec[key]).is_file():
            sys.exit(f"missing {key}: {rec[key]}")
    p["images"] = [f"{IMG}/{h}-{i:02d}.webp" for i in range(1, frames + 1)]
    p["thumb"] = f"{IMG}/{h}-01-sm.webp"
    p["badge"] = "New In"
    p["newIn"] = True
    p["n"] = n
    # Match the key order the rest of the file uses.
    order = ["id", "handle", "title", "type", "category", "color", "hex", "fabric",
             "occasions", "sizes", "price", "compareAt", "sku", "images", "thumb",
             "video", "videoPoster",
             "desc", "available", "rating", "reviews", "badge", "readyToShip",
             "newIn", "n", "readiness"]
    return {k: p[k] for k in order if k in p}


def main():
    src = DATA.read_text(encoding="utf-8")
    head, body = src.split("window.PRODUCTS = ", 1)
    products = json.loads(body.rstrip().rstrip(";"))

    products = [p for p in products if not p.get("newIn")]
    products.sort(key=lambda p: p["n"])

    fresh = [build(rec, i) for i, rec in enumerate(NEW)]
    for i, p in enumerate(products):
        p["n"] = len(fresh) + i

    out = fresh + products
    DATA.write_text(head + "window.PRODUCTS = " +
                    json.dumps(out, indent=0, ensure_ascii=False) + ";\n",
                    encoding="utf-8")

    print(f"{len(fresh)} new arrivals at n=0..{len(fresh) - 1}, "
          f"{len(products)} existing shifted to n={len(fresh)}..{len(out) - 1}")
    for p in fresh:
        print(f"  {p['n']}  {p['title']:38} {p['category']:10} "
              f"Rs {p['price']:,}  {len(p['images'])} images")


if __name__ == "__main__":
    main()
