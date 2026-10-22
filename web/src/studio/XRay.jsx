import { useEffect, useState } from 'react';
import { useStudio } from './StudioContext.jsx';
import ChunkTiles from './ChunkTiles.jsx';
import { METHOD, kindOf, ago, queryChips } from './labels.js';
import { api } from '../api.js';
import { count, ms, bytes } from '../format.js';

// Which stored bitmap a plan step used (multi-value steps like "color:Red|Blue" are unions
// built on the fly, so they have no single stored bitmap to show).
function termOf(step) {
  if (step.op === 'andNot') return 'oos';
  if (step.kind !== 'term' || step.label.includes('|')) return null;
  return step.label;
}

function methodText(step) {
  if (step.op === 'start') return 'Start with the smallest set';
  if (step.op === 'andNot') return 'Subtract the small out-of-stock set (ANDNOT)';
  const names = [...new Set((step.chunks || []).map((c) => METHOD[c.method] || c.method))];
  const comparisons = (step.chunks || []).reduce((s, c) => s + (c.comparisons || 0), 0);
  if (names.length === 0) return 'No shared chunks: skipped';
  return `${names.join(' + ')} · ${count(comparisons)} steps`;
}

export default function XRay() {
  const { feed, now } = useStudio();
  const last = feed[0];
  const [details, setDetails] = useState([]);

  useEffect(() => {
    if (!last) return;
    const terms = [...new Set(last.steps.map(termOf).filter(Boolean))];
    Promise.all(terms.map((t) => api.get(`/api/studio/bitmap?term=${encodeURIComponent(t)}`).catch(() => null)))
      .then((list) => setDetails(list.filter(Boolean)));
  }, [last]);

  if (!last) {
    return (
      <>
        <div><h1 className="s-h1">Live X-ray</h1><p className="s-sub">Every Storefront search, exactly as the engine ran it.</p></div>
        <div className="panel s-empty">Waiting for the Storefront… click any filter in the shop and its query plan appears here instantly.</div>
      </>
    );
  }

  const first = last.steps[0];
  const chips = queryChips(last.query);
  return (
    <>
      <div><h1 className="s-h1">Live X-ray</h1><p className="s-sub">Every Storefront search, exactly as the engine ran it.</p></div>

      <section className="panel" aria-label="Last query">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="panel-title">Last query from Storefront · {ago(last.at, now)}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {chips.length === 0 && <span className="qchip">all products</span>}
              {chips.map((c, i) => <span key={c} style={{ display: 'contents' }}>{i > 0 && <span className="qand">AND</span>}<span className="qchip">{c}</span></span>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            <div><div className="note-s">Results</div><div className="big-num">{count(last.total)}</div></div>
            <div><div className="note-s">Engine time</div><div className="big-num">{ms(last.ms).replace(' ms', '')}<small> ms</small></div></div>
          </div>
        </div>

        {last.steps.length > 0 ? (
          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table className="steps">
              <thead><tr><th>Step</th><th>Bitmap</th><th>Container</th><th>Method chosen</th><th style={{ textAlign: 'right' }}>IDs left</th></tr></thead>
              <tbody>
                {last.steps.map((s, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ color: 'var(--s-muted)' }}>{i + 1}</td>
                    <td><span className="mono">{s.op === 'and' ? '∩ ' : s.op === 'andNot' ? '− ' : ''}{s.label}</span>
                      <span className="sub">{s.kind === 'range' ? `${s.slices} bit slices · ${count(s.size)} IDs in range` : `${count(s.size)} IDs · ${bytes(s.bytes)}`}</span></td>
                    <td>{s.kind === 'range' ? <span className="kind bsi">BIT-SLICED</span> : <span className={'kind ' + kindOf(s.containers)}>{kindOf(s.containers).toUpperCase()}</span>}</td>
                    <td style={{ color: 'var(--s-soft)' }}>{methodText(s)}</td>
                    <td className="num"><b>{count(s.left)}</b>
                      <div className="bar"><span style={{ width: Math.max(2, (s.left / Math.max(1, first.left)) * 100) + '%' }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {last.steps.length > 1 && (
              <p className="note-s" style={{ margin: '10px 0 0' }}>
                The planner put <span className="mono">{first.label}</span> ({count(first.size)} IDs) first, so every later step works on at most {count(first.size)} IDs.
              </p>
            )}
          </div>
        ) : <p className="note-s" style={{ marginTop: 14 }}>No filters: the result is the whole catalogue bitmap.</p>}
      </section>

      <div className="row-2">
        <section className="panel" aria-label="Containers" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span className="panel-title">Containers per chunk</span>
            <span className="legend"><span><i style={{ background: 'var(--c-array)' }} />Array</span><span><i style={{ background: 'var(--c-bitmap)' }} />Bitmap</span><span><i style={{ background: 'var(--c-run)' }} />Run</span></span>
          </div>
          {details.map((d) => (
            <div className="chunkrow" key={d.term}>
              <div className="name mono" style={{ fontSize: 13 }}>{d.term === 'oos' ? 'out-of-stock' : d.term}<span>{count(d.cardinality)} values</span></div>
              <ChunkTiles chunks={d.chunks} />
            </div>
          ))}
          <div className="chunkrow">
            <div className="name mono" style={{ fontSize: 13 }}>result<span>{count(last.resultStats.cardinality)} values</span></div>
            <ChunkTiles chunks={last.resultStats.chunks} />
          </div>
          <p className="note-s" style={{ margin: 0 }}>A chunk is an array up to 4,096 values and a bitmap above that, where both cost 8 KB. Fill shows how full each 65,536-ID chunk is.</p>
        </section>

        <section className="panel" aria-label="Memory" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="panel-title">Memory · same sets, three ways</span>
          <div style={{ overflowX: 'auto' }}>
            <table className="s-table">
              <thead><tr><th>Bitmap</th><th className="num">Roaring</th><th className="num">Sorted int array</th><th className="num">Plain bitmap</th></tr></thead>
              <tbody>
                {details.map((d) => (
                  <tr key={d.term}>
                    <td className="mono">{d.term === 'oos' ? 'out-of-stock' : d.term}</td>
                    <td className="num" style={{ color: d.bytes <= Math.min(d.compare.sortedArray, d.compare.plainBitmap) ? 'var(--c-run)' : 'var(--s-text)', fontWeight: 600 }}>{bytes(d.bytes)}</td>
                    <td className="num">{bytes(d.compare.sortedArray)}</td>
                    <td className="num">{bytes(d.compare.plainBitmap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note-s" style={{ margin: 0 }}>Green = smallest. With under 65,536 products a plain bitmap is small too; the Performance lab shows how this changes at a million.</p>
        </section>
      </div>

      <section className="panel" aria-label="Live feed">
        <span className="panel-title">Live feed</span>
        <div style={{ marginTop: 8 }}>
          {feed.slice(0, 8).map((q, i) => (
            <div className="feed-row" key={q.at + '-' + i}>
              <span className="when">{ago(q.at, now)}</span>
              <span className="q">{queryChips(q.query).join(' ∩ ') || 'all products'}</span>
              <span className="mono" style={{ color: 'var(--s-soft)' }}>{count(q.total)} results · {ms(q.ms)}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
