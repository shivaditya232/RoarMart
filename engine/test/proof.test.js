import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayContainer } from '../ArrayContainer.js';
import { toBitmap } from '../convert.js';
import { and, compareAnd, GALLOP_RATIO } from '../ops.js';
import { CatalogIndex } from '../CatalogIndex.js';
import { runQuery } from '../QueryPlanner.js';

// Tests for the X-ray's proof: replaying the chosen method and its alternative.

function rand(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function arr(n, seed) {
  const r = rand(seed); const set = new Set();
  while (set.size < n) set.add(Math.floor(r() * 65536));
  return ArrayContainer.fromSorted([...set].sort((a, b) => a - b));
}

test('galloping starts at the measured 4x ratio', () => {
  assert.equal(GALLOP_RATIO, 4);
  const t1 = []; and(arr(1000, 1), arr(4000, 2), t1);
  assert.equal(t1[0].method, 'gallop');
  const t2 = []; and(arr(2000, 3), arr(4000, 4), t2);
  assert.equal(t2[0].method, 'merge');
});

test('array ∩ array: merge and galloping give the same answer, galloping takes fewer steps on a small list', () => {
  const runs = compareAnd(arr(40, 5), arr(3925, 6));
  const merge = runs.find((r) => r.method === 'merge');
  const gallop = runs.find((r) => r.method === 'gallop');
  assert.equal(merge.result, gallop.result);
  assert.ok(gallop.comparisons < merge.comparisons / 4);
  assert.ok(merge.us > 0 && gallop.us > 0);
});

test('array ∩ bitmap: bit test costs one step per array value, the alternative also walks 2,048 words', () => {
  const small = arr(40, 7);
  const big = toBitmap(arr(6000, 8));
  const runs = compareAnd(small, big);
  const bit = runs.find((r) => r.method === 'bit-test');
  const words = runs.find((r) => r.method === 'word-and');
  assert.equal(bit.comparisons, 40);
  assert.equal(words.comparisons, 40 + 2048);
  assert.equal(bit.result, words.result);
});

test('bitmap ∩ bitmap: ANDing words and merging lists agree', () => {
  const runs = compareAnd(toBitmap(arr(5000, 9)), toBitmap(arr(7000, 10)));
  assert.equal(runs.length, 2);
  assert.equal(runs[0].result, runs[1].result);
});

test('a proven query reports both orders and the alternatives, without leaking containers', () => {
  const index = new CatalogIndex();
  for (let id = 0; id < 9000; id++) {
    index.addProduct(id, {
      brand: id % 200 === 0 ? 'Tiny' : 'Big', category: ['Clothing'], colors: [id % 3 === 0 ? 'Red' : 'Blue'],
      idealFor: [id % 2 === 0 ? 'Women' : 'Men'], price: 100 + (id % 900), discount: 0, assured: false, inStock: true,
    });
  }
  const q = { filters: { brand: ['Tiny'], color: ['Red'], for: ['Women'] } };
  const plain = runQuery(index, q, { trace: true });
  assert.equal(plain.proof, null); // only computed when asked for
  const { result, steps, proof } = runQuery(index, q, { trace: true, prove: true });
  assert.equal(result.cardinality, plain.result.cardinality);
  assert.ok(proof.smallestFirst.comparisons <= proof.largestFirst.comparisons);
  const withAlternatives = steps.flatMap((s) => s.chunks || []).filter((c) => c.alternatives);
  assert.ok(withAlternatives.length > 0);
  assert.ok(!JSON.stringify(steps).includes('pair')); // the replayed containers are never sent to the Studio
});
