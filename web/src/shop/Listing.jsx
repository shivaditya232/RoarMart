import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ProductCard from './ProductCard.jsx';
import FilterSentence from './FilterPanel.jsx';
import BitField from '../components/BitField.jsx';
import { BoltIcon } from '../components/Icons.jsx';
import { api } from '../api.js';
import { count, ms } from '../format.js';

const PAGE_SIZE = 24;
const SORTS = [['relevance', 'Relevance'], ['price-asc', 'Price: low'], ['price-desc', 'Price: high'], ['discount', 'Discount']];

// Reads the filters from the URL, so every filtered page has its own link and the
// browser's back button works.
function readState(params) {
  const num = (k) => (params.get(k) != null && params.get(k) !== '' && Number.isFinite(Number(params.get(k))) ? Number(params.get(k)) : null);
  return {
    cat: params.get('cat') || null,
    brand: params.getAll('brand'),
    color: params.getAll('color'),
    for: params.getAll('for'),
    min: num('min'),
    max: num('max'),
    assured: params.get('assured') === '1',
    inStock: params.get('instock') !== '0',
    sort: params.get('sort') || 'relevance',
    page: Math.max(1, num('page') || 1),
  };
}

function pageList(page, pages) {
  const out = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p);
    else if (out.at(-1) !== '…') out.push('…');
  }
  return out;
}

export default function Listing() {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => readState(params), [params]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    const body = {
      filters: { cat: state.cat ? [state.cat] : [], brand: state.brand, color: state.color, for: state.for },
      price: state.min != null || state.max != null ? { min: state.min, max: state.max } : null,
      assured: state.assured, inStock: state.inStock, sort: state.sort, page: state.page, pageSize: PAGE_SIZE,
    };
    api.search(body, ctrl.signal)
      .then((d) => { setData(d); setError(null); setLoading(false); })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false); } });
    return () => ctrl.abort();
  }, [state]);

  // URL updates. Any filter change goes back to page 1.
  const change = (fn, keepPage = false) => {
    const next = new URLSearchParams(params);
    fn(next);
    if (!keepPage) next.delete('page');
    setParams(next);
  };
  const set = {
    cat: (v) => change((p) => (v ? p.set('cat', v) : p.delete('cat'))),
    toggle: (key, value) => change((p) => {
      const list = p.getAll(key);
      p.delete(key);
      (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]).forEach((x) => p.append(key, x));
    }),
    many: (key, values) => change((p) => { p.delete(key); values.forEach((x) => p.append(key, x)); }),
    price: (min, max) => change((p) => {
      if (min != null) p.set('min', min); else p.delete('min');
      if (max != null) p.set('max', max); else p.delete('max');
    }),
    flag: (key, on) => change((p) => {
      if (key === 'instock') { if (on) p.delete('instock'); else p.set('instock', '0'); }
      else if (on) p.set(key, '1'); else p.delete(key);
    }),
    sort: (v) => change((p) => (v === 'relevance' ? p.delete('sort') : p.set('sort', v))),
    clearAll: () => setParams(state.cat ? { cat: state.cat } : {}),
    page: (n) => { change((p) => p.set('page', n), true); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  };

  const title = state.cat ? state.cat.split(' > ').at(-1) : null;
  const prefix = state.for.length === 1 && state.cat && !state.cat.includes(' > ') ? `${state.for[0]}'s` : null;
  const crumbs = state.cat ? state.cat.split(' > ') : [];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const sub = data ? data.facets.categories : [];

  return (
    <>
      <section className="stage list-stage">
        <BitField seed={state.cat ? state.cat.length : 5} density={0.11} />
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span className="sep">/</span>
            {crumbs.length === 0 ? <span className="here">Shop</span> : <Link to="/shop">Shop</Link>}
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'contents' }}>
                <span className="sep">/</span>
                {i === crumbs.length - 1 ? <span className="here">{c}</span>
                  : <Link to={`/shop?cat=${encodeURIComponent(crumbs.slice(0, i + 1).join(' > '))}`}>{c}</Link>}
              </span>
            ))}
          </nav>
          <div className="list-title">
            <h1>{title ? (prefix ? <>{prefix} <em>{title}</em></> : title) : <>All <em>products</em></>}</h1>
            {data && <span className="total-pill">{count(data.total)} items</span>}
          </div>
          <FilterSentence facets={data && data.facets} state={state} set={set} />
        </div>
      </section>

      <div className="wrap">
        {sub.length > 0 && (
          <div className="refine" aria-label="Narrow down">
            <span className="refine-label">NARROW DOWN</span>
            {sub.slice(0, 16).map((c) => (
              <button key={c.value} type="button" onClick={() => set.cat(c.value)}>{c.label}<span>{count(c.count)}</span></button>
            ))}
          </div>
        )}

        <div className="toolbar">
          <div className="engine-pill">
            {data && <>
              <span><b>{count(data.total)}</b> {data.total === 1 ? 'product' : 'products'}</span>
              <span className="ms" title="Time the Roaring Bitmap engine took to find the matching products"><BoltIcon width={13} height={13} strokeWidth={2.2} />matched in {ms(data.ms)}</span>
            </>}
          </div>
          <div className="seg" role="group" aria-label="Sort">
            {SORTS.map(([v, label]) => (
              <button key={v} type="button" className={state.sort === v ? 'on' : ''} aria-pressed={state.sort === v} onClick={() => set.sort(v)}>{label}</button>
            ))}
          </div>
        </div>

        <section className={'results' + (loading ? ' loading' : '')} aria-label="Products">
          {error && <div className="empty"><h2>Something went wrong</h2><p>{error}</p></div>}
          {data && data.total === 0 && (
            <div className="empty">
              <h2>Nothing matches all of that</h2>
              <p>The bitmaps for these filters have no product in common. Try removing one.</p>
              <button type="button" className="btn btn-primary" onClick={set.clearAll}>Clear filters</button>
            </div>
          )}
          {data && data.total > 0 && (
            <div className="grid" key={`${data.total}-${state.page}-${data.items[0] && data.items[0].id}`}>{data.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          )}

          {data && pages > 1 && (
            <nav className="pager" aria-label="Pages">
              <button type="button" disabled={state.page <= 1} onClick={() => set.page(state.page - 1)}>Previous</button>
              {pageList(state.page, pages).map((p, i) => (p === '…' ? <span key={'g' + i} className="gap">…</span> : (
                <button key={p} type="button" className={p === state.page ? 'on' : ''} aria-current={p === state.page ? 'page' : undefined} onClick={() => set.page(p)}>{p}</button>
              )))}
              <button type="button" disabled={state.page >= pages} onClick={() => set.page(state.page + 1)}>Next</button>
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
