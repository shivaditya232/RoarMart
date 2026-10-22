import { Router } from 'express';
import { verify } from '../engine/index.js';
import { benchmark, sweep, LIMITS } from './bench.js';
import { ScratchConsole } from './console.js';

// Routes for the Studio's lab pages: the performance lab, the bitmap console and the
// stress test. None of them change the shop's catalogue.

export function labRoutes(store) {
  const r = Router();
  const scratch = new ScratchConsole(store.index);

  r.get('/limits', (req, res) => res.json(LIMITS));

  r.post('/bench', (req, res) => {
    const b = req.body || {};
    const layout = b.layout === 'clustered' ? 'clustered' : 'random';
    res.json(benchmark({ universe: Number(b.universe), sizeA: Number(b.sizeA), sizeB: Number(b.sizeB), layout, seed: Number(b.seed) || 7 }));
  });

  r.post('/sweep', (req, res) => {
    const b = req.body || {};
    res.json(sweep({ mode: b.mode === 'catalogue' ? 'catalogue' : 'set', layout: b.layout === 'clustered' ? 'clustered' : 'random' }));
  });

  r.post('/console', (req, res) => {
    const line = String((req.body && req.body.line) || '').slice(0, 300);
    const out = scratch.run(line);
    res.json({ ...out, state: scratch.state() });
  });

  r.get('/console', (req, res) => res.json({ lines: [], state: scratch.state() }));

  // One batch of the stress test. The Studio calls this repeatedly with new seeds and
  // adds the results up, so the server never blocks for long and progress is visible.
  r.post('/verify', (req, res) => {
    const operations = Math.max(100, Math.min(5000, Math.floor(Number(req.body && req.body.operations) || 1000)));
    const seed = Math.floor(Number(req.body && req.body.seed) || 1);
    const t = performance.now();
    const out = verify({ operations, seed });
    res.json({ ...out, seed, ms: performance.now() - t });
  });

  return r;
}
