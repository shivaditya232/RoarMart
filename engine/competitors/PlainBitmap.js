// Competitor 2: an uncompressed bitmap over the whole ID range.
// One bit per possible ID: great when dense, wasteful when sparse, because the size
// depends on the largest ID, not on how many IDs are in the set.
export class PlainBitmap {
  constructor(ids, universe) {
    this.name = 'Plain bitmap';
    this.universe = universe;
    this.words = new Uint32Array(Math.ceil(universe / 32));
    for (const x of ids) this.words[x >>> 5] |= 1 << (x & 31);
  }
  // Time: O(1)
  contains(x) { return ((this.words[x >>> 5] >>> (x & 31)) & 1) === 1; }
  // Time: O(universe / 32)
  and(other) {
    const out = Object.create(PlainBitmap.prototype);
    out.name = this.name; out.universe = this.universe;
    out.words = new Uint32Array(this.words.length);
    for (let i = 0; i < this.words.length; i++) out.words[i] = this.words[i] & other.words[i];
    return out;
  }
  get cardinality() {
    let c = 0;
    for (let i = 0; i < this.words.length; i++) { let w = this.words[i]; while (w !== 0) { w = w & (w - 1); c++; } }
    return c;
  }
  sizeInBytes() { return this.words.length * 4; }
}
