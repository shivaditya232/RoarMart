import { RoaringBitmap, SortedArraySet, PlainBitmap, HashSetCompetitor } from '../engine/index.js';

// Performance lab: the same two sets stored four ways, then measured.
//   memory   - bytes each structure needs
//   AND      - time to intersect the two sets (median of repeated runs)
//   contains - time for one membership test (average over 20,000 random probes)
// Sets are synthetic, so the evaluator can pick any size up to 1,000,000 IDs
// in a catalogue of up to 100,000,000 IDs.

export const LIMITS = { maxUniverse: 100_000_000, minUniverse: 10_000, maxSize: 1_000_000 };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// Sorted, distinct IDs in [0, universe).
//  'random'    - every ID is picked independently (geometric skips, so O(size) work)
//  'clustered' - consecutive blocks of IDs, like products a seller imported together
export function makeIds({ universe, size, layout = 'random', seed = 1 }) {
  const rand = rng(seed);
  size = Math.min(size, universe);
  const out = [];
  if (size === 0) return out;
  if (layout === 'clustered') {
    const runs = Math.max(1, Math.round(size / 2000));
    const free = universe - size;
    const cuts = [];
    for (let i = 0; i < runs; i++) cuts.push(Math.floor(rand() * (free + 1)));
    cuts.sort((x, y) => x - y);
    let placed = 0;
    for (let r = 0; r < runs; r++) {
      const len = r === runs - 1 ? size - placed : Math.floor(size / runs);
      const start = cuts[r] + placed; // gaps before this run = cuts[r]
      for (let k = 0; k < len; k++) out.push(start + k);
      placed += len;
    }
    return out;
  }
  const p = size / universe;
  if (p >= 1) { for (let x = 0; x < universe; x++) out.push(x); return out; }
  const logq = Math.log(1 - p);
  let x = -1;
  for (;;) {
    x += 1 + Math.floor(Math.log(1 - rand()) / logq);
    if (x >= universe) break;
    out.push(x);
  }
  return out;
}

// Median time of fn in milliseconds: repeats until about `budget` ms have been spent.
function timeIt(fn, budget = 120) {
  fn(); // warm-up
  const times = [];
  const started = performance.now();
  while (times.length < 3 || (performance.now() - started < budget && times.length < 400)) {
    const t = performance.now();
    fn();
    times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  return times[times.length >> 1];
}

// A JavaScript Set does not report its own size, so we measure it once: build a Set of
// 1,000,000 IDs and see how much the heap grows (needs node --expose-gc, which the
// server start script passes). Result is about 21 bytes per ID.
let hashBytesPerId = null;
function hashSetBytesPerId() {
  if (hashBytesPerId != null) return hashBytesPerId;
  if (typeof globalThis.gc !== 'function') return (hashBytesPerId = 21);
  globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  const s = new Set();
  for (let i = 0; i < 1_000_000; i++) s.add(i * 7);
  globalThis.gc();
  const after = process.memoryUsage().heapUsed;
  hashBytesPerId = Math.max(8, (after - before) / s.size);
  return hashBytesPerId;
}

function containerCounts(rb) {
  const out = { array: 0, bitmap: 0, run: 0 };
  for (const c of rb.containers) out[c.type]++;
  return out;
}

function check({ universe, sizeA, sizeB }) {
  if (!(universe >= LIMITS.minUniverse && universe <= LIMITS.maxUniverse)) throw new Error('Catalogue size must be between 10,000 and 100,000,000 IDs');
  for (const s of [sizeA, sizeB]) {
    if (!(s >= 1 && s <= LIMITS.maxSize)) throw new Error('Each set must have between 1 and 1,000,000 IDs');
    if (s > universe) throw new Error('A set cannot be bigger than the catalogue');
  }
}

// One full comparison of the four structures on two sets A and B.
export function benchmark({ universe = 1_000_000, sizeA = 100_000, sizeB = 10_000, layout = 'random', seed = 7, quick = false } = {}) {
  universe = Math.floor(universe); sizeA = Math.floor(sizeA); sizeB = Math.floor(sizeB);
  check({ universe, sizeA, sizeB });
  const a = makeIds({ universe, size: sizeA, layout, seed });
  const b = makeIds({ universe, size: sizeB, layout, seed: seed + 101 });

  const builders = [
    ['roaring', 'Roaring bitmap', (ids) => { const r = RoaringBitmap.from(ids); r.runOptimize(); return r; }],
    ['sorted', 'Sorted array', (ids) => new SortedArraySet(ids)],
    ['plain', 'Plain bitmap', (ids) => new PlainBitmap(ids, universe)],
    ['hash', 'Hash set', (ids) => new HashSetCompetitor(ids)],
  ];

  const rand = rng(seed + 999);
  const probes = new Uint32Array(20_000);
  for (let i = 0; i < probes.length; i++) probes[i] = Math.floor(rand() * universe);

  const results = [];
  for (const [key, name, build] of builders) {
    const t0 = performance.now();
    const A = build(a);
    const B = build(b);
    const buildMs = performance.now() - t0;
    let card = 0;
    const andMs = timeIt(() => { card = A.and(B).cardinality; }, quick ? 40 : 120);
    let hits = 0;
    const probeMs = timeIt(() => { hits = 0; for (let i = 0; i < probes.length; i++) if (A.contains(probes[i])) hits++; }, quick ? 25 : 80);
    const bytesA = key === 'hash' ? Math.round(hashSetBytesPerId() * A.cardinality) : A.sizeInBytes();
    const bytesB = key === 'hash' ? Math.round(hashSetBytesPerId() * B.cardinality) : B.sizeInBytes();
    results.push({
      key, name,
      bytes: bytesA + bytesB, bytesA, bytesB,
      andMs, containsNs: (probeMs * 1e6) / probes.length, buildMs,
      result: card, hits,
      estimated: key === 'hash',
      containers: key === 'roaring' ? { a: containerCounts(A), b: containerCounts(B) } : undefined,
    });
  }
  const agree = results.every((r) => r.result === results[0].result && r.hits === results[0].hits);
  return {
    universe, sizeA: a.length, sizeB: b.length, layout, seed,
    agree, intersection: results[0].result,
    hashBytesPerId: hashSetBytesPerId(),
    results,
  };
}

// Sweeps: how memory and AND time change as one thing grows.
//  'set'       - both sets grow from 100 to 1,000,000 IDs in a 1,000,000-ID catalogue
//  'catalogue' - the sets stay at 1,000 IDs while the catalogue grows to 100,000,000
export function sweep({ mode = 'set', layout = 'random', seed = 7 } = {}) {
  const points = mode === 'catalogue'
    ? [10_000, 100_000, 1_000_000, 10_000_000, 100_000_000].map((u) => ({ universe: u, size: 1_000, x: u }))
    : [100, 1_000, 4_096, 16_000, 65_536, 250_000, 1_000_000].map((n) => ({ universe: 1_000_000, size: n, x: n }));
  const series = { roaring: [], sorted: [], plain: [], hash: [] };
  for (const pt of points) {
    const r = benchmark({ universe: pt.universe, sizeA: pt.size, sizeB: pt.size, layout, seed, quick: true });
    for (const row of r.results) series[row.key].push({ x: pt.x, bytes: row.bytesA, andMs: row.andMs });
  }
  return { mode, layout, xLabel: mode === 'catalogue' ? 'Catalogue size (IDs)' : 'IDs in each set', points: points.map((p) => p.x), series };
}
