import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARRAY_MAX, BITMAP_BYTES, popcount32 } from '../constants.js';
import { ArrayContainer } from '../ArrayContainer.js';
import { BitmapContainer } from '../BitmapContainer.js';
import { RunContainer } from '../RunContainer.js';
import { toBitmap, toArray, toArrayOrBitmap, toSmallest } from '../convert.js';

function valuesOf(c) {
  const out = [];
  c.forEach((v) => out.push(v));
  return out;
}

test('popcount32 counts bits correctly', () => {
  assert.equal(popcount32(0), 0);
  assert.equal(popcount32(1), 1);
  assert.equal(popcount32(0xffffffff), 32);
  assert.equal(popcount32(0x80000001), 2);
  assert.equal(popcount32(0b1011), 3);
});

test('the 4096 threshold is where array and bitmap cost the same', () => {
  assert.equal(ARRAY_MAX * 2, BITMAP_BYTES);
});

test('array container keeps values sorted and unique', () => {
  let c = new ArrayContainer();
  for (const v of [500, 3, 65535, 3, 0, 42]) c = c.add(v, toBitmap);
  assert.equal(c.type, 'array');
  assert.deepEqual(valuesOf(c), [0, 3, 42, 500, 65535]);
  assert.equal(c.cardinality, 5);
  assert.ok(c.contains(65535));
  assert.ok(!c.contains(4));
  c = c.remove(42);
  assert.deepEqual(valuesOf(c), [0, 3, 500, 65535]);
  assert.equal(c.sizeInBytes(), 2 * 4 + 2);
});

test('array becomes a bitmap when the 4,097th value is added', () => {
  let c = new ArrayContainer();
  for (let v = 0; v < ARRAY_MAX; v++) c = c.add(v * 2, toBitmap);
  assert.equal(c.type, 'array');
  assert.equal(c.cardinality, 4096);
  c = c.add(1, toBitmap);
  assert.equal(c.type, 'bitmap');
  assert.equal(c.cardinality, 4097);
  assert.ok(c.contains(1) && c.contains(8190) && !c.contains(3));
});

test('bitmap becomes an array again when it shrinks to 4,096 values', () => {
  let c = new BitmapContainer();
  for (let v = 0; v <= ARRAY_MAX; v++) c = c.add(v);
  assert.equal(c.type, 'bitmap');
  assert.equal(c.cardinality, 4097);
  c = c.remove(100, toArray);
  assert.equal(c.type, 'array');
  assert.equal(c.cardinality, 4096);
  assert.ok(!c.contains(100) && c.contains(4096));
});

test('bitmap container covers all 65,536 positions', () => {
  const c = new BitmapContainer();
  for (const v of [0, 31, 32, 63, 64, 65535]) c.add(v);
  assert.deepEqual(valuesOf(c), [0, 31, 32, 63, 64, 65535]);
  assert.equal(c.cardinality, 6);
  assert.equal(c.recount(), 6);
  assert.equal(c.sizeInBytes(), 8192);
});

test('number of runs is counted the same way for every container type', () => {
  const vals = [1, 2, 3, 10, 11, 31, 32, 33, 65534, 65535];
  const a = ArrayContainer.fromSorted(vals);
  const b = toBitmap(a);
  const r = RunContainer.fromContainer(a);
  assert.equal(a.numberOfRuns(), 4);
  assert.equal(b.numberOfRuns(), 4);
  assert.equal(r.numberOfRuns(), 4);
  assert.deepEqual(valuesOf(r), vals);
});

test('run container answers contains with binary search over runs', () => {
  const r = RunContainer.fromContainer(ArrayContainer.fromSorted([5, 6, 7, 100, 200, 201]));
  assert.equal(r.cardinality, 6);
  for (const v of [5, 6, 7, 100, 200, 201]) assert.ok(r.contains(v));
  for (const v of [0, 4, 8, 99, 101, 199, 202, 65535]) assert.ok(!r.contains(v));
  const big = RunContainer.range(0, 65535);
  assert.equal(big.cardinality, 65536);
  assert.equal(big.sizeInBytes(), 6);
});

test('conversions preserve every value', () => {
  const vals = [];
  for (let v = 0; v < 65536; v += 7) vals.push(v);
  const bitmap = toBitmap(ArrayContainer.fromSorted(vals.slice(0, 4000)));
  assert.deepEqual(valuesOf(toArray(bitmap)), vals.slice(0, 4000));
  const run = RunContainer.range(1000, 9999);
  assert.equal(toArrayOrBitmap(run).type, 'bitmap');
  assert.equal(toArrayOrBitmap(RunContainer.range(0, 99)).type, 'array');
});

test('toSmallest picks the cheapest representation', () => {
  // 9,000 consecutive values: 1 run (6 bytes) beats a bitmap (8,192 bytes)
  const consecutive = toBitmap(RunContainer.range(0, 8999));
  assert.equal(toSmallest(consecutive).type, 'run');
  // 9,000 scattered values: bitmap is smallest
  let scattered = new BitmapContainer();
  for (let v = 0; v < 18000; v += 2) scattered.add(v);
  assert.equal(toSmallest(scattered).type, 'bitmap');
  // 50 scattered values: array is smallest
  const few = ArrayContainer.fromSorted(Array.from({ length: 50 }, (_, i) => i * 3));
  assert.equal(toSmallest(few).type, 'array');
});
