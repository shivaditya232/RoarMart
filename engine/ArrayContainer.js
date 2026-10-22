import { ARRAY_MAX } from './constants.js';

// ArrayContainer: a sparse chunk, stored as a SORTED list of 16-bit values.
//
// Why Uint16Array?
//   The chunk key already gives the high 16 bits of every ID, so only the low 16 bits
//   need storing: exactly 2 bytes per value. A plain JS array would cost 8+ bytes per value.
//
// Why sorted?
//   Sorted order gives O(log n) lookup with binary search and lets two containers be
//   intersected or merged in one linear pass.
//
// Growth: the backing Uint16Array doubles when full (like a dynamic array),
// so appends cost amortised O(1) apart from the shifting needed to keep order.
export class ArrayContainer {
  constructor(capacity = 4) {
    this.type = 'array';
    this.values = new Uint16Array(capacity);
    this.cardinality = 0;
  }

  // Builds a container from values that are already sorted and unique.
  // Time: O(n)
  static fromSorted(sortedValues, count = sortedValues.length) {
    const c = new ArrayContainer(Math.max(4, count));
    for (let i = 0; i < count; i++) {
      c.values[i] = sortedValues[i];
    }
    c.cardinality = count;
    return c;
  }

  // Binary search. Returns the index of v, or -(insertionPoint + 1) if v is absent.
  // Time: O(log n)
  indexOf(v) {
    let lo = 0;
    let hi = this.cardinality - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const x = this.values[mid];
      if (x < v) lo = mid + 1;
      else if (x > v) hi = mid - 1;
      else return mid;
    }
    return -(lo + 1);
  }

  // Time: O(log n)
  contains(v) {
    return this.indexOf(v) >= 0;
  }

  // Adds v. Returns the container to keep using: this one, or a new BitmapContainer
  // when the array would grow past 4,096 values.
  // Time: O(n) worst case for shifting values right (n <= 4096, so bounded)
  add(v, toBitmap) {
    const idx = this.indexOf(v);
    if (idx >= 0) return this;
    if (this.cardinality >= ARRAY_MAX) {
      // Adding the 4,097th value: a bitmap is now smaller, so convert first.
      const bitmap = toBitmap(this);
      return bitmap.add(v);
    }
    if (this.cardinality === this.values.length) {
      const bigger = new Uint16Array(Math.min(ARRAY_MAX, this.values.length * 2));
      bigger.set(this.values);
      this.values = bigger;
    }
    const insertAt = -idx - 1;
    for (let i = this.cardinality; i > insertAt; i--) {
      this.values[i] = this.values[i - 1];
    }
    this.values[insertAt] = v;
    this.cardinality++;
    return this;
  }

  // Removes v. An array container never needs to change type when shrinking.
  // Time: O(n) for shifting values left
  remove(v) {
    const idx = this.indexOf(v);
    if (idx < 0) return this;
    for (let i = idx; i < this.cardinality - 1; i++) {
      this.values[i] = this.values[i + 1];
    }
    this.cardinality--;
    return this;
  }

  // Time: O(1)
  sizeInBytes() {
    return 2 * this.cardinality + 2;
  }

  // Number of runs of consecutive values (used by runOptimize).
  // Time: O(n)
  numberOfRuns() {
    if (this.cardinality === 0) return 0;
    let runs = 1;
    for (let i = 1; i < this.cardinality; i++) {
      if (this.values[i] !== this.values[i - 1] + 1) runs++;
    }
    return runs;
  }

  // Time: O(n)
  forEach(fn) {
    for (let i = 0; i < this.cardinality; i++) fn(this.values[i]);
  }

  // Time: O(n)
  clone() {
    return ArrayContainer.fromSorted(this.values, this.cardinality);
  }
}
