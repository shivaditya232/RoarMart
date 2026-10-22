import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CatalogIndex, termsOf } from '../CatalogIndex.js';
import { runQuery, facetCounts } from '../QueryPlanner.js';

const COLORS = ['Red', 'Blue', 'Black', 'White', 'Pink'];
const BRANDS = ['S4S', 'Grafion', 'Voylla', 'Jiya', 'Meera', 'Clovia'];
const CATS = [['Clothing', "Women's Clothing"], ['Clothing', "Men's Clothing"], ['Jewellery'], ['Footwear']];
const FOR = [['Women'], ['Men'], ['Women', 'Girls'], []];

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

function makeCatalog(n, seed) {
  const rand = rng(seed);
  const products = [];
  for (let id = 0; id < n; id++) {
    products.push({
      category: pick(rand, CATS), brand: pick(rand, BRANDS),
      colors: rand() < 0.8 ? [pick(rand, COLORS)] : [], idealFor: pick(rand, FOR),
      price: 50 + Math.floor(rand() * 5000), discount: Math.floor(rand() * 90),
      assured: rand() < 0.05, inStock: rand() >= 0.07,
    });
  }
  const index = new CatalogIndex();
  products.forEach((p, id) => index.addProduct(id, p));
  return { products, index };
}

// Brute-force version of the same query, product by product.
function matches(p, q, skipField = null) {
  const f = q.filters || {};
  const has = (field, list) => {
    if (!list || list.length === 0 || field === skipField) return true;
    if (field === 'cat') return list.some((c) => p.category.slice(0, c.split(' > ').length).join(' > ') === c);
    if (field === 'brand') return list.includes(p.brand);
    if (field === 'color') return list.some((c) => p.colors.includes(c));
    if (field === 'for') return list.some((x) => p.idealFor.includes(x));
    return true;
  };
  if (!has('cat', f.cat) || !has('brand', f.brand) || !has('color', f.color) || !has('for', f.for)) return false;
  if (q.assured && !p.assured) return false;
  if (q.price && skipField !== 'price' && (p.price < (q.price.min ?? 0) || p.price > (q.price.max ?? Infinity))) return false;
  if (q.discountMin && p.discount < q.discountMin) return false;
  if (q.inStock && !p.inStock) return false;
  return true;
}

test('termsOf lists every level of the category tree and stores out-of-stock only', () => {
  const t = termsOf({ category: ['Clothing', "Women's Clothing", 'Ethnic Wear'], brand: 'Jiya', colors: ['Pink', 'Silver'], idealFor: ['Women'], assured: false, inStock: false });
  assert.deepEqual(t, ['cat:Clothing', "cat:Clothing > Women's Clothing", "cat:Clothing > Women's Clothing > Ethnic Wear", 'brand:Jiya', 'color:Pink', 'color:Silver', 'for:Women', 'oos']);
  assert.ok(!termsOf({ inStock: true }).includes('oos'));
});

test('queries match brute force for many filter combinations', () => {
  const { products, index } = makeCatalog(8000, 7);
  const queries = [
    {},
    { filters: { color: ['Red'] } },
    { filters: { color: ['Red', 'Blue'] } },
    { filters: { cat: ['Clothing'], for: ['Women'] } },
    { filters: { cat: ["Clothing > Women's Clothing"], color: ['Pink'] }, price: { min: 500, max: 1500 } },
    { filters: { brand: ['S4S', 'Jiya'] }, inStock: true },
    { filters: { cat: ['Jewellery'] }, assured: true },
    { price: { min: 4000 }, discountMin: 50, inStock: true },
    { filters: { color: ['Red'], cat: ['Footwear'], for: ['Men'], brand: ['Meera'] } },
  ];
  for (const q of queries) {
    const expected = products.map((p, id) => (matches(p, q) ? id : -1)).filter((id) => id >= 0);
    assert.deepEqual(runQuery(index, q).result.toArray(), expected, JSON.stringify(q));
  }
});

test('the planner applies the smallest filter first and records each step', () => {
  const { index } = makeCatalog(8000, 11);
  const { steps } = runQuery(index, { filters: { cat: ['Clothing'], color: ['Red'], brand: ['Jiya'] }, inStock: true }, { trace: true });
  const sizes = steps.filter((s) => s.op !== 'andNot').map((s) => s.size);
  assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b));
  assert.equal(steps.at(-1).op, 'andNot');
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i].left <= steps[i - 1].left);
});

test('facet counts ignore their own field, like real shops', () => {
  const { products, index } = makeCatalog(6000, 3);
  const q = { filters: { color: ['Red'], cat: ['Clothing'] } };
  const counts = facetCounts(index, q, ['color', 'brand']);
  for (const { value, count } of counts.color) {
    const expected = products.filter((p) => matches(p, q, 'color') && p.colors.includes(value)).length;
    assert.equal(count, expected, 'color ' + value);
  }
  for (const { value, count } of counts.brand) {
    const expected = products.filter((p) => matches(p, q) && p.brand === value).length;
    assert.equal(count, expected, 'brand ' + value);
  }
});

test('removing a product takes it out of every bitmap', () => {
  const { products, index } = makeCatalog(500, 5);
  index.removeProduct(42, products[42]);
  assert.ok(!index.all.contains(42));
  assert.ok(!runQuery(index, {}).result.contains(42));
  assert.ok(!index.price.exists.contains(42));
});
