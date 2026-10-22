import { RoaringBitmap } from './RoaringBitmap.js';

// BitSlicedIndex: answers range queries ("price between 500 and 1500") using only
// Roaring Bitmap operations.
//
// Each value is written in binary. slices[i] holds the IDs whose value has bit i set.
// With B bits, any range query is answered with about 2·B bitmap operations, no matter
// how many products exist: we never look at a single price one by one.
//
// Example with 4 bits: price 5 = 0101 -> the ID goes into slices[0] and slices[2].
export class BitSlicedIndex {
  constructor(bits) {
    this.bits = bits;
    this.slices = [];
    for (let i = 0; i < bits; i++) this.slices.push(new RoaringBitmap());
    this.exists = new RoaringBitmap(); // every ID that has a value
    this.maxValue = 2 ** bits - 1;
  }

  // Time: O(B · log) — one add per set bit
  set(id, value) {
    const v = Math.max(0, Math.min(this.maxValue, Math.floor(value)));
    this.exists.add(id);
    for (let i = 0; i < this.bits; i++) {
      if (Math.floor(v / 2 ** i) % 2 === 1) this.slices[i].add(id);
    }
  }

  // Time: O(B · log)
  remove(id) {
    this.exists.remove(id);
    for (let i = 0; i < this.bits; i++) this.slices[i].remove(id);
  }

  // IDs with value <= c. Walk bits from most significant to least, keeping:
  //   lt = IDs already known to be smaller than c
  //   eq = IDs whose bits match c so far
  // Time: O(B) bitmap operations
  lessOrEqual(c) {
    if (c < 0) return new RoaringBitmap();
    if (c >= this.maxValue) return this.exists.clone();
    let lt = new RoaringBitmap();
    let eq = this.exists;
    for (let i = this.bits - 1; i >= 0; i--) {
      const bit = Math.floor(c / 2 ** i) % 2;
      if (bit === 1) {
        lt = lt.or(eq.andNot(this.slices[i])); // they have 0 where c has 1: smaller
        eq = eq.and(this.slices[i]);
      } else {
        eq = eq.andNot(this.slices[i]);        // they have 1 where c has 0: bigger, drop
      }
    }
    return lt.or(eq);
  }

  // IDs with value >= c (mirror image of lessOrEqual).
  // Time: O(B) bitmap operations
  greaterOrEqual(c) {
    if (c <= 0) return this.exists.clone();
    if (c > this.maxValue) return new RoaringBitmap();
    let gt = new RoaringBitmap();
    let eq = this.exists;
    for (let i = this.bits - 1; i >= 0; i--) {
      const bit = Math.floor(c / 2 ** i) % 2;
      if (bit === 0) {
        gt = gt.or(eq.and(this.slices[i]));    // they have 1 where c has 0: bigger
        eq = eq.andNot(this.slices[i]);
      } else {
        eq = eq.and(this.slices[i]);
      }
    }
    return gt.or(eq);
  }

  // Time: O(B) bitmap operations
  between(lo, hi) {
    if (lo > hi) return new RoaringBitmap();
    return this.greaterOrEqual(lo).and(this.lessOrEqual(hi));
  }

  sizeInBytes() {
    let total = this.exists.sizeInBytes();
    for (const s of this.slices) total += s.sizeInBytes();
    return total;
  }
}
