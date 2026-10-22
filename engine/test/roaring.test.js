import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoaringBitmap } from '../RoaringBitmap.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function sorted(set) { return [...set].sort((a, b) => a - b); }

test('IDs are split into chunks by their high 16 bits', () => {
  const rb = RoaringBitmap.from([5, 65535, 65536, 131072, 4294967295]);
  assert.deepEqual(rb.keys, [0, 1, 2, 65535]);
  assert.equal(rb.cardinality, 5);
  assert.deepEqual(rb.toArray(), [5, 65535, 65536, 131072, 4294967295]);
});

test('chunk boundary values 65,535 and 65,536 land in different chunks', () => {
  const rb = new RoaringBitmap().add(65535).add(65536);
  assert.ok(rb.contains(65535) && rb.contains(65536) && !rb.contains(65537));
  assert.equal(rb.keys.length, 2);
});

test('a chunk switches to a bitmap container past 4,096 values and back', () => {
  const rb = new RoaringBitmap();
  for (let i = 0; i < 4096; i++) rb.add(i * 3);
  assert.equal(rb.containers[0].type, 'array');
  rb.add(1);
  assert.equal(rb.containers[0].type, 'bitmap');
  rb.remove(1);
  assert.equal(rb.containers[0].type, 'array');
  assert.equal(rb.cardinality, 4096);
});

test('removing the last value of a chunk removes the chunk', () => {
  const rb = RoaringBitmap.from([10, 70000]);
  rb.remove(70000);
  assert.deepEqual(rb.keys, [0]);
  rb.remove(10);
  assert.ok(rb.isEmpty());
});

test('addRange creates a run container for an empty chunk', () => {
  const rb = new RoaringBitmap().addRange(100, 9099);
  assert.equal(rb.containers[0].type, 'run');
  assert.equal(rb.cardinality, 9000);
  assert.equal(rb.sizeInBytes(), 2 + 6);
  assert.ok(rb.contains(100) && rb.contains(9099) && !rb.contains(9100));
});

test('addRange across a chunk boundary splits into one run per chunk', () => {
  const rb = new RoaringBitmap().addRange(65000, 66000);
  assert.deepEqual(rb.keys, [0, 1]);
  assert.equal(rb.cardinality, 1001);
});

test('runOptimize compresses consecutive IDs and keeps every value', () => {
  const rb = new RoaringBitmap();
  for (let i = 0; i < 20000; i++) rb.add(i);
  assert.equal(rb.containers[0].type, 'bitmap');
  const before = rb.toArray();
  assert.equal(rb.runOptimize(), 1);
  assert.equal(rb.containers[0].type, 'run');
  assert.deepEqual(rb.toArray(), before);
});

test('editing a run container keeps the set correct', () => {
  const rb = new RoaringBitmap().addRange(0, 99);
  rb.add(500);
  rb.remove(50);
  assert.equal(rb.cardinality, 100);
  assert.ok(rb.contains(500) && !rb.contains(50));
});

test('and, or, andNot and andCardinality match brute force on random sets', () => {
  const rand = rng(99);
  for (let round = 0; round < 25; round++) {
    const A = new Set(), B = new Set();
    const ra = new RoaringBitmap(), rb = new RoaringBitmap();
    for (let i = 0; i < 3000; i++) {
      const pick = rand();
      const x = pick < 0.5 ? Math.floor(rand() * 9000) : pick < 0.8 ? 65536 + Math.floor(rand() * 300000) : Math.floor(rand() * 4294967296);
      if (rand() < 0.5) { A.add(x); ra.add(x); } else { B.add(x); rb.add(x); }
    }
    if (round % 5 === 0) { ra.addRange(1000, 6000); for (let x = 1000; x <= 6000; x++) A.add(x); }
    const andExp = sorted(new Set([...A].filter((x) => B.has(x))));
    assert.deepEqual(ra.and(rb).toArray(), andExp);
    assert.equal(ra.andCardinality(rb), andExp.length);
    assert.deepEqual(ra.or(rb).toArray(), sorted(new Set([...A, ...B])));
    assert.deepEqual(ra.andNot(rb).toArray(), sorted(new Set([...A].filter((x) => !B.has(x)))));
  }
});

test('and() records one trace entry per shared chunk', () => {
  const a = RoaringBitmap.from([1, 2, 3, 70000, 200000]);
  const b = RoaringBitmap.from([2, 3, 70001, 300000]);
  const trace = [];
  const out = a.and(b, trace);
  assert.deepEqual(out.toArray(), [2, 3]);
  assert.deepEqual(trace.map((t) => t.key), [0, 1]);
});

test('slice returns one page of IDs in order', () => {
  const rb = new RoaringBitmap();
  for (let i = 0; i < 100; i++) rb.add(i * 1000);
  assert.deepEqual(rb.slice(0, 3), [0, 1000, 2000]);
  assert.deepEqual(rb.slice(66, 3), [66000, 67000, 68000]);
  assert.equal(rb.slice(98, 10).length, 2);
});

test('stats describe each chunk for the Engine Studio', () => {
  const rb = new RoaringBitmap();
  for (let i = 0; i < 5000; i++) rb.add(i);
  rb.add(70000);
  const s = rb.stats();
  assert.equal(s.cardinality, 5001);
  assert.deepEqual(s.chunks.map((c) => c.type), ['bitmap', 'array']);
  assert.equal(s.bytes, (2 + 8192) + (2 + 4));
});
