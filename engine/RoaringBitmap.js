import { ArrayContainer } from './ArrayContainer.js';
import { RunContainer } from './RunContainer.js';
import { toBitmap, toArray, toArrayOrBitmap, toSmallest } from './convert.js';
import * as ops from './ops.js';

// RoaringBitmap: a compressed set of 32-bit unsigned integers (our product IDs).
//
// Two levels:
//   1. keys[]       - sorted 16-bit chunk keys (high 16 bits of the IDs present)
//   2. containers[] - containers[i] holds the low 16 bits for chunk keys[i]
//
// keys and containers are parallel arrays kept in key order, so finding a chunk is a
// binary search, and combining two bitmaps is a two-pointer walk over their keys.
// Only chunks that contain at least one ID exist at all.
export class RoaringBitmap {
  constructor() {
    this.keys = [];
    this.containers = [];
  }

  // Time: O(n log n) for unsorted input; O(n) amortised when IDs come in order
  static from(values) {
    const rb = new RoaringBitmap();
    for (const v of values) rb.add(v);
    return rb;
  }

  // Binary search over chunk keys. Returns index or -(insertionPoint + 1).
  // Time: O(log k), k = number of chunks
  findKey(key) {
    let lo = 0;
    let hi = this.keys.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const k = this.keys[mid];
      if (k < key) lo = mid + 1;
      else if (k > key) hi = mid - 1;
      else return mid;
    }
    return -(lo + 1);
  }

  // Time: O(log k) to find the chunk + O(log n) array / O(1) bitmap / O(log r) run
  contains(x) {
    const i = this.findKey(x >>> 16);
    if (i < 0) return false;
    return this.containers[i].contains(x & 0xffff);
  }

  // Time: O(log k) + container add (O(n) worst for an array, O(1) for a bitmap)
  add(x) {
    const key = x >>> 16;
    const low = x & 0xffff;
    let i = this.findKey(key);
    if (i < 0) {
      i = -i - 1;
      this.keys.splice(i, 0, key);
      const c = new ArrayContainer();
      c.add(low, toBitmap);
      this.containers.splice(i, 0, c);
      return this;
    }
    let c = this.containers[i];
    if (c.type === 'run') {
      if (c.contains(low)) return this;
      c = toArrayOrBitmap(c);
    }
    this.containers[i] = c.type === 'array' ? c.add(low, toBitmap) : c.add(low);
    return this;
  }

  // Time: O(log k) + container remove
  remove(x) {
    const i = this.findKey(x >>> 16);
    if (i < 0) return this;
    let c = this.containers[i];
    const low = x & 0xffff;
    if (c.type === 'run') {
      if (!c.contains(low)) return this;
      c = toArrayOrBitmap(c);
    }
    c = c.type === 'bitmap' ? c.remove(low, toArray) : c.remove(low);
    if (c.cardinality === 0) {
      this.keys.splice(i, 1);
      this.containers.splice(i, 1);
    } else {
      this.containers[i] = c;
    }
    return this;
  }

  // Adds every ID in [lo, hi] inclusive. Chunks that are empty get a single run
  // container, which is how consecutive bulk imports end up as runs.
  // Time: O(chunks touched) for empty chunks, else O(values) via add()
  addRange(lo, hi) {
    let x = lo;
    while (x <= hi) {
      const key = x >>> 16;
      const chunkEnd = Math.min(hi, (key << 16 >>> 0) + 0xffff);
      const i = this.findKey(key);
      if (i < 0) {
        const at = -i - 1;
        this.keys.splice(at, 0, key);
        this.containers.splice(at, 0, RunContainer.range(x & 0xffff, chunkEnd & 0xffff));
      } else {
        for (let v = x; v <= chunkEnd; v++) this.add(v);
      }
      x = chunkEnd + 1;
    }
    return this;
  }

  // Time: O(k)
  get cardinality() {
    let total = 0;
    for (let i = 0; i < this.containers.length; i++) total += this.containers[i].cardinality;
    return total;
  }

  isEmpty() {
    return this.keys.length === 0;
  }

  // Two-pointer walk over both key lists. Only chunks present in BOTH can intersect,
  // so chunks missing from either side are skipped without touching their data.
  // Time: O(k1 + k2) chunk steps + the per-container AND costs
  and(other, trace = null) {
    const out = new RoaringBitmap();
    let i = 0, j = 0;
    while (i < this.keys.length && j < other.keys.length) {
      const a = this.keys[i], b = other.keys[j];
      if (a < b) i++;
      else if (a > b) j++;
      else {
        const chunkTrace = trace ? [] : null;
        const c = ops.and(this.containers[i], other.containers[j], chunkTrace);
        if (trace) trace.push({ key: a, ...chunkTrace[0] });
        if (c.cardinality > 0) { out.keys.push(a); out.containers.push(c); }
        i++; j++;
      }
    }
    return out;
  }

  // |this ∩ other| without building the result.
  // Time: same as and()
  andCardinality(other) {
    let total = 0;
    let i = 0, j = 0;
    while (i < this.keys.length && j < other.keys.length) {
      const a = this.keys[i], b = other.keys[j];
      if (a < b) i++;
      else if (a > b) j++;
      else { total += ops.andCardinality(this.containers[i], other.containers[j]); i++; j++; }
    }
    return total;
  }

  // Time: O(k1 + k2) chunk steps + per-container OR costs
  or(other) {
    const out = new RoaringBitmap();
    let i = 0, j = 0;
    while (i < this.keys.length || j < other.keys.length) {
      if (j >= other.keys.length || (i < this.keys.length && this.keys[i] < other.keys[j])) {
        out.keys.push(this.keys[i]); out.containers.push(this.containers[i].clone()); i++;
      } else if (i >= this.keys.length || other.keys[j] < this.keys[i]) {
        out.keys.push(other.keys[j]); out.containers.push(other.containers[j].clone()); j++;
      } else {
        out.keys.push(this.keys[i]); out.containers.push(ops.or(this.containers[i], other.containers[j])); i++; j++;
      }
    }
    return out;
  }

  // this minus other.
  // Time: O(k1 + k2) chunk steps + per-container AND NOT costs
  andNot(other) {
    const out = new RoaringBitmap();
    let j = 0;
    for (let i = 0; i < this.keys.length; i++) {
      const a = this.keys[i];
      while (j < other.keys.length && other.keys[j] < a) j++;
      if (j < other.keys.length && other.keys[j] === a) {
        const c = ops.andNot(this.containers[i], other.containers[j]);
        if (c.cardinality > 0) { out.keys.push(a); out.containers.push(c); }
      } else {
        out.keys.push(a); out.containers.push(this.containers[i].clone());
      }
    }
    return out;
  }

  // Re-encodes each container in its smallest form, turning runs of consecutive IDs
  // into run containers. Returns how many run containers there are afterwards.
  // Time: O(total cardinality) or O(2,048) per bitmap container
  runOptimize() {
    let runCount = 0;
    for (let i = 0; i < this.containers.length; i++) {
      this.containers[i] = toSmallest(this.containers[i]);
      if (this.containers[i].type === 'run') runCount++;
    }
    return runCount;
  }

  // Time: O(cardinality)
  toArray() {
    const out = new Array(this.cardinality);
    let n = 0;
    for (let i = 0; i < this.keys.length; i++) {
      const high = this.keys[i] * 65536;
      this.containers[i].forEach((low) => { out[n++] = high + low; });
    }
    return out;
  }

  // The first `limit` IDs starting from position `offset` (for pagination).
  // Time: O(offset + limit) values visited, chunks before `offset` skipped by cardinality
  slice(offset, limit) {
    const out = [];
    let skipped = 0;
    for (let i = 0; i < this.keys.length && out.length < limit; i++) {
      const c = this.containers[i];
      if (skipped + c.cardinality <= offset) { skipped += c.cardinality; continue; }
      const high = this.keys[i] * 65536;
      c.forEach((low) => {
        if (skipped < offset) { skipped++; return; }
        if (out.length < limit) out.push(high + low);
      });
    }
    return out;
  }

  *[Symbol.iterator]() {
    yield* this.toArray();
  }

  // Time: O(k) containers cloned
  clone() {
    const out = new RoaringBitmap();
    out.keys = this.keys.slice();
    out.containers = this.containers.map((c) => c.clone());
    return out;
  }

  // Bytes used: one 2-byte key per chunk plus each container's own size.
  // Time: O(k)
  sizeInBytes() {
    let total = 0;
    for (let i = 0; i < this.containers.length; i++) total += 2 + this.containers[i].sizeInBytes();
    return total;
  }

  // What the Engine Studio's X-ray shows: one entry per chunk.
  // Time: O(k)
  stats() {
    return {
      cardinality: this.cardinality,
      bytes: this.sizeInBytes(),
      chunks: this.keys.map((key, i) => ({
        key,
        type: this.containers[i].type,
        cardinality: this.containers[i].cardinality,
        bytes: this.containers[i].sizeInBytes(),
      })),
    };
  }
}
