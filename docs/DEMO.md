# Demo script and test cases

## Before the evaluator arrives

1. `npm start` in the roarmart folder. Wait for:
   `Storefront: http://localhost:4000` and `Engine Studio: http://localhost:4000/studio`.
2. Open two browser windows side by side: the Storefront on the left, the Studio's **Live X-ray** on the right.
3. Check the internet: product photos load from Flipkart's image server. Everything else (fonts, engine,
   data) works offline; without internet the cards show a placeholder instead of the photo.
4. `npm test` once: it must say `# pass 50`, `# fail 0`.
5. Everything the Seller tools change lives in memory only. Restarting the server (Ctrl+C, `npm start`)
   brings back the original 16,932 products.

## The flow (about 10 minutes)

| # | Who | What to show | What to say |
|---|---|---|---|
| 1 | | Introduction: history of bitmaps and why Roaring was created | the problem first, no demo yet |
| 2 | Shivaditya | Storefront home → Departments → Clothing → "everyone" → Women → "any colour" → Red | "every word in this sentence is a bitmap; words are AND-ed, values inside a word are OR-ed" |
| 3 | Monish | the X-ray window updating at the same moment | read the steps: smallest set first, the container pair and method at each step, IDs left |
| 4 | Sudharshan | open "any price", click a bar, then drag the slider | bit-sliced index: a fixed number of bitmap operations (a few per bit, 20 bits) whatever the range; counts beside every option = about 5,300 intersections per click in about 5 ms |
| 5 | Monish | Seller tools: import 4,200 RoarWear → remove 200 → Compress runs | container watch: array → bitmap at 4,097 values (8,194 B) → array (8,004 B) → run (8 B) |
| 6 | Navikesh | Performance lab: "The 12.5 MB question", then "Bulk uploads", then the two charts | where Roaring wins, where it loses, and why it is never a bad choice |
| 7 | Navikesh | Bitmap console: `load A cat:Clothing`, `load B color:Red`, `and A B`, `add A 0..70000`, `optimize A` | same answer as the shop; containers changing type live |
| 8 | Navikesh | Stress test: 10,000 operations | 0 mismatches against a brute-force Set |
| 9 | Shivaditya | product page: "Bit address: product 12 = chunk 0, bit 12" | how an ID is split into a chunk key and a position |

## Test cases the evaluator may ask for

| Asked | Do this | Expected |
|---|---|---|
| "Filter by brand, colour and price together" | Listing: pick a category, then a brand, a colour and a price bar | results update with "matched in … ms"; X-ray shows one step per filter |
| "Show me something with no results" | e.g. Clothing + Gold + Nike | "Nothing matches all of that" with Clear filters; no error |
| "Two values of the same filter" | colour: Red and Blue | count goes up (OR inside the field) |
| "Out-of-stock products" | turn off "In stock" | out-of-stock items appear with an OUT OF STOCK label; the AND NOT step disappears from the X-ray |
| "Add a product and find it" | Seller tools → Add one product, then search its brand in the shop | it appears at once; the brand's bitmap gains one ID |
| "Make a container change type" | Seller tools bulk import of 4,200, or console `add A 0..5000` | array → bitmap |
| "Show a run container" | Seller tools → Compress runs, or console `add A 100000..200000` | run container, a few bytes |
| "What happens at a chunk boundary?" | console: `add A 65535`, `add A 65536`, `show A` | two chunks (keys 0 and 1) |
| "Largest possible ID" | console: `add A 4294967295`, `contains A 4294967295` | chunk 65,535, position 65,535 |
| "Invalid input" | console: `add A -5`, `add A 5000000000`, `add C 1`, `foo` | a clear message each time; nothing breaks |
| "Is it really correct?" | Stress test with 50,000 or 100,000 operations, any seed | 0 mismatches |
| "Compare with an array / hash set" | Performance lab, any scenario or your own sizes | memory, AND time and lookup time for all four, plus a check that all four agree |
| "Time complexity of the intersection" | docs/COMPLEXITY.md, section 2 and 3 | per container pair and for the whole bitmap |
| "Wrong product URL" | open /product/999999 | "We couldn't find that product" page |

## If something goes wrong

- **"Port 4000 is already in use"**: another server is still running. Close that terminal, or run `PORT=4001 npm start`.
- **Photos do not appear**: no internet. Filtering still works; say the images come from Flipkart's server.
- **The shop shows old data after Seller tools**: that is expected, changes are live. Restart the server to reset.
