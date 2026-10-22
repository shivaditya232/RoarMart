import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeIds, benchmark } from '../bench.js';
import { ScratchConsole } from '../console.js';
import { CatalogIndex } from '../../engine/index.js';

test('makeIds gives sorted, distinct IDs inside the catalogue', () => {
  for (const layout of ['random', 'clustered']) {
    const ids = makeIds({ universe: 100_000, size: 5_000, layout, seed: 3 });
    assert.ok(ids.length > 4_700 && ids.length < 5_300); // random picks give about 5,000
    for (let i = 1; i < ids.length; i++) assert.ok(ids[i] > ids[i - 1]);
    assert.ok(ids[0] >= 0 && ids[ids.length - 1] < 100_000);
  }
});

test('all four structures agree on A ∩ B and on lookups', () => {
  for (const cfg of [
    { universe: 1_000_000, sizeA: 50_000, sizeB: 5_000 },
    { universe: 10_000_000, sizeA: 200_000, sizeB: 100_000, layout: 'clustered' },
  ]) {
    const r = benchmark({ ...cfg, quick: true });
    assert.equal(r.agree, true);
    assert.equal(r.results.length, 4);
  }
});

test('benchmark rejects sizes outside the limits', () => {
  assert.throws(() => benchmark({ universe: 5, sizeA: 1, sizeB: 1 }));
  assert.throws(() => benchmark({ universe: 1_000_000, sizeA: 2_000_000, sizeB: 1 }));
});

test('console commands change the scratch bitmaps', () => {
  const index = new CatalogIndex();
  index.addProduct(0, { brand: 'Nike', category: ['Footwear'], colors: ['Red'], idealFor: ['Men'], price: 999, discount: 10, assured: false, inStock: true });
  const c = new ScratchConsole(index);
  c.run('add A 0..70000');
  assert.equal(c.bitmaps.A.cardinality, 70_001);
  c.run('add B 5,65536,99');
  c.run('and A B');
  assert.deepEqual(c.bitmaps.R.toArray(), [5, 99, 65536]);
  c.run('load B brand:Nike');
  assert.equal(c.bitmaps.B.cardinality, 1);
  const bad = c.run('add C 5');
  assert.equal(bad.lines[0].kind, 'err');
  const big = c.run('add A 4294967296');
  assert.equal(big.lines[0].kind, 'err');
});
