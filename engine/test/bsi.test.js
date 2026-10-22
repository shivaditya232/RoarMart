import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BitSlicedIndex } from '../BitSlicedIndex.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

test('a value is stored as one bit per slice', () => {
  const bsi = new BitSlicedIndex(4);
  bsi.set(7, 5); // 5 = 0101
  assert.deepEqual(bsi.slices.map((s) => s.contains(7)), [true, false, true, false]);
  assert.ok(bsi.exists.contains(7));
});

test('range queries match brute force on random prices', () => {
  const rand = rng(2024);
  const bsi = new BitSlicedIndex(20);
  const prices = new Map();
  for (let id = 0; id < 5000; id++) {
    const p = Math.floor(rand() * 600000);
    prices.set(id, p);
    bsi.set(id, p);
  }
  const queries = [[0, 0], [0, 499], [500, 1500], [1000, 1000], [99999, 100001], [0, 1048575], [300000, 2000000]];
  for (let i = 0; i < 20; i++) {
    const a = Math.floor(rand() * 600000), b = Math.floor(rand() * 600000);
    queries.push([Math.min(a, b), Math.max(a, b)]);
  }
  for (const [lo, hi] of queries) {
    const expected = [...prices].filter(([, p]) => p >= lo && p <= hi).map(([id]) => id).sort((x, y) => x - y);
    assert.deepEqual(bsi.between(lo, hi).toArray(), expected, `between ${lo} and ${hi}`);
  }
});

test('lessOrEqual and greaterOrEqual handle the edges', () => {
  const bsi = new BitSlicedIndex(8);
  [0, 1, 128, 254, 255].forEach((v, id) => bsi.set(id, v));
  assert.deepEqual(bsi.lessOrEqual(-1).toArray(), []);
  assert.deepEqual(bsi.lessOrEqual(0).toArray(), [0]);
  assert.deepEqual(bsi.lessOrEqual(255).toArray(), [0, 1, 2, 3, 4]);
  assert.deepEqual(bsi.greaterOrEqual(0).toArray(), [0, 1, 2, 3, 4]);
  assert.deepEqual(bsi.greaterOrEqual(255).toArray(), [4]);
  assert.deepEqual(bsi.greaterOrEqual(256).toArray(), []);
  assert.deepEqual(bsi.between(10, 5).toArray(), []);
});

test('remove takes an ID out of every slice', () => {
  const bsi = new BitSlicedIndex(8);
  bsi.set(1, 200); bsi.set(2, 100);
  bsi.remove(1);
  assert.deepEqual(bsi.between(0, 255).toArray(), [2]);
});
