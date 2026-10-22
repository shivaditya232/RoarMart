import { useState } from 'react';
import { api } from '../api.js';
import { count } from '../format.js';

// Decimal units (1 MB = 1,000,000 bytes), so 100 million bits shows as 12.5 MB.
const bytes = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e4 ? `${(b / 1e3).toFixed(1)} KB` : `${count(b)} B`);

// The four ways of storing a set that the lab compares, with one colour each.
export const STRUCTS = [
  { key: 'roaring', name: 'Roaring bitmap', color: '#F4A62A' },
  { key: 'sorted', name: 'Sorted array', color: '#9DB2FF' },
  { key: 'plain', name: 'Plain bitmap', color: '#EF6F93' },
  { key: 'hash', name: 'Hash set', color: '#3CC2B0' },
];

const PRESETS = [
  { label: 'The 12.5 MB question', note: 'Two tiny sets in a 100-million-ID catalogue', universe: 100_000_000, sizeA: 1_000, sizeB: 3, layout: 'random' },
  { label: 'Sparse filters', note: 'Two small brands in 10 million products', universe: 10_000_000, sizeA: 10_000, sizeB: 50_000, layout: 'random' },
  { label: 'Big ∩ small', note: 'Like Women ∩ Red, at a million products', universe: 1_000_000, sizeA: 400_000, sizeB: 40_000, layout: 'random' },
  { label: 'Dense', note: 'Two huge filters', universe: 1_000_000, sizeA: 900_000, sizeB: 600_000, layout: 'random' },
  { label: 'Bulk uploads', note: 'Consecutive IDs, like sellers importing catalogues', universe: 10_000_000, sizeA: 1_000_000, sizeB: 500_000, layout: 'clustered' },
];
const UNIVERSES = [10_000, 100_000, 1_000_000, 10_000_000, 100_000_000];

export const time = (msVal) => (msVal < 0.001 ? `${(msVal * 1e6).toFixed(0)} ns` : msVal < 1 ? `${(msVal * 1000).toFixed(msVal < 0.01 ? 2 : 1)} µs` : `${msVal.toFixed(msVal < 10 ? 2 : 1)} ms`);
// Axis labels for powers of ten.
const byteTick = (v) => (v >= 1e9 ? `${v / 1e9} GB` : v >= 1e6 ? `${v / 1e6} MB` : v >= 1e3 ? `${v / 1e3} KB` : `${v} B`);
const timeTick = (v) => (v >= 1e3 ? `${v / 1e3} s` : v >= 1 ? `${v} ms` : v >= 1e-3 ? `${Math.round(v * 1e3)} µs` : `${Math.round(v * 1e6)} ns`);
const nsText = (n) => (n < 1000 ? `${n.toFixed(0)} ns` : `${(n / 1000).toFixed(1)} µs`);

// One measured quantity (memory, AND time, lookup time) as four bars. Shortest wins.
function Metric({ title, sub, rows, value, format }) {
  const max = Math.max(...rows.map(value));
  const best = Math.min(...rows.map(value));
  return (
    <div className="panel lab-metric">
      <div className="panel-title">{title}</div>
      <div className="note-s" style={{ marginTop: 2 }}>{sub}</div>
      <div className="cmp" style={{ marginTop: 14 }}>
        {rows.map((r) => {
          const s = STRUCTS.find((x) => x.key === r.key);
          const v = value(r);
          return (
            <div key={r.key} className={'cmp-row' + (v === best ? ' best' : '')}>
              <span>{s.name}{r.estimated && title === 'MEMORY' ? ' *' : ''}</span>
              <div className="cmp-bar"><span style={{ width: Math.max(0.6, (v / max) * 100) + '%', background: s.color }} /></div>
              <span className="num">{format(v)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A small log-log line chart drawn by hand in SVG.
function Chart({ title, data, pick, format, xLabel }) {
  const W = 520, H = 230, L = 64, R = 14, T = 14, B = 34;
  const xs = data.points;
  const all = STRUCTS.flatMap((s) => data.series[s.key].map(pick)).filter((v) => v > 0);
  const lo = Math.log10(Math.min(...all)), hi = Math.log10(Math.max(...all));
  const yMin = Math.floor(lo), yMax = Math.max(yMin + 1, Math.ceil(hi));
  const xMin = Math.log10(xs[0]), xMax = Math.log10(xs[xs.length - 1]);
  const X = (v) => L + ((Math.log10(v) - xMin) / (xMax - xMin)) * (W - L - R);
  const Y = (v) => T + (1 - (Math.log10(Math.max(v, 10 ** yMin)) - yMin) / (yMax - yMin)) * (H - T - B);
  const ticks = [];
  for (let e = yMin; e <= yMax; e++) ticks.push(10 ** e);
  return (
    <div className="chart">
      <div className="panel-title">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} className="grid-line" />
            <text x={L - 8} y={Y(t) + 4} textAnchor="end" className="axis">{format(t)}</text>
          </g>
        ))}
        {xs.map((x) => <text key={x} x={X(x)} y={H - 12} textAnchor="middle" className="axis">{x >= 1e6 ? `${x / 1e6}M` : x >= 1e3 ? `${Math.round(x / 1e3)}K` : x}</text>)}
        {STRUCTS.map((s) => {
          const pts = data.series[s.key].map((p) => `${X(p.x)},${Y(pick(p))}`).join(' ');
          return (
            <g key={s.key}>
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={s.key === 'roaring' ? 3 : 2} strokeLinejoin="round" opacity={s.key === 'roaring' ? 1 : 0.85} />
              {data.series[s.key].map((p) => <circle key={p.x} cx={X(p.x)} cy={Y(pick(p))} r={s.key === 'roaring' ? 3.5 : 2.5} fill={s.color} />)}
            </g>
          );
        })}
      </svg>
      <div className="note-s" style={{ textAlign: 'center' }}>{xLabel} (both axes on a log scale)</div>
    </div>
  );
}

export default function Lab() {
  const [form, setForm] = useState({ universe: 1_000_000, sizeA: 400_000, sizeB: 40_000, layout: 'random' });
  const [preset, setPreset] = useState(2);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sweepMode, setSweepMode] = useState('catalogue');
  const [sweepData, setSweepData] = useState(null);
  const [sweepBusy, setSweepBusy] = useState(false);

  const run = async (cfg = form) => {
    setBusy(true); setError(null);
    try { setResult(await api.post('/api/lab/bench', cfg)); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const pick = (i) => {
    const p = PRESETS[i];
    const cfg = { universe: p.universe, sizeA: p.sizeA, sizeB: p.sizeB, layout: p.layout };
    setPreset(i); setForm(cfg); run(cfg);
  };
  const runSweep = async (mode = sweepMode) => {
    setSweepMode(mode); setSweepBusy(true);
    try { setSweepData(await api.post('/api/lab/sweep', { mode })); } catch (e) { setError(e.message); }
    setSweepBusy(false);
  };
  const field = (k) => ({ value: form[k], onChange: (e) => { setPreset(-1); setForm({ ...form, [k]: k === 'layout' ? e.target.value : Number(e.target.value) }); } });
  const roaring = result && result.results.find((r) => r.key === 'roaring');
  const containerText = (c) => ['array', 'bitmap', 'run'].filter((t) => c[t]).map((t) => `${count(c[t])} ${t}`).join(', ') || 'empty';

  return (
    <>
      <div>
        <h1 className="s-h1">Performance lab</h1>
        <p className="s-sub">The same two sets, A and B, stored four ways. Pick the sizes; the server builds all four and measures them.</p>
      </div>

      <div className="panel">
        <div className="panel-title">SCENARIOS</div>
        <div className="presets">
          {PRESETS.map((p, i) => (
            <button key={p.label} type="button" className={'preset' + (preset === i ? ' on' : '')} onClick={() => pick(i)} disabled={busy}>
              <b>{p.label}</b><span>{p.note}</span>
            </button>
          ))}
        </div>
        <div className="s-form" style={{ marginTop: 16 }}>
          <label className="s-field">Catalogue size (IDs)
            <select className="s-select" {...field('universe')}>
              {UNIVERSES.map((u) => <option key={u} value={u}>{count(u)}</option>)}
            </select>
          </label>
          <label className="s-field">IDs in set A
            <input className="s-input" type="number" min="1" max="1000000" {...field('sizeA')} />
          </label>
          <label className="s-field">IDs in set B
            <input className="s-input" type="number" min="1" max="1000000" {...field('sizeB')} />
          </label>
          <label className="s-field">How the IDs are spread
            <select className="s-select" {...field('layout')}>
              <option value="random">Random (like filters)</option>
              <option value="clustered">Clustered (bulk uploads)</option>
            </select>
          </label>
          <div className="s-field" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="s-btn primary" onClick={() => run()} disabled={busy}>{busy ? 'Measuring…' : 'Run benchmark'}</button>
          </div>
        </div>
        {error && <p className="note-s" style={{ color: 'var(--c-bitmap)' }}>{error}</p>}
      </div>

      {!result && !busy && <div className="panel s-empty">Pick a scenario above to run the first benchmark.</div>}
      {busy && !result && <div className="panel s-empty">Building four structures and timing them…</div>}

      {result && (
        <div className={busy ? 'lab-results busy' : 'lab-results'}>
          <div className="lab-summary">
            <span><b>{count(result.sizeA)}</b> IDs in A, <b>{count(result.sizeB)}</b> in B, out of <b>{count(result.universe)}</b></span>
            <span className={'agree' + (result.agree ? ' ok' : '')}>{result.agree ? `All four structures returned the same ${count(result.intersection)} IDs for A ∩ B` : 'The structures disagree!'}</span>
          </div>
          <div className="row-3">
            <Metric title="MEMORY" sub="Bytes to store A and B" rows={result.results} value={(r) => r.bytes} format={bytes} />
            <Metric title="A ∩ B" sub="Time to intersect (median of many runs)" rows={result.results} value={(r) => r.andMs} format={time} />
            <Metric title="CONTAINS" sub="Time to check one ID (average of 20,000)" rows={result.results} value={(r) => r.containsNs} format={nsText} />
          </div>
          <div className="panel note-s">
            <b style={{ color: 'var(--s-text)' }}>Inside the Roaring bitmap:</b> A uses {containerText(roaring.containers.a)} container(s); B uses {containerText(roaring.containers.b)}.
            {' '}A plain bitmap always costs one bit per ID in the catalogue ({bytes(Math.ceil(result.universe / 8))} per set), however few IDs it holds.
            {' '}* A JavaScript Set does not report its size, so its memory is measured from heap growth: about {result.hashBytesPerId.toFixed(0)} bytes per ID.
          </div>
        </div>
      )}

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div className="panel-title">HOW THEY SCALE</div>
            <div className="note-s">{sweepMode === 'catalogue' ? 'Two sets of 1,000 IDs while the catalogue grows from 10 thousand to 100 million IDs.' : 'Both sets grow from 100 to 1,000,000 IDs in a 1,000,000-ID catalogue.'}</div>
          </div>
          <div className="s-tabs">
            <button type="button" className={'s-tab' + (sweepMode === 'catalogue' ? ' on' : '')} onClick={() => runSweep('catalogue')} disabled={sweepBusy}>Grow the catalogue</button>
            <button type="button" className={'s-tab' + (sweepMode === 'set' ? ' on' : '')} onClick={() => runSweep('set')} disabled={sweepBusy}>Grow the sets</button>
          </div>
        </div>
        <div className="legend" style={{ marginTop: 12 }}>
          {STRUCTS.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name}</span>)}
        </div>
        {!sweepData && <div className="s-empty">{sweepBusy ? 'Running the sweep (a few seconds)…' : 'Choose a sweep above.'}</div>}
        {sweepData && (
          <div className={'charts' + (sweepBusy ? ' busy' : '')}>
            <Chart title="MEMORY PER SET" data={sweepData} pick={(p) => p.bytes} format={byteTick} xLabel={sweepData.xLabel} />
            <Chart title="A ∩ B TIME" data={sweepData} pick={(p) => p.andMs} format={timeTick} xLabel={sweepData.xLabel} />
          </div>
        )}
      </div>
    </>
  );
}
