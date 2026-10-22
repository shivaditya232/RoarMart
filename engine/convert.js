import { ARRAY_MAX, BITMAP_WORDS } from './constants.js';
import { ArrayContainer } from './ArrayContainer.js';
import { BitmapContainer } from './BitmapContainer.js';
import { RunContainer } from './RunContainer.js';

// Conversions between the three container types.

// Any container -> BitmapContainer.
// Time: O(cardinality) plus allocating 2,048 words
export function toBitmap(c) {
  if (c.type === 'bitmap') return c;
  const b = new BitmapContainer();
  if (c.type === 'array') {
    for (let i = 0; i < c.cardinality; i++) {
      const v = c.values[i];
      b.words[v >>> 5] |= 1 << (v & 31);
    }
    b.cardinality = c.cardinality;
    return b;
  }
  // run container: set whole ranges of bits
  for (let i = 0; i < c.numRuns; i++) {
    const start = c.runs[2 * i];
    const end = start + c.runs[2 * i + 1];
    for (let v = start; v <= end; v++) b.words[v >>> 5] |= 1 << (v & 31);
  }
  b.cardinality = c.cardinality;
  return b;
}

// Any container -> ArrayContainer. Only valid when cardinality <= 4,096.
// Time: O(2,048 + cardinality) from a bitmap, O(cardinality) otherwise
export function toArray(c) {
  if (c.type === 'array') return c;
  const a = new ArrayContainer(Math.max(4, c.cardinality));
  let n = 0;
  c.forEach((v) => {
    a.values[n++] = v;
  });
  a.cardinality = n;
  return a;
}

// Picks array or bitmap by cardinality: the rule the whole structure is built on.
// Time: O(conversion cost)
export function toArrayOrBitmap(c) {
  if (c.type === 'run') return c.cardinality <= ARRAY_MAX ? toArray(c) : toBitmap(c);
  if (c.type === 'bitmap' && c.cardinality <= ARRAY_MAX) return toArray(c);
  if (c.type === 'array' && c.cardinality > ARRAY_MAX) return toBitmap(c);
  return c;
}

// Picks the smallest of the three representations (used by runOptimize).
// Time: O(cardinality) or O(2,048) to count runs
export function toSmallest(c) {
  const runs = c.numberOfRuns();
  const runBytes = 2 + 4 * runs;
  const plain = toArrayOrBitmap(c);
  if (runBytes < plain.sizeInBytes()) {
    return c.type === 'run' ? c : RunContainer.fromContainer(c);
  }
  return plain;
}

// Builds a bitmap container straight from a word array, then normalises its type.
// Time: O(2,048)
export function fromWords(words) {
  const b = new BitmapContainer(words, 0);
  b.recount();
  return b.cardinality <= ARRAY_MAX ? toArray(b) : b;
}

export { BITMAP_WORDS };
