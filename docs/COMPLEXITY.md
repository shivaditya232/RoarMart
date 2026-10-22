# Time and space of every operation

Notation used throughout:

| Symbol | Meaning |
|---|---|
| n, m | number of values in a container (or set) |
| s, L | the smaller and the larger of two arrays |
| r | number of runs in a run container |
| k | number of chunks (containers) in a Roaring bitmap; k ≤ 65,536 |
| N | number of IDs in a whole Roaring bitmap |
| B | number of bit slices in a bit-sliced index (20 for price, 7 for discount) |
| U | the catalogue size (largest ID + 1), only used for the plain bitmap |

A 32-bit ID `x` is split into `key = x >>> 16` (which chunk) and `low = x & 0xFFFF` (position inside the
chunk). Each chunk holds at most 65,536 values, so every container cost below is bounded by a constant;
we still give it in terms of n, because that is what makes one container cheaper than another.

## 1. Containers

| Container | Stores | Space | Used when |
|---|---|---|---|
| Array | sorted `Uint16Array` of the low 16 bits | 2n + 2 bytes | n ≤ 4,096 |
| Bitmap | 2,048 × 32-bit words, one bit per position | 8,192 bytes, always | n > 4,096 |
| Run | pairs (start, length − 1) | 4r + 2 bytes | runs are smaller than both (after `runOptimize`) |

**Why 4,096:** an array costs 2 bytes per value and a bitmap always costs 8,192 bytes, so they cost the
same at 8,192 / 2 = 4,096 values. Below that the array is smaller, above it the bitmap is.

| Operation | Array | Bitmap | Run |
|---|---|---|---|
| contains(v) | O(log n) binary search | O(1): one word, one mask | O(log r) binary search over runs |
| add(v) | O(log n) search + O(n) shift; converts to a bitmap on the 4,097th value: O(n + 2,048) | O(1) | (runs are built in bulk, not by add) |
| remove(v) | O(log n) + O(n) shift | O(1); converts to an array when n drops to 4,096: O(2,048) | — |
| cardinality | O(1) (stored) | O(1) (stored) | O(1) (stored) |
| iterate | O(n) | O(2,048 + n) | O(n) |
| count runs | O(n) | O(2,048) | O(1) |

## 2. Container pairs (inside AND / OR / AND NOT)

| Pair | AND method | AND time | Result type |
|---|---|---|---|
| array ∩ array, L < 4 · s | merge with two pointers | O(n + m) | array |
| array ∩ array, L ≥ 4 · s | galloping search (steps 1, 2, 4, 8 … then binary search) | O(s · log(L / s)) | array |
| array ∩ bitmap | test each array value's bit | O(n) of the array side | array (it can't be bigger than the array) |
| bitmap ∩ bitmap | AND 2,048 word pairs, count first with popcount | O(2,048) | array if count ≤ 4,096, else bitmap |
| run ∩ array | binary search each array value in the runs | O(n · log r) | array |
| run ∩ bitmap / run ∩ run | expand runs into a bitmap, then AND words | O(2,048 + n) | array or bitmap |

| Pair | OR time | AND NOT time |
|---|---|---|
| array, array | O(n + m) merge if n + m ≤ 4,096; else O(n + m + 2,048) via a bitmap | O(n + m) |
| array, bitmap or run | O(2,048 + n) | O(n) or O(n · log r) (array on the left) |
| bitmap, anything | O(2,048 + n) | O(2,048 + n) |

**Why 4× and not the paper's 64×:** the C Roaring library uses 64×, tuned for C. We measured our
JavaScript engine on random arrays: merge wins or ties while the sizes are within about 3× of each
other, and galloping is faster from about 4× upwards (for 40 against 3,925 values it is about 8× faster).
So our engine gallops from 4×.

**How the choices are checked live:** for every Storefront search, the X-ray replays the method the
engine chose and its main alternative on the same containers (same answer), counting the steps and
timing both, and replays the whole query smallest-first and largest-first. This runs after the shop
has its answer, so it never slows a search.

`andCardinality` (used for facet counts) has the same time as AND but allocates nothing: for two bitmaps
it is 2,048 popcounts; for array ∩ bitmap it counts set bits for each array value.

**Popcount** (counting the 1 bits of a 32-bit word) uses the SWAR trick (count bits in pairs, then nibbles, then bytes, then one multiply to add the bytes):
O(1) per word, no loop over bits.

## 3. The Roaring bitmap

| Operation | Time | Why |
|---|---|---|
| contains(x) | O(log k) + container contains | binary search over the sorted chunk keys, then the container |
| add(x) / remove(x) | O(log k) + container add/remove; O(k) if a new chunk must be inserted into the key list | chunk keys are kept sorted in parallel arrays |
| addRange(lo, hi) | O(chunks touched) for empty chunks (one run each); O(values) for chunks that already exist | |
| A AND B | O(k₁ + k₂) key steps + the container-pair costs for keys in both | chunks present in only one side are skipped without touching their data |
| A OR B | O(k₁ + k₂) + container OR costs; chunks in only one side are copied | |
| A AND NOT B | O(k₁ + k₂) + container AND NOT costs | |
| cardinality | O(k) | sum of stored container counts |
| slice(offset, limit) (one results page) | O(k + offset + limit) | whole chunks before the offset are skipped by their counts |
| runOptimize | O(N) for array chunks, O(2,048) per bitmap chunk | each container is re-encoded in its smallest form |
| space | Σ (2 bytes per key + container size) | only chunks that hold at least one ID exist |

## 4. Price ranges: the bit-sliced index

Every price is written in binary across B = 20 bitmaps: slice i holds the IDs whose price has bit i set.

| Operation | Time |
|---|---|
| set(id, price) | O(B) bitmap adds |
| price ≤ c (lessOrEqual) | O(B) bitmap operations: walk the bits of c from the top, keeping "already smaller" (lt) and "equal so far" (eq) |
| price ≥ c | O(B) bitmap operations (mirror image) |
| lo ≤ price ≤ hi | O(B) operations + one AND |

So a price filter costs a fixed number of bitmap operations (two or three per bit, 20 bits, for each end of
the range: roughly 100), whatever the range, instead of one OR per possible price.

## 5. A shop search

A query is: values OR-ed inside each field, fields AND-ed together, optional price range, assured, in stock.

| Step | Time |
|---|---|
| build one operand per field | one OR per extra value in that field |
| sort operands by size | O(f log f), f = number of fields (at most 7) |
| AND them smallest first | each AND is bounded by the smaller side, and the running result only shrinks, so later steps get cheaper |
| subtract out of stock | one AND NOT with the out-of-stock bitmap (1,202 IDs) |
| one page of results | `slice`: O(k + offset + 24) |
| sort by price or discount | O(R log R) for the R matching IDs (price looked up per ID) |

**Facet counts** ("Red (657)" beside each option): for each field, the query is run once without that
field, and then `andCardinality` is called for every value of the field. In our catalogue that is
748 categories + 4,347 brands + 208 colours + 5 audiences = 5,308 intersections per click, plus five
price bands (cached per query). Measured: about 5 ms in total for all of them.

## 6. The structures we compared against

| | Space | A ∩ B | contains |
|---|---|---|---|
| Sorted array | 4N bytes | O(n + m) | O(log N) |
| Plain bitmap | U / 8 bytes, whatever N is | O(U / 32) | O(1) |
| Hash set (JS Set) | about 21 bytes per ID (measured) | O(min(n, m)) average | O(1) average |
| Roaring bitmap | Σ over chunks of min(2n, 8,192, 4r) + small overhead | O(k₁ + k₂) + container costs | O(log k + log n) |

Roaring's space is never far from the smaller of a sorted array and a plain bitmap, and its AND only
pays the bitmap's word-by-word cost inside chunks where both sides are dense.
