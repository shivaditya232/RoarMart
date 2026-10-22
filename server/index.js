import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { Store } from './store.js';
import { shopRoutes } from './shopRoutes.js';
import { studioRoutes } from './studioRoutes.js';

// RoarMart server: one engine in memory, shared by the Storefront and the Engine Studio.

const here = dirname(fileURLToPath(import.meta.url));
const store = new Store(join(here, '..', 'data', 'products.json'));

const app = express();
const http = createServer(app);
const io = new Server(http);

app.use(express.json({ limit: '1mb' }));
app.use('/api', shopRoutes(store, io));
app.use('/api/studio', studioRoutes(store, io));

// A bad request must never crash the demo: answer with the error instead.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Bad request' });
});

// In production the built React app is served from web/dist.
const dist = join(here, '..', 'web', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res) => res.sendFile(join(dist, 'index.html')));
}

io.on('connection', (socket) => socket.emit('index-changed', { at: Date.now(), what: 'hello', overview: store.overview() }));

const PORT = Number(process.env.PORT) || 4000;
http.listen(PORT, () => {
  const o = store.overview();
  console.log(`RoarMart engine ready: ${o.products.toLocaleString()} products, ${o.terms.toLocaleString()} bitmaps, built in ${store.loadMs.toFixed(0)} ms`);
  console.log(`Server on http://localhost:${PORT}`);
});
