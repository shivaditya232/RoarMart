import { Router } from 'express';

// Routes the Storefront calls. Every search also sends its trace to the Engine Studio.

function cleanQuery(body) {
  const q = { filters: {} };
  const f = body.filters || {};
  for (const field of ['cat', 'brand', 'color', 'for']) {
    if (Array.isArray(f[field]) && f[field].length) q.filters[field] = f[field].map(String).slice(0, 50);
  }
  if (body.price && (body.price.min != null || body.price.max != null)) {
    q.price = {};
    if (body.price.min != null && Number.isFinite(Number(body.price.min))) q.price.min = Math.max(0, Number(body.price.min));
    if (body.price.max != null && Number.isFinite(Number(body.price.max))) q.price.max = Math.max(0, Number(body.price.max));
  }
  if (Number(body.discountMin) > 0) q.discountMin = Math.min(100, Number(body.discountMin));
  if (body.assured) q.assured = true;
  if (body.inStock) q.inStock = true;
  return q;
}

export function shopRoutes(store, io) {
  const r = Router();

  r.post('/search', (req, res) => {
    const query = cleanQuery(req.body || {});
    const page = Math.max(1, Math.floor(Number(req.body.page) || 1));
    const pageSize = Math.max(1, Math.min(60, Math.floor(Number(req.body.pageSize) || 24)));
    const sort = ['relevance', 'price-asc', 'price-desc', 'discount'].includes(req.body.sort) ? req.body.sort : 'relevance';
    const out = store.search(query, { page, pageSize, sort, trace: true });
    const { steps, resultStats, ...forShop } = out;
    res.json(forShop);
    // Then, without making the shop wait, replay the plan with the proof and send it to the Studio.
    setImmediate(() => {
      const { steps: proven, proof } = store.prove(query);
      io.emit('query', { at: Date.now(), query, total: out.total, ms: out.ms, facetMs: out.facetMs, steps: proven, proof, resultStats });
    });
  });

  r.get('/products/:id', (req, res) => {
    const p = store.product(Number(req.params.id));
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: p, similar: store.similar(p.id, 10) });
  });

  r.get('/suggest', (req, res) => {
    res.json({ suggestions: store.suggest(req.query.q) });
  });

  r.get('/catalog', (req, res) => {
    // Home page numbers: top categories, audiences, total products and brands.
    const top = store.index.values('cat').filter((v) => !v.includes(' > '))
      .map((v) => ({ value: v, count: store.index.bitmap('cat:' + v).cardinality }))
      .sort((a, b) => b.count - a.count);
    const audiences = store.index.values('for').map((v) => ({ value: v, count: store.index.bitmap('for:' + v).cardinality }))
      .sort((a, b) => b.count - a.count);
    const halfOff = store.index.discount.greaterOrEqual(50).and(store.index.all).cardinality;
    res.json({ products: store.count, brands: store.index.values('brand').length, categories: top, audiences, halfOff });
  });

  return r;
}
