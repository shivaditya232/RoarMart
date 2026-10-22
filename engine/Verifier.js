import { RoaringBitmap } from './RoaringBitmap.js';

// Verifier: runs random operations on RoaringBitmaps and on plain JS Sets side by side,
// and checks that both always agree. This is the "stress test" in the Engine Studio.
//
// IDs are drawn so that every container type and every edge case gets exercised:
//   - sparse random IDs (array containers)
//   - dense blocks of > 4,096 IDs in one chunk (bitmap containers)
//   - consecutive ranges (run containers)
//   - chunk boundaries 65,535 / 65,536 and the largest 32-bit values

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function sameSet(rb, set) {
  if (rb.cardinality !== set.size) return false;
  for (const x of rb.toArray()) if (!set.has(x)) return false;
  return true;
}

const EDGE = [0, 1, 65535, 65536, 65537, 131071, 131072, 4294967294, 4294967295];

function randomId(rand) {
  const r = rand();
  if (r < 0.1) return EDGE[Math.floor(rand() * EDGE.length)];
  if (r < 0.55) return Math.floor(rand() * 9000);              // dense chunk 0 -> bitmap
  if (r < 0.8) return 65536 + Math.floor(rand() * 200000);     // sparse -> arrays
  return Math.floor(rand() * 4294967296);                      // anywhere in 32 bits
}

export function verify({ operations = 10000, seed = 42 } = {}) {
  const rand = rng(seed);
  const rbs = [new RoaringBitmap(), new RoaringBitmap()];
  const sets = [new Set(), new Set()];
  const counts = { add: 0, remove: 0, contains: 0, addRange: 0, and: 0, or: 0, andNot: 0, runOptimize: 0 };
  const seenTypes = new Set();
  let mismatches = 0;
  const failures = [];

  for (let op = 0; op < operations; op++) {
    const w = rand() < 0.5 ? 0 : 1;
    const r = rand();
    let ok = true;
    let name;
    if (r < 0.45) {
      name = 'add'; const x = randomId(rand); rbs[w].add(x); sets[w].add(x);
    } else if (r < 0.65) {
      name = 'remove'; const x = randomId(rand); rbs[w].remove(x); sets[w].delete(x);
    } else if (r < 0.75) {
      name = 'contains'; const x = randomId(rand); ok = rbs[w].contains(x) === sets[w].has(x);
    } else if (r < 0.765) {
      name = 'addRange';
      // ranges stay inside the first few chunks so the reference Sets stay small
      const lo = Math.floor(rand() * 200000); const hi = lo + 4100 + Math.floor(rand() * 2000);
      rbs[w].addRange(lo, hi); for (let x = lo; x <= hi; x++) sets[w].add(x);
    } else if (r < 0.84) {
      name = 'and'; const out = rbs[0].and(rbs[1]);
      const exp = new Set(); for (const x of sets[0]) if (sets[1].has(x)) exp.add(x);
      ok = sameSet(out, exp) && out.cardinality === rbs[0].andCardinality(rbs[1]);
    } else if (r < 0.9) {
      name = 'or'; const out = rbs[0].or(rbs[1]);
      const exp = new Set([...sets[0], ...sets[1]]); ok = sameSet(out, exp);
    } else if (r < 0.96) {
      name = 'andNot'; const out = rbs[0].andNot(rbs[1]);
      const exp = new Set(); for (const x of sets[0]) if (!sets[1].has(x)) exp.add(x);
      ok = sameSet(out, exp);
    } else {
      name = 'runOptimize'; rbs[w].runOptimize(); ok = sameSet(rbs[w], sets[w]);
    }
    for (const c of rbs[w].containers) seenTypes.add(c.type);
    counts[name]++;
    if (op % 500 === 0 && !sameSet(rbs[w], sets[w])) ok = false;
    if (!ok) { mismatches++; if (failures.length < 5) failures.push({ op, name }); }
    // Every 1,000 operations: check both bitmaps in full, then start a fresh round,
    // so the brute-force reference Sets never grow huge and the test stays fast.
    if (op % 1000 === 999) {
      for (let k = 0; k < 2; k++) {
        if (!sameSet(rbs[k], sets[k])) { mismatches++; if (failures.length < 5) failures.push({ op, name: 'round-check' }); }
      }
      rbs[0] = new RoaringBitmap(); rbs[1] = new RoaringBitmap();
      sets[0] = new Set(); sets[1] = new Set();
    }
  }
  const finalOk = sameSet(rbs[0], sets[0]) && sameSet(rbs[1], sets[1]);
  if (!finalOk) mismatches++;
  return { operations, mismatches, counts, containerTypesSeen: [...seenTypes].sort(), failures };
}
