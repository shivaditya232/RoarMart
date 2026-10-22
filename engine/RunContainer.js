// RunContainer: a chunk stored as runs of consecutive values, e.g. "2000 to 5999".
//
// Each run is stored as two 16-bit numbers: [start, length - 1].
// A run of 4,000 consecutive IDs therefore costs 4 bytes instead of 8,000 (array)
// or 8,192 (bitmap).
//
// Run containers come from addRange() (e.g. a bulk import with consecutive IDs) and
// from runOptimize(). Changing a run container with add/remove turns it back into an
// array or bitmap; the next runOptimize() re-compresses it if runs are still smaller.
export class RunContainer {
  constructor(runs = new Uint16Array(0), numRuns = 0) {
    this.type = 'run';
    this.runs = runs; // [start0, len0, start1, len1, ...], len stored as length - 1
    this.numRuns = numRuns;
    this.cardinality = 0;
    for (let i = 0; i < numRuns; i++) this.cardinality += this.runs[2 * i + 1] + 1;
  }

  // Builds runs from any container by walking its values in order.
  // Time: O(cardinality) for arrays, O(2,048 + cardinality) for bitmaps
  static fromContainer(container) {
    const tmp = [];
    let start = -1;
    let prev = -2;
    container.forEach((v) => {
      if (v === prev + 1) {
        prev = v;
      } else {
        if (start >= 0) tmp.push(start, prev - start);
        start = v;
        prev = v;
      }
    });
    if (start >= 0) tmp.push(start, prev - start);
    return new RunContainer(Uint16Array.from(tmp), tmp.length / 2);
  }

  // One run covering [lo, hi] inclusive.
  // Time: O(1)
  static range(lo, hi) {
    return new RunContainer(Uint16Array.of(lo, hi - lo), 1);
  }

  // Binary search for the last run whose start is <= v, then check v is inside it.
  // Time: O(log r), r = number of runs
  contains(v) {
    let lo = 0;
    let hi = this.numRuns - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const start = this.runs[2 * mid];
      if (start <= v) {
        if (v <= start + this.runs[2 * mid + 1]) return true;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return false;
  }

  // Time: O(1)
  sizeInBytes() {
    return 2 + 4 * this.numRuns;
  }

  // Time: O(1)
  numberOfRuns() {
    return this.numRuns;
  }

  // Time: O(cardinality)
  forEach(fn) {
    for (let i = 0; i < this.numRuns; i++) {
      const start = this.runs[2 * i];
      const end = start + this.runs[2 * i + 1];
      for (let v = start; v <= end; v++) fn(v);
    }
  }

  // Time: O(r)
  clone() {
    return new RunContainer(this.runs.slice(), this.numRuns);
  }
}
