import { useEffect, useRef, useState } from 'react';
import { useStudio } from './StudioContext.jsx';
import ChunkTiles from './ChunkTiles.jsx';
import { api } from '../api.js';
import { count, bytes } from '../format.js';

const CATEGORIES = [
  ["Clothing > Men's Clothing", ['Clothing', "Men's Clothing"]],
  ["Clothing > Women's Clothing", ['Clothing', "Women's Clothing"]],
  ['Footwear', ['Footwear']],
  ['Jewellery', ['Jewellery']],
  ['Watches', ['Watches']],
  ['Bags, Wallets & Belts', ['Bags, Wallets & Belts']],
];
const COLORS = ['Red', 'Black', 'Blue', 'White', 'Green', 'Pink', 'Yellow'];
const AUDIENCE = ['Men', 'Women', 'Boys', 'Girls'];

// Seller tools change the catalogue live. A "watch" panel shows the container of one
// bitmap, so the evaluator can see it switch type the moment it crosses 4,096 values.
export default function Seller() {
  const { changeTick } = useStudio();
  const [watch, setWatch] = useState('brand:RoarWear');
  const [watchInput, setWatchInput] = useState('brand:RoarWear');
  const [detail, setDetail] = useState(null);
  const [flash, setFlash] = useState(false);
  const lastType = useRef(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [bulk, setBulk] = useState({ brand: 'RoarWear', name: 'Launch Tee', cat: 0, color: 'Red', aud: 'Men', price: 399, count: 4200 });
  const [remove, setRemove] = useState(200);
  const [one, setOne] = useState({ brand: 'RoarWear', name: 'Studio Hoodie', price: 1299, cat: 0, color: 'Black' });

  const say = (text) => setLog((l) => [{ t: new Date().toLocaleTimeString(), text }, ...l].slice(0, 12));

  useEffect(() => {
    api.get(`/api/studio/bitmap?term=${encodeURIComponent(watch)}`)
      .then((d) => {
        const type = d.chunks.map((c) => c.type).join(',');
        if (lastType.current && lastType.current !== type) { setFlash(true); setTimeout(() => setFlash(false), 1300); }
        lastType.current = type;
        setDetail(d);
      })
      .catch(() => { setDetail(null); lastType.current = null; });
  }, [watch, changeTick]);

  const run = async (fn) => { setBusy(true); try { await fn(); } catch (e) { say('Error: ' + e.message); } setBusy(false); };

  const doBulk = () => run(async () => {
    const [, category] = CATEGORIES[bulk.cat];
    const sample = await api.search({ filters: { cat: [category.join(' > ')] }, pageSize: 1 });
    const images = sample.items[0] ? sample.items[0].images : [];
    const t = performance.now();
    const r = await api.post('/api/studio/bulk', {
      count: bulk.count,
      template: { name: bulk.name, brand: bulk.brand, category, colors: [bulk.color], idealFor: [bulk.aud], price: bulk.price, mrp: bulk.price * 2, images },
    });
    say(`Imported ${count(r.count)} products as IDs ${count(r.first)}–${count(r.last)} (consecutive) in ${(performance.now() - t).toFixed(0)} ms`);
    setWatch('brand:' + bulk.brand); setWatchInput('brand:' + bulk.brand);
  });

  const doRemove = () => run(async () => {
    const r = await api.post('/api/studio/delete-latest', { term: watch, count: remove });
    say(`Removed the latest ${count(r.removed)} products of ${watch}`);
  });

  const doOptimize = () => run(async () => {
    const r = await api.post('/api/studio/optimize');
    say(`runOptimize: ${count(r.runContainers)} containers are now run containers`);
  });

  const doOne = () => run(async () => {
    const [, category] = CATEGORIES[one.cat];
    const r = await api.post('/api/studio/products', { name: one.name, brand: one.brand, price: one.price, mrp: Math.round(one.price * 1.6), category, colors: [one.color] });
    say(`Added product #${r.id}: ${one.brand} ${one.name} (search "${one.brand}" in the shop)`);
  });

  const c0 = detail && detail.chunks[0];
  return (
    <>
      <div><h1 className="s-h1">Seller tools</h1><p className="s-sub">Change the catalogue live and watch the containers react.</p></div>

      <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <span className="panel-title">Container watch</span>
          <form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); setWatch(watchInput.trim()); }}>
            <label className="visually-hidden" htmlFor="watch">Bitmap to watch</label>
            <input id="watch" className="s-input mono" value={watchInput} onChange={(e) => setWatchInput(e.target.value)} style={{ width: 240 }} />
            <button className="s-btn" type="submit">Watch</button>
          </form>
        </div>
        {detail ? (
          <>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span className="mono" style={{ fontSize: 18 }}>{detail.term}</span>
              <span className="big-num">{count(detail.cardinality)}<small> IDs</small></span>
              <span className="big-num">{bytes(detail.bytes)}</span>
              {c0 && <span className={'kind ' + c0.type} style={{ fontSize: 13 }}>{c0.type.toUpperCase()}</span>}
            </div>
            <ChunkTiles chunks={detail.chunks} flash={flash} />
            <p className="note-s" style={{ margin: 0 }}>
              {c0 && c0.type === 'array' && `Array container: ${count(c0.cardinality)} values. It becomes a bitmap at 4,097.`}
              {c0 && c0.type === 'bitmap' && `Bitmap container: past 4,096 values a bitmap (8,192 B) is smaller than an array (${count(2 * c0.cardinality + 2)} B). Remove ${count(c0.cardinality - 4096)} and it turns back into an array.`}
              {c0 && c0.type === 'run' && 'Run container: the IDs are consecutive, so a few [start, length] pairs store them all.'}
            </p>
          </>
        ) : <div className="note-s">No products for <span className="mono">{watch}</span> yet. Import some below.</div>}
      </section>

      <div className="row-2">
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="panel-title">Bulk import</span>
          <div className="s-form">
            <label className="s-field">Brand<input className="s-input" value={bulk.brand} onChange={(e) => setBulk({ ...bulk, brand: e.target.value })} /></label>
            <label className="s-field">Product name<input className="s-input" value={bulk.name} onChange={(e) => setBulk({ ...bulk, name: e.target.value })} /></label>
            <label className="s-field">Category<select className="s-select" value={bulk.cat} onChange={(e) => setBulk({ ...bulk, cat: Number(e.target.value) })}>{CATEGORIES.map(([l], i) => <option key={l} value={i}>{l}</option>)}</select></label>
            <label className="s-field">Colour<select className="s-select" value={bulk.color} onChange={(e) => setBulk({ ...bulk, color: e.target.value })}>{COLORS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="s-field">Ideal for<select className="s-select" value={bulk.aud} onChange={(e) => setBulk({ ...bulk, aud: e.target.value })}>{AUDIENCE.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="s-field">Base price (₹)<input className="s-input" type="number" min="1" value={bulk.price} onChange={(e) => setBulk({ ...bulk, price: Number(e.target.value) })} /></label>
            <label className="s-field">How many<input className="s-input" type="number" min="1" max="20000" value={bulk.count} onChange={(e) => setBulk({ ...bulk, count: Number(e.target.value) })} /></label>
          </div>
          <div><button className="s-btn primary" type="button" disabled={busy} onClick={doBulk}>Import {count(bulk.count || 0)} products</button></div>
          <p className="note-s" style={{ margin: 0 }}>New products get the next free IDs, so a bulk import is always a consecutive block.</p>
        </section>

        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="panel-title">Change the watched bitmap</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="s-field">Remove latest<input className="s-input" type="number" min="1" value={remove} onChange={(e) => setRemove(Number(e.target.value))} style={{ width: 120 }} /></label>
            <button className="s-btn" type="button" disabled={busy} onClick={doRemove}>Remove from {watch}</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="s-btn" type="button" disabled={busy} onClick={doOptimize}>Compress runs (runOptimize)</button>
            <span className="note-s">Re-encodes every container in its smallest form.</span>
          </div>
          <span className="panel-title" style={{ marginTop: 6 }}>Add one product</span>
          <div className="s-form">
            <label className="s-field">Brand<input className="s-input" value={one.brand} onChange={(e) => setOne({ ...one, brand: e.target.value })} /></label>
            <label className="s-field">Name<input className="s-input" value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} /></label>
            <label className="s-field">Price (₹)<input className="s-input" type="number" min="1" value={one.price} onChange={(e) => setOne({ ...one, price: Number(e.target.value) })} /></label>
            <label className="s-field">Colour<select className="s-select" value={one.color} onChange={(e) => setOne({ ...one, color: e.target.value })}>{COLORS.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          <div><button className="s-btn" type="button" disabled={busy} onClick={doOne}>Add product</button></div>
        </section>
      </div>

      <section className="panel">
        <span className="panel-title">Activity</span>
        <div className="log" style={{ marginTop: 10 }}>
          {log.length === 0 && <span className="note-s">Try it: import 4,200 → the chunk flips from array to bitmap · remove 200 → back to array · Compress runs → one run container.</span>}
          {log.map((l, i) => <span key={i}><span style={{ color: 'var(--s-muted)' }}>{l.t}</span> &nbsp;<span className="ok">●</span> {l.text}</span>)}
        </div>
      </section>
    </>
  );
}
