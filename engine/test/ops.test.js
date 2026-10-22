import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayContainer } from '../ArrayContainer.js';
import { BitmapContainer } from '../BitmapContainer.js';
import { RunContainer } from '../RunContainer.js';
import { toBitmap } from '../convert.js';
import { and, andCardinality, or, andNot } from '../ops.js';

// Helpers: build containers of each type from a list of values, and read values back.
function arr(values) { return ArrayContainer.fromSorted([...new Set(values)].sort((a, b) => a - b)); }
function bmp(values) { return toBitmap(arr(values)); }
function run(values) { return RunContainer.fromContainer(arr(values)); }
function valuesOf(c) { const out = []; c.forEach((v) => out.push(v)); return out; }

// Brute-force reference answers using plain JS Sets.
function refAnd(a, b) { const s = new Set(b); return [...new Set(a)].filter((x) => s.has(x)).sort((x, y) => x - y); }
function refOr(a, b) { return [...new Set([...a, ...b])].sort((x, y) => x - y); }
function refAndNot(a, b) { const s = new Set(b); return [...new Set(a)].filter((x) => !s.has(x)).sort((x, y) => x - y); }

function randomValues(count, max, seed) {
  let s = seed;
  const out = [];
  for (let i = 0; i < count; i++) { s = (s * 1103515245 + 12345) % 2147483648; out.push(s % max); }
  return out;
}

const builders = { array: arr, bitmap: bmp, run: run };

test('every container pairing gives the same answer as brute force', () => {
  const sparse = randomValues(300, 65536, 7);
  const dense = randomValues(9000, 65536, 11);
  const ranges = [];
  for (let v = 1000; v < 3000; v++) ranges.push(v);
  for (let v = 40000; v < 47000; v++) ranges.push(v);
  const samples = { sparse, dense, ranges };
  for (const [nameA, valsA] of Object.entries(samples)) {
    for (const [nameB, valsB] of Object.entries(samples)) {
      for (const [typeA, buildA] of Object.entries(builders)) {
        for (const [typeB, buildB] of Object.entries(builders)) {
          const A = buildA(valsA), B = buildB(valsB);
          const label = `${nameA}/${typeA} vs ${nameB}/${typeB}`;
          assert.deepEqual(valuesOf(and(A, B)), refAnd(valsA, valsB), 'AND ' + label);
          assert.equal(andCardinality(A, B), refAnd(valsA, valsB).length, 'AND count ' + label);
          assert.deepEqual(valuesOf(or(A, B)), refOr(valsA, valsB), 'OR ' + label);
          assert.deepEqual(valuesOf(andNot(A, B)), refAndNot(valsA, valsB), 'ANDNOT ' + label);
        }
      }
    }
  }
});

test('array ∩ array uses merge when sizes are similar', () => {
  const trace = [];
  and(arr(randomValues(500, 65536, 1)), arr(randomValues(600, 65536, 2)), trace);
  assert.equal(trace[0].method, 'merge');
});

test('array ∩ array uses galloping when one side is 64x bigger', () => {
  const trace = [];
  const small = arr([5, 900, 30000]);
  const large = arr(randomValues(4000, 65536, 3));
  and(small, large, trace);
  assert.equal(trace[0].method, 'gallop');
  // galloping touches far fewer elements than walking the whole large array
  assert.ok(trace[0].comparisons < large.cardinality);
});

test('array ∩ bitmap tests one bit per array value', () => {
  const trace = [];
  const a = arr(randomValues(200, 65536, 4));
  const out = and(a, bmp(randomValues(9000, 65536, 5)), trace);
  assert.equal(trace[0].method, 'bit-test');
  assert.equal(trace[0].comparisons, a.cardinality);
  assert.equal(out.type, 'array');
});

test('bitmap ∩ bitmap returns an array when the result is small', () => {
  const evens = [], odds = [];
  for (let v = 0; v < 20000; v += 2) evens.push(v);
  for (let v = 1; v < 20000; v += 2) odds.push(v);
  const out = and(bmp(evens), bmp([...odds, 0, 2, 4]), []);
  assert.equal(out.type, 'array');
  assert.deepEqual(valuesOf(out), [0, 2, 4]);
});

test('bitmap ∩ bitmap stays a bitmap when the result is large', () => {
  const a = [], b = [];
  for (let v = 0; v < 30000; v++) a.push(v);
  for (let v = 10000; v < 40000; v++) b.push(v);
  const out = and(bmp(a), bmp(b), []);
  assert.equal(out.type, 'bitmap');
  assert.equal(out.cardinality, 20000);
});

test('array ∪ array switches to a bitmap when the result passes 4,096', () => {
  const a = [], b = [];
  for (let v = 0; v < 3000; v++) a.push(v * 2);
  for (let v = 0; v < 3000; v++) b.push(v * 2 + 1);
  const out = or(arr(a), arr(b));
  assert.equal(out.type, 'bitmap');
  assert.equal(out.cardinality, 6000);
});

test('bitmap minus bitmap returns an array when few values remain', () => {
  const a = [], b = [];
  for (let v = 0; v < 10000; v++) a.push(v);
  for (let v = 0; v < 9990; v++) b.push(v);
  const out = andNot(bmp(a), bmp(b));
  assert.equal(out.type, 'array');
  assert.equal(out.cardinality, 10);
});
