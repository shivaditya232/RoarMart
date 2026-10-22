import { readFileSync } from 'node:fs';
import { CatalogIndex, runQuery, facetCounts } from '../engine/index.js';

// Store: the catalogue plus its Roaring Bitmap index, kept in memory.
//
// Product records (name, images, price) live in a plain array indexed by product ID.
// Every filter, count and range goes through the engine; the array is only used to
// look up the details of the IDs the engine returns.
export class Store {
  constructor(dataFile) {
    const started = performance.now();
    const raw = JSON.parse(readFileSync(dataFile, 'utf8'));
    this.products = [];
    this.index = new CatalogIndex();
    for (const p of raw) {
      this.products[p.id] = p;
      this.index.addProduct(p.id, p);
    }
    this.nextId = this.products.length;
    this.loadMs = performance.now() - started;
    this.warmUp();
  }

  // Runs a few searches at start so the JavaScript engine has compiled the hot paths
  // before the first real shopper arrives (otherwise the first search looks slow).
  warmUp() {
    const queries = [
      {}, { filters: { cat: ['Clothing'], for: ['Women'] }, inStock: true },
      { filters: { color: ['Red'], cat: ['Clothing'] }, price: { min: 500, max: 1500 } },
      { filters: { brand: ['Voylla'] }, discountMin: 40 },
    ];
    for (let round = 0; round < 30; round++) {
      for (const q of queries) this.search(q, { trace: true, sort: round % 2 ? 'price-asc' : 'relevance' });
    }
  }

  get count() {
    return this.index.all.cardinality;
  }

  // What the shop needs to draw a product card.
  card(p) {
    const name = p.name.startsWith(p.brand + ' ') ? p.name.slice(p.brand.length + 1) : p.name;
    return {
      id: p.id, brand: p.brand, name, price: p.price, mrp: p.mrp, discount: p.discount,
      images: p.images, colors: p.colors, assured: p.assured, inStock: p.inStock,
    };
  }

  // One shop search: filter, facet counts, sort and one page of results.
  search(query, { page = 1, pageSize = 24, sort = 'relevance', trace = false } = {}) {
    const { result, steps, ms } = runQuery(this.index, query, { trace });
    const total = result.cardinality;
    const offset = (page - 1) * pageSize;

    let ids;
    if (sort === 'relevance') {
      ids = result.slice(offset, pageSize); // straight from the bitmap, in ID order
    } else {
      const all = result.toArray();
      const key = { 'price-asc': (p) => p.price, 'price-desc': (p) => -p.price, discount: (p) => -p.discount }[sort] || ((p) => p.id);
      all.sort((a, b) => key(this.products[a]) - key(this.products[b]));
      ids = all.slice(offset, offset + pageSize);
    }

    const facetStart = performance.now();
    const raw = facetCounts(this.index, query, ['cat', 'brand', 'color', 'for']);
    const facetMs = performance.now() - facetStart;

    const facets = this.shapeFacets(raw, query);
    facets.prices = this.priceBuckets(query);
    return {
      total, page, pageSize, ms, facetMs: performance.now() - facetStart,
      items: ids.map((id) => this.card(this.products[id])),
      facets,
      steps, resultStats: result.stats(),
    };
  }

  // Counts per price band, using the bit-sliced index. Like the other facets, the
  // counts ignore the price filter itself. The band bitmaps are built once and reused
  // until the catalogue changes.
  priceBuckets(query) {
    if (!this.bucketCache) {
      const bands = [[0, 499, 'Under ₹500'], [500, 999, '₹500 – ₹999'], [1000, 1999, '₹1,000 – ₹1,999'], [2000, 4999, '₹2,000 – ₹4,999'], [5000, null, '₹5,000 and above']];
      this.bucketCache = bands.map(([min, max, label]) => ({
        min, max, label,
        bitmap: this.index.price.between(min, max ?? this.index.price.maxValue),
      }));
    }
    const base = runQuery(this.index, query, { skipField: 'price' }).result;
    return this.bucketCache.map(({ min, max, label, bitmap }) => ({ min, max, label, count: base.andCardinality(bitmap) }));
  }

  // Search-bar suggestions: brands, categories and colours whose name contains the text,
  // names that START with it first, then by how many products they have.
  suggest(text, limit = 8) {
    const q = String(text || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    for (const [term, bm] of this.index.terms) {
      const colon = term.indexOf(':');
      if (colon < 0) continue;
      const field = term.slice(0, colon);
      if (field !== 'brand' && field !== 'cat' && field !== 'color') continue;
      const value = term.slice(colon + 1);
      const label = field === 'cat' ? value.split(' > ').at(-1) : value;
      const at = label.toLowerCase().indexOf(q);
      if (at < 0) continue;
      out.push({ field, value, label, path: field === 'cat' ? value : null, count: bm.cardinality, starts: at === 0 });
    }
    out.sort((a, b) => (b.starts - a.starts) || (b.count - a.count));
    return out.slice(0, limit).map(({ starts, ...rest }) => rest);
  }

  // Facets as the sidebar shows them: the next level of categories under the current
  // one, the top brands, and every colour / audience.
  shapeFacets(raw, query) {
    const selected = (query.filters && query.filters.cat && query.filters.cat[0]) || '';
    const depth = selected ? selected.split(' > ').length : 0;
    const categories = raw.cat
      .filter(({ value }) => {
        const parts = value.split(' > ');
        return parts.length === depth + 1 && (!selected || value.startsWith(selected + ' > '));
      })
      .map(({ value, count }) => ({ value, label: value.split(' > ').at(-1), count }));
    return {
      categories,
      brands: raw.brand.slice(0, 40),
      brandTotal: raw.brand.length,
      colors: raw.color,
      audiences: raw.for,
    };
  }

  product(id) {
    const p = this.products[id];
    return p ? { ...this.card(p), category: p.category, idealFor: p.idealFor, fullName: p.name } : null;
  }

  // "More like this": same deepest category AND the same colour, smallest-first like any query.
  similar(id, limit = 5) {
    const p = this.products[id];
    if (!p) return [];
    const query = { filters: { cat: [p.category.join(' > ')] }, inStock: true };
    if (p.colors.length) query.filters.color = p.colors;
    let ids = runQuery(this.index, query).result.slice(0, limit + 1).filter((x) => x !== id);
    if (ids.length < limit) {
      const wider = runQuery(this.index, { filters: { cat: [p.category.join(' > ')] }, inStock: true }).result.slice(0, limit + 1);
      for (const x of wider) if (x !== id && !ids.includes(x)) ids.push(x);
    }
    return ids.slice(0, limit).map((x) => this.card(this.products[x]));
  }

  // ---------- seller tools ----------

  normalise(input) {
    return {
      name: String(input.name || 'New product').slice(0, 120),
      brand: String(input.brand || 'RoarMart').slice(0, 40),
      category: Array.isArray(input.category) && input.category.length ? input.category.map(String) : ['Clothing'],
      price: Math.max(1, Math.round(Number(input.price) || 499)),
      mrp: Math.max(1, Math.round(Number(input.mrp) || Number(input.price) || 999)),
      colors: Array.isArray(input.colors) ? input.colors.map(String) : [],
      idealFor: Array.isArray(input.idealFor) ? input.idealFor.map(String) : [],
      assured: Boolean(input.assured),
      inStock: input.inStock !== false,
      images: Array.isArray(input.images) ? input.images : [],
    };
  }

  addProduct(input) {
    const p = this.normalise(input);
    p.mrp = Math.max(p.mrp, p.price);
    p.discount = p.mrp > p.price ? Math.round((100 * (p.mrp - p.price)) / p.mrp) : 0;
    p.id = this.nextId++;
    p.pid = 'RM' + p.id;
    this.products[p.id] = p;
    this.index.addProduct(p.id, p);
    this.bucketCache = null;
    return p.id;
  }

  // New IDs are always appended, so a bulk import gets consecutive IDs.
  bulkAdd(count, template) {
    const n = Math.max(1, Math.min(20000, Math.floor(Number(count) || 0)));
    const first = this.nextId;
    const base = this.normalise(template);
    for (let i = 0; i < n; i++) {
      const price = base.price + ((i * 37) % 500);
      this.addProduct({ ...base, name: `${base.brand} ${base.name} ${i + 1}`, price, mrp: Math.max(base.mrp, price) });
    }
    return { first, last: this.nextId - 1, count: n };
  }

  deleteProduct(id) {
    const p = this.products[id];
    if (!p) return false;
    this.index.removeProduct(id, p);
    this.products[id] = null;
    this.bucketCache = null;
    return true;
  }

  // Removes the most recently added `count` products that carry `term`.
  deleteLatest(term, count) {
    const ids = this.index.bitmap(term).toArray();
    const victims = ids.slice(Math.max(0, ids.length - Math.max(0, Math.floor(Number(count) || 0))));
    for (const id of victims) this.deleteProduct(id);
    return victims.length;
  }

  // ---------- Engine Studio views ----------

  overview() {
    const types = { array: 0, bitmap: 0, run: 0 };
    let bytes = 0;
    for (const bm of this.index.terms.values()) {
      bytes += bm.sizeInBytes();
      for (const c of bm.containers) types[c.type]++;
    }
    const chunks = this.index.all.keys.length;
    return {
      products: this.count, nextId: this.nextId, terms: this.index.terms.size,
      termBytes: bytes, priceIndexBytes: this.index.price.sizeInBytes(), priceBits: this.index.price.bits,
      containers: types, chunks, loadMs: this.loadMs,
    };
  }

  listBitmaps({ field = '', search = '', limit = 60 } = {}) {
    const out = [];
    const needle = String(search).toLowerCase();
    for (const [term, bm] of this.index.terms) {
      if (field && !term.startsWith(field + ':')) continue;
      if (needle && !term.toLowerCase().includes(needle)) continue;
      const containers = { array: 0, bitmap: 0, run: 0 };
      for (const c of bm.containers) containers[c.type]++;
      out.push({ term, cardinality: bm.cardinality, bytes: bm.sizeInBytes(), containers });
    }
    out.sort((a, b) => b.cardinality - a.cardinality);
    return { total: out.length, items: out.slice(0, Math.min(500, Number(limit) || 60)) };
  }

  bitmapDetail(term) {
    const bm = this.index.terms.get(term);
    if (!bm) return null;
    const s = bm.stats();
    return {
      term, ...s,
      compare: {
        sortedArray: 4 * s.cardinality,
        plainBitmap: Math.ceil(this.nextId / 8),
      },
    };
  }
}
