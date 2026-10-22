import { useEffect, useState } from 'react';
import { useStudio } from './StudioContext.jsx';
import ChunkTiles from './ChunkTiles.jsx';
import { kindOf, COLOR } from './labels.js';
import { api } from '../api.js';
import { count, bytes } from '../format.js';

const FIELDS = [['', 'All'], ['cat', 'Category'], ['brand', 'Brand'], ['color', 'Colour'], ['for', 'Ideal for']];

function why(c) {
  if (c.type === 'array') return `${count(c.cardinality)} values ≤ 4,096 → array: 2 bytes each = ${count(c.bytes)} B`;
  if (c.type === 'bitmap') return `${count(c.cardinality)} values > 4,096 → bitmap: always 8,192 B`;
  return `consecutive IDs → run container: ${count((c.bytes - 2) / 4)} run(s) = ${count(c.bytes)} B`;
}

export default function Bitmaps() {
  const { changeTick } = useStudio();
  const [overview, setOverview] = useState(null);
  const [field, setField] = useState('');
  const [search, setSearch] = useState('');
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState('cat:Clothing');
  const [detail, setDetail] = useState(null);

  useEffect(() => { api.get('/api/studio/overview').then(setOverview).catch(() => {}); }, [changeTick]);
  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/api/studio/bitmaps?field=${field}&search=${encodeURIComponent(search)}&limit=120`).then(setList).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [field, search, changeTick]);
  useEffect(() => {
    if (!selected) return;
    api.get(`/api/studio/bitmap?term=${encodeURIComponent(selected)}`).then(setDetail).catch(() => setDetail(null));
  }, [selected, changeTick]);

  const max = detail ? Math.max(detail.bytes, detail.compare.sortedArray, detail.compare.plainBitmap) : 1;

  return (
    <>
      <div><h1 className="s-h1">Bitmap explorer</h1><p className="s-sub">Every filter value is its own Roaring Bitmap. Pick one to see how it is stored.</p></div>

      {overview && (
        <div className="cards">
          <div className="stat"><div className="k">Products</div><div className="v">{count(overview.products)}</div></div>
          <div className="stat"><div className="k">Bitmaps</div><div className="v">{count(overview.terms)}</div></div>
          <div className="stat"><div className="k">Containers</div><div className="v" style={{ fontSize: 15, lineHeight: '26px' }}>
            <span style={{ color: COLOR.array }}>{count(overview.containers.array)} array</span> · <span style={{ color: COLOR.bitmap }}>{count(overview.containers.bitmap)} bitmap</span> · <span style={{ color: COLOR.run }}>{count(overview.containers.run)} run</span></div></div>
          <div className="stat"><div className="k">All bitmaps together</div><div className="v">{bytes(overview.termBytes)}</div></div>
          <div className="stat"><div className="k">Price index ({overview.priceBits} slices)</div><div className="v">{bytes(overview.priceIndexBytes)}</div></div>
        </div>
      )}

      <div className="row-2">
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="s-tabs">
            {FIELDS.map(([f, label]) => <button key={f} type="button" className={'s-tab' + (field === f ? ' on' : '')} onClick={() => setField(f)}>{label}</button>)}
          </div>
          <label className="s-field"><span className="visually-hidden">Search bitmaps</span>
            <input className="s-input" placeholder="Search, e.g. Red, Voylla, Watches" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <div className="note-s">{list ? `${count(list.total)} bitmaps, largest first` : 'Loading…'}</div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table className="s-table">
              <thead><tr><th>Bitmap</th><th>Type</th><th className="num">IDs</th><th className="num">Bytes</th></tr></thead>
              <tbody>
                {list && list.items.map((b) => (
                  <tr key={b.term} className={'click' + (b.term === selected ? ' sel' : '')} onClick={() => setSelected(b.term)}>
                    <td className="mono" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.term}</td>
                    <td><span className={'kind ' + kindOf(b.containers)}>{kindOf(b.containers).toUpperCase()}</span></td>
                    <td className="num">{count(b.cardinality)}</td>
                    <td className="num">{bytes(b.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {detail ? (
            <>
              <div>
                <span className="panel-title">Selected bitmap</span>
                <div className="mono" style={{ fontSize: 18, marginTop: 6 }}>{detail.term}</div>
                <div className="note-s">{count(detail.cardinality)} product IDs in {detail.chunks.length} chunk{detail.chunks.length === 1 ? '' : 's'}</div>
              </div>
              <ChunkTiles chunks={detail.chunks} />
              <div className="log">
                {detail.chunks.map((c) => <span key={c.key}>chunk {c.key}: {why(c)}</span>)}
              </div>
              <div className="cmp">
                <span className="panel-title">Memory compared</span>
                {[['Roaring', detail.bytes, 'var(--c-run)'], ['Sorted int array', detail.compare.sortedArray, 'var(--s-muted)'], ['Plain bitmap', detail.compare.plainBitmap, 'var(--s-muted)']].map(([name, b, c]) => (
                  <div className="cmp-row" key={name}>
                    <span>{name}</span>
                    <div className="cmp-bar"><span style={{ width: Math.max(1, (b / max) * 100) + '%', background: c }} /></div>
                    <span className="num">{bytes(b)}</span>
                  </div>
                ))}
                <p className="note-s" style={{ margin: 0 }}>Sorted array = 4 bytes per ID. Plain bitmap = 1 bit for every product ID that exists, however few are in the set.</p>
              </div>
            </>
          ) : <div className="s-empty">Pick a bitmap on the left.</div>}
        </section>
      </div>
    </>
  );
}
