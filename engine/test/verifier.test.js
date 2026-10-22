import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verify } from '../Verifier.js';
import * as engine from '../index.js';

test('10,000 random operations agree with brute force', () => {
  const report = verify({ operations: 10000, seed: 42 });
  assert.equal(report.mismatches, 0, JSON.stringify(report.failures));
  assert.equal(report.operations, 10000);
});

test('the stress test exercises all three container types', () => {
  const report = verify({ operations: 10000, seed: 7 });
  assert.deepEqual(report.containerTypesSeen, ['array', 'bitmap', 'run']);
  for (const op of ['add', 'remove', 'contains', 'addRange', 'and', 'or', 'andNot', 'runOptimize']) {
    assert.ok(report.counts[op] > 0, op + ' was exercised');
  }
});

test('different seeds give different but always correct runs', () => {
  for (const seed of [1, 2, 3]) assert.equal(verify({ operations: 3000, seed }).mismatches, 0);
});

test('the engine entry point exports everything the server needs', () => {
  for (const name of ['RoaringBitmap', 'CatalogIndex', 'BitSlicedIndex', 'runQuery', 'facetCounts', 'verify', 'SortedArraySet', 'PlainBitmap', 'HashSetCompetitor']) {
    assert.ok(engine[name], name + ' is exported');
  }
});
