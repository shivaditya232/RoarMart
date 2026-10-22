// Competitor 1: a plain sorted array of 32-bit integers.
// Fast to iterate, but 4 bytes per ID no matter how dense the set is.
export class SortedArraySet {
  constructor(sortedIds) {
    this.name = 'Sorted array';
    this.values = Int32Array.from(sortedIds);
  }
  get cardinality() { return this.values.length; }
  // Time: O(log n)
  contains(x) {
    let lo = 0, hi = this.values.length - 1;
    while (lo <= hi) { const m = (lo + hi) >>> 1; if (this.values[m] < x) lo = m + 1; else if (this.values[m] > x) hi = m - 1; else return true; }
    return false;
  }
  // Merge intersection. Time: O(n + m)
  and(other) {
    const a = this.values, b = other.values;
    const out = new Int32Array(Math.min(a.length, b.length));
    let i = 0, j = 0, k = 0;
    while (i < a.length && j < b.length) {
      if (a[i] < b[j]) i++; else if (a[i] > b[j]) j++; else { out[k++] = a[i]; i++; j++; }
    }
    const s = Object.create(SortedArraySet.prototype);
    s.name = this.name; s.values = out.slice(0, k);
    return s;
  }
  sizeInBytes() { return 4 * this.values.length; }
}
