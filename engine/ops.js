import { ARRAY_MAX, BITMAP_WORDS, popcount32 } from './constants.js';
import { ArrayContainer } from './ArrayContainer.js';
import { BitmapContainer } from './BitmapContainer.js';
import { toBitmap, toArray, fromWords } from './convert.js';

// Set operations between two containers of the SAME chunk.
//
// Each pairing (array-array, array-bitmap, bitmap-bitmap, and run with either) has its
// own algorithm, because the best method depends on how the two sets are stored.
// Every function returns a container of the right type for its result size, and can
// record what it did in `trace` so the Engine Studio can show it.

// Galloping is used for array ∩ array when one side is at least 64× bigger
// (the same threshold the Roaring paper uses).
const GALLOP_RATIO = 64;

function note(trace, method, a, b, out, comparisons) {
  if (trace) trace.push({ method, left: a.type, right: b.type, leftCard: a.cardinality, rightCard: b.cardinality, outCard: out, comparisons });
}

// ---------- INTERSECTION (AND) ----------

// Merge intersection: walk both sorted arrays with two pointers.
// Time: O(n + m)
function intersectArraysMerge(a, b, counter) {
  const out = new Uint16Array(Math.min(a.cardinality, b.cardinality));
  let i = 0, j = 0, k = 0;
  while (i < a.cardinality && j < b.cardinality) {
    counter.n++;
    const x = a.values[i];
    const y = b.values[j];
    if (x < y) i++;
    else if (x > y) j++;
    else { out[k++] = x; i++; j++; }
  }
  return ArrayContainer.fromSorted(out, k);
}

// Galloping (exponential) search: for each value of the small array, jump through the
// large array in steps of 1, 2, 4, 8... then binary search inside the last jump.
// Time: O(s · log(L / s)), s = small size, L = large size
function intersectArraysGallop(small, large, counter) {
  const out = new Uint16Array(small.cardinality);
  let k = 0;
  let pos = 0;
  const n = large.cardinality;
  for (let i = 0; i < small.cardinality && pos < n; i++) {
    const v = small.values[i];
    // gallop forward until large[pos + step] >= v
    let step = 1;
    let lo = pos;
    while (pos + step < n && large.values[pos + step] < v) {
      counter.n++;
      lo = pos + step;
      step *= 2;
    }
    let hi = Math.min(pos + step, n - 1);
    // binary search in (lo, hi]
    let l = lo, h = hi;
    while (l <= h) {
      counter.n++;
      const mid = (l + h) >>> 1;
      if (large.values[mid] < v) l = mid + 1;
      else h = mid - 1;
    }
    pos = l;
    if (pos < n && large.values[pos] === v) out[k++] = v;
  }
  return ArrayContainer.fromSorted(out, k);
}

// array ∩ bitmap: test each array value's bit. The result is always an array,
// because it can't be bigger than the array side.
// Time: O(n), n = array size
function intersectArrayBitmap(a, b, counter) {
  const out = new Uint16Array(a.cardinality);
  let k = 0;
  for (let i = 0; i < a.cardinality; i++) {
    counter.n++;
    const v = a.values[i];
    if (((b.words[v >>> 5] >>> (v & 31)) & 1) === 1) out[k++] = v;
  }
  return ArrayContainer.fromSorted(out, k);
}

// bitmap ∩ bitmap: AND 2,048 word pairs. Count first, so we know whether the result
// should be an array (<= 4,096) or a bitmap, as the paper does.
// Time: O(2,048)
function intersectBitmaps(a, b, counter) {
  let card = 0;
  for (let i = 0; i < BITMAP_WORDS; i++) card += popcount32(a.words[i] & b.words[i]);
  counter.n += BITMAP_WORDS;
  if (card > ARRAY_MAX) {
    const words = new Uint32Array(BITMAP_WORDS);
    for (let i = 0; i < BITMAP_WORDS; i++) words[i] = a.words[i] & b.words[i];
    return new BitmapContainer(words, card);
  }
  const out = new ArrayContainer(Math.max(4, card));
  let k = 0;
  for (let i = 0; i < BITMAP_WORDS; i++) {
    let w = a.words[i] & b.words[i];
    while (w !== 0) {
      out.values[k++] = (i << 5) + (31 - Math.clz32(w & -w));
      w = w & (w - 1);
    }
  }
  out.cardinality = k;
  return out;
}

// run ∩ array: keep array values that fall inside a run.
// Time: O(n · log r)
function intersectRunArray(r, a, counter) {
  const out = new Uint16Array(a.cardinality);
  let k = 0;
  for (let i = 0; i < a.cardinality; i++) {
    counter.n++;
    if (r.contains(a.values[i])) out[k++] = a.values[i];
  }
  return ArrayContainer.fromSorted(out, k);
}

export function and(a, b, trace = null) {
  const counter = { n: 0 };
  let out;
  let method;
  if (a.type === 'array' && b.type === 'array') {
    const small = a.cardinality <= b.cardinality ? a : b;
    const large = small === a ? b : a;
    if (large.cardinality >= GALLOP_RATIO * small.cardinality) {
      out = intersectArraysGallop(small, large, counter);
      method = 'gallop';
    } else {
      out = intersectArraysMerge(a, b, counter);
      method = 'merge';
    }
  } else if (a.type === 'array' && b.type === 'bitmap') {
    out = intersectArrayBitmap(a, b, counter); method = 'bit-test';
  } else if (a.type === 'bitmap' && b.type === 'array') {
    out = intersectArrayBitmap(b, a, counter); method = 'bit-test';
  } else if (a.type === 'bitmap' && b.type === 'bitmap') {
    out = intersectBitmaps(a, b, counter); method = 'word-and';
  } else if (a.type === 'run' && b.type === 'array') {
    out = intersectRunArray(a, b, counter); method = 'run-search';
  } else if (a.type === 'array' && b.type === 'run') {
    out = intersectRunArray(b, a, counter); method = 'run-search';
  } else {
    // run with bitmap or run: expand runs into a bitmap, then AND words
    out = intersectBitmaps(toBitmap(a), toBitmap(b), counter); method = 'run-expand';
  }
  note(trace, method, a, b, out.cardinality, counter.n);
  return out;
}

// Counts |a ∩ b| without building the result (used for facet counts).
// Time: same as and(), but no allocation
export function andCardinality(a, b) {
  if (a.type === 'bitmap' && b.type === 'bitmap') {
    let card = 0;
    for (let i = 0; i < BITMAP_WORDS; i++) card += popcount32(a.words[i] & b.words[i]);
    return card;
  }
  if (a.type === 'array' && b.type === 'bitmap') return countArrayIn(a, b);
  if (a.type === 'bitmap' && b.type === 'array') return countArrayIn(b, a);
  if (a.type === 'array' && b.type === 'array') {
    let i = 0, j = 0, k = 0;
    while (i < a.cardinality && j < b.cardinality) {
      const x = a.values[i], y = b.values[j];
      if (x < y) i++; else if (x > y) j++; else { k++; i++; j++; }
    }
    return k;
  }
  return and(a, b).cardinality;
}

function countArrayIn(a, b) {
  let k = 0;
  for (let i = 0; i < a.cardinality; i++) {
    const v = a.values[i];
    if (((b.words[v >>> 5] >>> (v & 31)) & 1) === 1) k++;
  }
  return k;
}

// ---------- UNION (OR) ----------

// Time: O(n + m) for array ∪ array, O(2,048 + n) when a bitmap is involved
export function or(a, b) {
  if (a.type === 'array' && b.type === 'array') {
    if (a.cardinality + b.cardinality <= ARRAY_MAX) {
      // small enough to stay an array: classic merge
      const out = new Uint16Array(a.cardinality + b.cardinality);
      let i = 0, j = 0, k = 0;
      while (i < a.cardinality && j < b.cardinality) {
        const x = a.values[i], y = b.values[j];
        if (x < y) { out[k++] = x; i++; }
        else if (x > y) { out[k++] = y; j++; }
        else { out[k++] = x; i++; j++; }
      }
      while (i < a.cardinality) out[k++] = a.values[i++];
      while (j < b.cardinality) out[k++] = b.values[j++];
      return ArrayContainer.fromSorted(out, k);
    }
    // the result may pass 4,096: build it as a bitmap, convert back if it didn't
    const words = new Uint32Array(BITMAP_WORDS);
    for (let i = 0; i < a.cardinality; i++) { const v = a.values[i]; words[v >>> 5] |= 1 << (v & 31); }
    for (let i = 0; i < b.cardinality; i++) { const v = b.values[i]; words[v >>> 5] |= 1 << (v & 31); }
    return fromWords(words);
  }
  // at least one bitmap or run: OR into a copy of a bitmap
  const A = toBitmap(a);
  const B = toBitmap(b);
  const words = new Uint32Array(BITMAP_WORDS);
  for (let i = 0; i < BITMAP_WORDS; i++) words[i] = A.words[i] | B.words[i];
  return fromWords(words);
}

// ---------- DIFFERENCE (AND NOT) ----------

// a minus b.
// Time: O(n + m) for arrays, O(2,048) when bitmaps are involved
export function andNot(a, b) {
  if (a.type === 'array') {
    const out = new Uint16Array(a.cardinality);
    let k = 0;
    if (b.type === 'array') {
      let j = 0;
      for (let i = 0; i < a.cardinality; i++) {
        const x = a.values[i];
        while (j < b.cardinality && b.values[j] < x) j++;
        if (j >= b.cardinality || b.values[j] !== x) out[k++] = x;
      }
    } else {
      for (let i = 0; i < a.cardinality; i++) {
        if (!b.contains(a.values[i])) out[k++] = a.values[i];
      }
    }
    return ArrayContainer.fromSorted(out, k);
  }
  const A = toBitmap(a);
  const B = toBitmap(b);
  const words = new Uint32Array(BITMAP_WORDS);
  for (let i = 0; i < BITMAP_WORDS; i++) words[i] = A.words[i] & ~B.words[i];
  return fromWords(words);
}

export { toArray };
