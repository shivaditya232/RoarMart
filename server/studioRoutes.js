import { Router } from 'express';

// Routes the Engine Studio calls: what the engine looks like inside, and the seller tools.
// Any change to the catalogue tells every connected app with an 'index-changed' event.

export function studioRoutes(store, io) {
  const r = Router();
  const changed = (what) => io.emit('index-changed', { at: Date.now(), what, overview: store.overview() });

  r.get('/overview', (req, res) => res.json(store.overview()));

  r.get('/bitmaps', (req, res) => {
    res.json(store.listBitmaps({ field: req.query.field || '', search: req.query.search || '', limit: req.query.limit }));
  });

  r.get('/bitmap', (req, res) => {
    const d = store.bitmapDetail(String(req.query.term || ''));
    if (!d) return res.status(404).json({ error: 'No such bitmap' });
    res.json(d);
  });

  r.post('/products', (req, res) => {
    const id = store.addProduct(req.body || {});
    changed('add');
    res.json({ id });
  });

  r.post('/bulk', (req, res) => {
    const out = store.bulkAdd(req.body.count, req.body.template || {});
    changed('bulk');
    res.json(out);
  });

  r.delete('/products/:id', (req, res) => {
    const ok = store.deleteProduct(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Product not found' });
    changed('delete');
    res.json({ ok });
  });

  r.post('/delete-latest', (req, res) => {
    const removed = store.deleteLatest(String(req.body.term || ''), req.body.count);
    changed('delete');
    res.json({ removed });
  });

  r.post('/optimize', (req, res) => {
    const runs = store.index.runOptimizeAll();
    changed('optimize');
    res.json({ runContainers: runs });
  });

  return r;
}
