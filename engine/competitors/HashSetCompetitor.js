// Competitor 3: JavaScript's built-in Set (a hash table).
// O(1) average lookups, but intersection must probe every element of the smaller set,
// and each entry carries hash-table overhead.
export class HashSetCompetitor {
  constructor(ids) {
    this.name = 'Hash set';
    this.set = new Set(ids);
  }
  get cardinality() { return this.set.size; }
  contains(x) { return this.set.has(x); }
  // Time: O(min(n, m)) average
  and(other) {
    const small = this.set.size <= other.set.size ? this.set : other.set;
    const large = small === this.set ? other.set : this.set;
    const out = Object.create(HashSetCompetitor.prototype);
    out.name = this.name; out.set = new Set();
    for (const x of small) if (large.has(x)) out.set.add(x);
    return out;
  }
  // Not exactly measurable from JS; estimated by benchmark code from heap usage.
  sizeInBytes() { return null; }
}
