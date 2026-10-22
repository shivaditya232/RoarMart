import { useRef, useState } from 'react';
import { api } from '../api.js';
import { count } from '../format.js';

const BATCH = 1000;
const TOTALS = [10_000, 50_000, 100_000];
const OPS = ['add', 'remove', 'contains', 'addRange', 'and', 'or', 'andNot', 'runOptimize'];
const CHECKS = [
  'Random IDs in sparse chunks (array containers)',
  'More than 4,096 IDs in one chunk (bitmap containers)',
  'Long consecutive ranges (run containers, and conversions between all three)',
  'Edge IDs: 0, 65,535 / 65,536 (a chunk boundary) and 4,294,967,295 (the largest 32-bit ID)',
  'Every answer compared with a plain JavaScript Set doing the same thing the slow, obvious way',
];

// Stress test: thousands of random operations on Roaring bitmaps, each checked against
// a brute-force JavaScript Set. The work is sent in batches of 1,000 so the server stays
// responsive and the progress is visible.
export default function Stress() {
  const [total, setTotal] = useState(10_000);
  const [seed, setSeed] = useState(2026);
  const [run, setRun] = useState(null);
  const stopRef = useRef(false);

  const start = async () => {
    stopRef.current = false;
    const acc = { done: 0, total, mismatches: 0, counts: Object.fromEntries(OPS.map((o) => [o, 0])), types: new Set(), failures: [], ms: 0, batches: [], running: true, started: performance.now() };
    setRun({ ...acc, types: [] });
    for (let b = 0; b * BATCH < total; b++) {
      if (stopRef.current) break;
      try {
        const r = await api.post('/api/lab/verify', { operations: BATCH, seed: seed + b });
        acc.done += r.operations; acc.mismatches += r.mismatches; acc.ms += r.ms;
        for (const o of OPS) acc.counts[o] += r.counts[o] || 0;
        r.containerTypesSeen.forEach((t) => acc.types.add(t));
        acc.failures.push(...r.failures.map((f) => ({ ...f, seed: r.seed })));
        acc.batches = [{ n: b + 1, seed: r.seed, ms: r.ms, mismatches: r.mismatches }, ...acc.batches].slice(0, 6);
      } catch (e) {
        acc.error = e.message; break;
      }
      setRun({ ...acc, types: [...acc.types].sort() });
    }
    acc.running = false; acc.wall = performance.now() - acc.started;
    setRun({ ...acc, types: [...acc.types].sort() });
  };

  const pct = run ? Math.round((run.done / run.total) * 100) : 0;
  const passed = run && !run.running && !run.error && run.mismatches === 0 && run.done === run.total;

  return (
    <>
      <div>
        <h1 className="s-h1">Stress test</h1>
        <p className="s-sub">Random operations on Roaring bitmaps, each checked against a brute-force JavaScript Set. Any difference is a bug.</p>
      </div>

      <div className="row-2">
        <div className="panel">
          <div className="panel-title">RUN</div>
          <div className="s-form" style={{ marginTop: 12 }}>
            <label className="s-field">Operations
              <select className="s-select" value={total} onChange={(e) => setTotal(Number(e.target.value))} disabled={run && run.running}>
                {TOTALS.map((t) => <option key={t} value={t}>{count(t)}</option>)}
              </select>
            </label>
            <label className="s-field">Random seed
              <input className="s-input" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 1)} disabled={run && run.running} />
            </label>
            <div className="s-field" style={{ justifyContent: 'flex-end' }}>
              {run && run.running
                ? <button type="button" className="s-btn" onClick={() => { stopRef.current = true; }}>Stop</button>
                : <button type="button" className="s-btn primary" onClick={start}>Start stress test</button>}
            </div>
          </div>
          <p className="note-s" style={{ marginTop: 14 }}>The same seed always produces the same operations, so any failure can be replayed exactly.</p>
        </div>
        <div className="panel">
          <div className="panel-title">WHAT IT EXERCISES</div>
          <ul className="checks">{CHECKS.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      </div>

      {run && (
        <div className="panel">
          <div className="stress-top">
            <div>
              <div className="panel-title">{run.running ? 'RUNNING' : passed ? 'PASSED' : run.error ? 'STOPPED BY AN ERROR' : run.mismatches ? 'FAILED' : 'STOPPED'}</div>
              <div className="big-num">{count(run.done)} <small>of {count(run.total)} operations</small></div>
            </div>
            <div className={'verdict' + (run.mismatches ? ' bad' : ' good')}>
              <span className="big-num">{count(run.mismatches)}</span>
              <span>mismatch{run.mismatches === 1 ? '' : 'es'}</span>
            </div>
          </div>
          <div className="progress"><span style={{ width: pct + '%' }} /></div>
          <div className="note-s" style={{ marginTop: 8 }}>
            {count(Math.round(run.done / Math.max(run.ms / 1000, 0.001)))} checked operations per second on the server
            {run.types.length > 0 && <> · container types seen: {run.types.map((t) => <span key={t} className={'kind ' + t} style={{ marginLeft: 6 }}>{t}</span>)}</>}
          </div>
          {run.error && <p className="note-s" style={{ color: 'var(--c-bitmap)' }}>{run.error}</p>}

          <div className="row-2" style={{ marginTop: 18 }}>
            <table className="s-table" style={{ flex: '1 1 300px' }}>
              <thead><tr><th>Operation</th><th className="num">Times run</th></tr></thead>
              <tbody>{OPS.map((o) => <tr key={o}><td className="mono">{o}</td><td className="num">{count(run.counts[o])}</td></tr>)}</tbody>
            </table>
            <div style={{ flex: '1 1 300px' }}>
              <div className="panel-title" style={{ marginBottom: 8 }}>LATEST BATCHES</div>
              <div className="log">
                {run.batches.map((b) => (
                  <span key={b.n}>batch {b.n} · seed {b.seed} · {count(BATCH)} ops · {b.ms.toFixed(0)} ms · <span className={b.mismatches ? '' : 'ok'}>{b.mismatches ? `${b.mismatches} mismatches` : 'all correct'}</span></span>
                ))}
              </div>
              {run.failures.length > 0 && (
                <div className="log" style={{ marginTop: 12, color: 'var(--c-bitmap)' }}>
                  {run.failures.slice(0, 5).map((f, i) => <span key={i}>failed: {f.name} at operation {f.op} (seed {f.seed})</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
