import { RoaringBitmap } from './RoaringBitmap.js';
import { FIELDS } from './CatalogIndex.js';

// QueryPlanner: turns a shopper's filters into Roaring Bitmap operations.
//
// A query looks like:
//   { filters: { cat: ['Clothing'], color: ['Red', 'Blue'], for: ['Women'] },
//     price: { min: 500, max: 1500 }, discountMin: 40, assured: true, inStock: true }
//
// Rules:
//   - values inside one field are OR'ed  (Red OR Blue)
//   - different fields are AND'ed        (color AND category AND audience)
//   - AND operands are applied SMALLEST FIRST, so each step works on the fewest IDs
//   - "in stock only" subtracts the small out-of-stock bitmap at the end (ANDNOT)
//
// With trace on, every step records its sizes and the container-level method chosen,
// which is what the Engine Studio's X-ray displays.

function fieldBitmap(index, field, values) {
  if (values.length === 1) return index.bitmap(field + ':' + values[0]);
  let u = new RoaringBitmap();
  for (const v of values) u = u.or(index.bitmap(field + ':' + v));
  return u;
}

// Builds the list of AND operands for a query, optionally leaving one field out
// (needed for facet counts).
function operands(index, query, skipField = null) {
  const list = [];
  const filters = query.filters || {};
  for (const field of FIELDS) {
    const values = filters[field];
    if (!values || values.length === 0 || field === skipField) continue;
    list.push({ label: field + ':' + values.join('|'), kind: 'term', bitmap: fieldBitmap(index, field, values) });
  }
  if (query.assured) list.push({ label: 'assured', kind: 'term', bitmap: index.bitmap('assured') });
  if (query.price && skipField !== 'price') {
    const min = query.price.min ?? 0;
    const max = query.price.max ?? index.price.maxValue;
    list.push({ label: `price:${min}–${max}`, kind: 'range', slices: index.price.bits, bitmap: index.price.between(min, max) });
  }
  if (query.discountMin) {
    list.push({ label: `discount>=${query.discountMin}`, kind: 'range', slices: index.discount.bits, bitmap: index.discount.greaterOrEqual(query.discountMin) });
  }
  return list;
}

function containerSummary(bm) {
  const s = { array: 0, bitmap: 0, run: 0 };
  for (const c of bm.containers) s[c.type]++;
  return s;
}

// Time: O(sum over steps of the container-pair costs); the smallest-first order keeps
// every step bounded by the size of the smallest operand.
export function runQuery(index, query, { trace = false, skipField = null } = {}) {
  const started = performance.now();
  const list = operands(index, query, skipField);
  list.sort((a, b) => a.bitmap.cardinality - b.bitmap.cardinality);

  const steps = [];
  let result;
  if (list.length === 0) {
    result = index.all;
  } else {
    result = list[0].bitmap;
    if (trace) steps.push({ op: 'start', label: list[0].label, kind: list[0].kind, slices: list[0].slices, size: list[0].bitmap.cardinality, bytes: list[0].bitmap.sizeInBytes(), containers: containerSummary(list[0].bitmap), left: result.cardinality, chunks: [] });
    for (let i = 1; i < list.length; i++) {
      const chunkTrace = trace ? [] : null;
      result = result.and(list[i].bitmap, chunkTrace);
      if (trace) steps.push({ op: 'and', label: list[i].label, kind: list[i].kind, slices: list[i].slices, size: list[i].bitmap.cardinality, bytes: list[i].bitmap.sizeInBytes(), containers: containerSummary(list[i].bitmap), left: result.cardinality, chunks: chunkTrace });
    }
  }
  if (query.inStock) {
    const oos = index.bitmap('oos');
    result = result.andNot(oos);
    if (trace) steps.push({ op: 'andNot', label: 'out of stock', kind: 'term', size: oos.cardinality, bytes: oos.sizeInBytes(), containers: containerSummary(oos), left: result.cardinality, chunks: [] });
  }
  const ms = performance.now() - started;
  return { result, steps, ms };
}

// Facet counts the way real shops do it: the counts for a field ignore that field's
// own selection, so picking "Red" still shows how many Blue items exist.
// Time: one query per field + one andCardinality per value
export function facetCounts(index, query, fields = ['cat', 'brand', 'color', 'for']) {
  const out = {};
  for (const field of fields) {
    const base = runQuery(index, query, { skipField: field }).result;
    const counts = [];
    for (const value of index.values(field)) {
      const n = base.andCardinality(index.bitmap(field + ':' + value));
      if (n > 0) counts.push({ value, count: n });
    }
    counts.sort((a, b) => b.count - a.count);
    out[field] = counts;
  }
  return out;
}
