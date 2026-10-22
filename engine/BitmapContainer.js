import { ARRAY_MAX, BITMAP_WORDS, BITMAP_BYTES, popcount32 } from './constants.js';

// BitmapContainer: a dense chunk, stored as 65,536 bits (one bit per possible low value).
//
// Why Uint32Array of 2,048 words?
//   JavaScript bitwise operators work on 32-bit integers, so one word = 32 IDs.
//   Intersecting two bitmaps is then one AND per word: 2,048 operations for 65,536 IDs,
//   which is why bitmap-vs-bitmap is the fastest pairing.
//
// The cardinality is kept up to date on every change, so it never needs recounting.
export class BitmapContainer {
  constructor(words = null, cardinality = 0) {
    this.type = 'bitmap';
    this.words = words || new Uint32Array(BITMAP_WORDS);
    this.cardinality = cardinality;
  }

  // Time: O(1)
  contains(v) {
    return ((this.words[v >>> 5] >>> (v & 31)) & 1) === 1;
  }

  // Time: O(1)
  add(v) {
    const w = v >>> 5;
    const mask = 1 << (v & 31);
    if ((this.words[w] & mask) === 0) {
      this.words[w] |= mask;
      this.cardinality++;
    }
    return this;
  }

  // Removes v. If the bitmap drops to 4,096 values or fewer, an array is now
  // smaller, so we return a converted ArrayContainer.
  // Time: O(1), plus O(65,536 / 32) = O(2,048) words scanned if it converts
  remove(v, toArray) {
    const w = v >>> 5;
    const mask = 1 << (v & 31);
    if ((this.words[w] & mask) !== 0) {
      this.words[w] &= ~mask;
      this.cardinality--;
      if (this.cardinality <= ARRAY_MAX) return toArray(this);
    }
    return this;
  }

  // Time: O(1)
  sizeInBytes() {
    return BITMAP_BYTES;
  }

  // Recounts all bits. Used after bulk word operations.
  // Time: O(2,048)
  recount() {
    let c = 0;
    for (let i = 0; i < BITMAP_WORDS; i++) c += popcount32(this.words[i]);
    this.cardinality = c;
    return c;
  }

  // A run starts wherever a 1-bit has a 0-bit (or the chunk start) before it.
  // Time: O(2,048)
  numberOfRuns() {
    let runs = 0;
    let prevTopBit = 0;
    for (let i = 0; i < BITMAP_WORDS; i++) {
      const w = this.words[i];
      // starts of runs inside this word: bits that are 1 where the previous bit is 0
      const shifted = ((w << 1) | prevTopBit) >>> 0;
      runs += popcount32((w & ~shifted) >>> 0);
      prevTopBit = w >>> 31;
    }
    return runs;
  }

  // Calls fn for every set bit, in increasing order.
  // Time: O(2,048 + cardinality)
  forEach(fn) {
    for (let i = 0; i < BITMAP_WORDS; i++) {
      let w = this.words[i];
      while (w !== 0) {
        const lowest = w & -w;
        const bit = 31 - Math.clz32(lowest);
        fn((i << 5) + bit);
        w = w & (w - 1);
      }
    }
  }

  // Time: O(2,048)
  clone() {
    return new BitmapContainer(this.words.slice(), this.cardinality);
  }
}
