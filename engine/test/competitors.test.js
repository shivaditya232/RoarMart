import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoaringBitmap } from '../RoaringBitmap.js';
import { SortedArraySet } from '../competitors/SortedArraySet.js';
import { PlainBitmap } from '../competitors/PlainBitmap.js';
import { HashSetCompetitor } from '../competitors/HashSetCompetitor.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function randomIds(n, universe, seed) {
  const rand = rng(seed);
  const set = new Set();
  while (set.size < n) set.add(Math.floor(rand() * universe));
  return [...set].sort((a, b) => a - b);
}

test('all four structures give the same intersection', () => {
  const universe = 200000;
  const a = randomIds(5000, universe, 1), b = randomIds(30000, universe, 2);
  const expected = RoaringBitmap.from(a).and(RoaringBitmap.from(b)).toArray();
  const sorted = new SortedArraySet(a).and(new SortedArraySet(b));
  assert.deepEqual([...sorted.values], expected);
  const plain = new PlainBitmap(a, universe).and(new PlainBitmap(b, universe));
  assert.equal(plain.cardinality, expected.length);
  for (const x of expected) assert.ok(plain.contains(x));
  const hash = new HashSetCompetitor(a).and(new HashSetCompetitor(b));
  assert.deepEqual([...hash.set].sort((x, y) => x - y), expected);
});

test('memory: sorted array pays 4 bytes per ID, plain bitmap pays for the whole range', () => {
  const ids = randomIds(1000, 1000000, 3);
  assert.equal(new SortedArraySet(ids).sizeInBytes(), 4000);
  assert.equal(new PlainBitmap(ids, 1000000).sizeInBytes(), 125000);
  // Roaring: 1,000 sparse IDs over ~16 chunks, each a small array
  assert.ok(RoaringBitmap.from(ids).sizeInBytes() < 4000);
});

test('memory: on a dense set Roaring and a plain bitmap beat the sorted array', () => {
  const ids = [];
  for (let i = 0; i < 60000; i++) ids.push(i);
  const roaring = RoaringBitmap.from(ids);
  assert.equal(roaring.sizeInBytes(), 2 + 8192);
  assert.equal(new SortedArraySet(ids).sizeInBytes(), 240000);
  roaring.runOptimize();
  assert.equal(roaring.sizeInBytes(), 2 + 6);
});
