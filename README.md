# RoarMart

**An online shop where every product is a bit and every filter is a bitmap.**

RoarMart is a working e-commerce storefront (16,932 real products from a Flipkart catalogue sample)
whose filtering, counting and pagination all run on a **Roaring Bitmap engine we wrote from scratch**.
Next to the shop runs the **Engine Studio**, a live window into the engine: it shows how every
click in the shop was executed, which containers each bitmap uses, and how Roaring compares with
other ways of storing a set.

DSA Lab Evaluation 3, Amrita Vishwa Vidyapeetham — case study: Roaring Bitmaps for e-commerce
product filtering.

## Why Roaring Bitmaps

Every filter value in a shop (a brand, a colour, a category) is a set of product IDs, and every click
combines those sets. The classic ways of storing a set force a choice:

- a **sorted array** is small for small sets but slow to combine (O(n + m) per intersection),
- a **plain bitmap** combines very fast (one AND per 32 IDs) but costs one bit for *every* product in the
  catalogue, even for a brand with three products: 12.5 MB per set at 100 million products.

A Roaring bitmap (Chambi, Lemire, Kaser and Godin, 2014) splits the 32-bit ID space into chunks of
65,536 and lets **each chunk choose its own container**: a sorted array of 16-bit values (up to 4,096
values), an 8 KB bitmap (more than 4,096), or a list of runs (consecutive IDs). Empty chunks are not
stored at all. The result is memory close to the compressed formats and speed close to a plain bitmap.
The same structure is used inside Lucene and Elasticsearch, Apache Spark, Druid, ClickHouse and Redis.

## What is in the demo

**Storefront** (`http://localhost:4000`)
- Filters written as a sentence: "Showing **Clothing** for **Women** in **Red** from **any brand** at **any price**".
  Values inside one word are OR-ed, words are AND-ed — exactly how the engine runs the query.
- Live counts beside every option (about 5,300 intersections per click), a price histogram from a
  bit-sliced index, search suggestions with bitmap counts, and the engine's real time per query.

**Engine Studio** (`http://localhost:4000/studio`)
- **Live X-ray** — every shop search, step by step: which bitmaps, which container pairs, which
  intersection method, how many IDs were left after each step.
- **Bitmap explorer** — all 5,310 bitmaps, their chunks and containers, and memory compared.
- **Seller tools** — change the catalogue live and watch a container flip from array to bitmap at
  4,096 values, back again, and into a run container.
- **Performance lab** — the same sets stored as Roaring, sorted array, plain bitmap and hash set, measured
  for memory, intersection time and lookup time, with scaling charts up to 100 million IDs.
- **Bitmap console** — build bitmaps by hand (`add A 0..70000`, `and A B`, `optimize A`, …).
- **Stress test** — thousands of random operations checked against a brute-force JavaScript Set.

## Run it

Needs Node.js 22 or newer.

```
npm run setup      # installs the server and web packages (first time only)
npm start          # builds the web app and starts everything on http://localhost:4000
```

For development with live reload, use two terminals: `npm run server` (API on port 4000) and
`npm run web` (Vite on http://localhost:5173).

```
npm test           # 50 tests: containers, operations, bit-sliced index, catalogue, verifier, lab
```

## How it is built

```
engine/    the Roaring Bitmap engine (plain JavaScript, no dependencies)
  ArrayContainer, BitmapContainer, RunContainer   the three container types
  ops.js            AND / OR / AND NOT for every container pair, with the method chosen per pair
  RoaringBitmap.js  the two-level structure: sorted chunk keys + one container per chunk
  BitSlicedIndex.js price and discount ranges as 20 and 7 bit slices
  CatalogIndex.js   one bitmap per filter value ("brand:Nike", "color:Red", "cat:Clothing > ...")
  QueryPlanner.js   OR within a field, AND across fields, smallest set first, facet counts
  Verifier.js       random operations checked against JavaScript Sets
  competitors/      sorted array, plain bitmap and hash set, for the performance lab
server/    Node + Express + Socket.io: the shop API, the Studio API, the lab
web/       React + Vite: the Storefront and the Engine Studio
data/      products.json, the cleaned and image-checked catalogue
docs/      COMPLEXITY.md (time and space of every operation), DEMO.md (demo script and test cases)
```

There is no database: the catalogue is loaded into memory at start-up (well under a second) and every filter,
count and range query goes through the engine. Socket.io pushes each query's trace to the Studio.

## Team

| Member | Built |
|---|---|
| Shivaditya | project setup; array, bitmap and run containers; the Storefront |
| Navikesh | AND / OR / AND NOT for every container pair; the verifier and comparison structures; performance lab, console and stress test |
| Monish | the RoaringBitmap structure; catalogue cleaning; the Engine Studio (X-ray, bitmap explorer, seller tools) |
| Sudharshan | bit-sliced index; catalogue index and query planner; the server, API and live updates |

Catalogue data: Flipkart e-commerce product sample (2016), cleaned and image-checked.
