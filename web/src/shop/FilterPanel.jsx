import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, CheckIcon, CloseIcon, SearchIcon } from '../components/Icons.jsx';
import { useOutside } from './Header.jsx';
import { SWATCH, count, rupees } from '../format.js';

const SLIDER_MAX = 5000; // the right end of the slider means "no upper limit"

// One editable word in the filter sentence. Clicking it opens a small panel underneath.
function Token({ name, openName, setOpenName, label, isSet, onClear, children, width = 340 }) {
  const ref = useRef(null);
  const open = openName === name;
  const [alignRight, setAlignRight] = useState(false);
  const close = useCallback(() => setOpenName(null), [setOpenName]);
  useOutside(ref, open, close);
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setAlignRight(r.left + width > window.innerWidth - 16 && r.right - width > 16);
  }, [open, width]);

  return (
    <span className="tok" ref={ref}>
      <button type="button" className={'tok-btn' + (isSet ? ' set' : '') + (open ? ' open' : '')}
        aria-expanded={open} onClick={() => setOpenName(open ? null : name)}>
        <span>{label}</span>
        {isSet && onClear ? (
          <span className="tok-clear" role="button" tabIndex={0} aria-label={`Clear ${name}`}
            onClick={(e) => { e.stopPropagation(); onClear(); setOpenName(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onClear(); } }}>
            <CloseIcon width={14} height={14} strokeWidth={2.4} />
          </span>
        ) : <ChevronDown className="chev" width={15} height={15} />}
      </button>
      {open && <div className={'pop' + (alignRight ? ' right' : '')} style={{ width }}>{children}</div>}
    </span>
  );
}

function Check({ on }) {
  return <span className="box">{on && <CheckIcon width={14} height={14} strokeWidth={2.6} />}</span>;
}

function PriceSlider({ min, max, onCommit }) {
  const [lo, setLo] = useState(min ?? 0);
  const [hi, setHi] = useState(max ?? SLIDER_MAX);
  useEffect(() => { setLo(min ?? 0); setHi(max ?? SLIDER_MAX); }, [min, max]);
  const commit = () => onCommit(lo > 0 ? lo : null, hi < SLIDER_MAX ? hi : null);
  const pct = (v) => (v / SLIDER_MAX) * 100;
  const handlers = { onMouseUp: commit, onTouchEnd: commit, onKeyUp: commit };
  return (
    <>
      <div className="slider">
        <div className="track" />
        <div className="fill" style={{ left: pct(lo) + '%', right: 100 - pct(hi) + '%' }} />
        <input type="range" min="0" max={SLIDER_MAX} step="50" value={lo} aria-label="Minimum price"
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi - 50))} {...handlers} />
        <input type="range" min="0" max={SLIDER_MAX} step="50" value={hi} aria-label="Maximum price"
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo + 50))} {...handlers} />
      </div>
      <div className="slider-labels"><span>{rupees(lo)}</span><span>{hi >= SLIDER_MAX ? rupees(SLIDER_MAX) + '+' : rupees(hi)}</span></div>
    </>
  );
}

const list = (values, one, many) => (values.length === 0 ? null : values.length <= 2 ? values.join(', ') : `${values.length} ${many}`);
const priceLabel = (min, max) => (min == null && max == null ? null
  : min == null ? `up to ${rupees(max)}` : max == null ? `${rupees(min)} and up` : `${rupees(min)} – ${rupees(max)}`);

// The filters, written as a sentence: "Showing Clothing for Women in Red from any brand at any price".
// Every count in the panels comes from Roaring Bitmap intersections on the server,
// and each panel's counts ignore its own filter (so you can see what you could switch to).
export default function FilterSentence({ facets, state, set }) {
  const [openName, setOpenName] = useState(null);
  const [brandText, setBrandText] = useState('');
  useEffect(() => { if (openName !== 'brand') setBrandText(''); }, [openName]);
  if (!facets) return <div className="sentence" style={{ minHeight: 42 }} />;

  const cat = state.cat;
  const parent = cat && cat.includes(' > ') ? cat.split(' > ').slice(0, -1).join(' > ') : null;
  const t = { openName, setOpenName };
  const anyFilter = state.brand.length || state.color.length || state.for.length || state.min != null || state.max != null || state.assured;

  const brandPool = [...facets.brands, ...state.brand.filter((b) => !facets.brands.some((x) => x.value === b)).map((b) => ({ value: b, count: 0 }))];
  const brands = brandText ? brandPool.filter((b) => b.value.toLowerCase().includes(brandText.toLowerCase())) : brandPool;
  const maxBucket = Math.max(1, ...facets.prices.map((b) => b.count));

  return (
    <div className="sentence">
      <span className="pair"><span className="word">Showing</span>
      <Token name="category" {...t} label={cat ? cat.split(' > ').at(-1) : 'everything'} isSet={!!cat} onClear={() => set.cat(null)}>
        <div className="pop-head"><b>CATEGORY</b></div>
        <div className="pop-list">
          {cat && (
            <button type="button" className="opt back" onClick={() => set.cat(parent)}>
              <ChevronLeft width={16} height={16} /><span className="label">{parent ? parent.split(' > ').at(-1) : 'All categories'}</span>
            </button>
          )}
          {cat && <div className="opt current"><span className="label">{cat.split(' > ').at(-1)}</span></div>}
          {facets.categories.map((c) => (
            <button key={c.value} type="button" className="opt" style={cat ? { paddingLeft: 26 } : null} onClick={() => { set.cat(c.value); }}>
              <span className="label">{c.label}</span><span className="n">{count(c.count)}</span>
            </button>
          ))}
          {cat && facets.categories.length === 0 && <div className="pop-note">This is the most specific category.</div>}
        </div>
      </Token></span>

      <span className="pair"><span className="word">for</span>
      <Token name="audience" {...t} width={280} label={list(state.for, '', 'groups') || 'everyone'} isSet={state.for.length > 0}
        onClear={() => set.many('for', [])}>
        <div className="pop-head"><b>IDEAL FOR</b></div>
        <div className="pop-list">
          {facets.audiences.map((a) => {
            const on = state.for.includes(a.value);
            return (
              <button key={a.value} type="button" className={'opt' + (on ? ' on' : '') + (a.count === 0 && !on ? ' zero' : '')} onClick={() => set.toggle('for', a.value)}>
                <Check on={on} /><span className="label">{a.value}</span><span className="n">{count(a.count)}</span>
              </button>
            );
          })}
          {facets.audiences.length === 0 && <div className="pop-note">No audience information for these products.</div>}
        </div>
      </Token></span>

      <span className="pair"><span className="word">in</span>
      <Token name="colour" {...t} width={330} label={list(state.color, '', 'colours') || 'any colour'} isSet={state.color.length > 0}
        onClear={() => set.many('color', [])}>
        <div className="pop-head"><b>COLOUR</b></div>
        {facets.colors.length === 0 && <div className="pop-note">No colour information for these products.</div>}
        <div className="swatches">
          {facets.colors.slice(0, 15).map((c) => {
            const on = state.color.includes(c.value);
            return (
              <button key={c.value} type="button" className={'sw' + (on ? ' on' : '')} onClick={() => set.toggle('color', c.value)} aria-pressed={on}>
                <span className="dot" style={{ background: SWATCH[c.value] || '#D9CBB8', color: ['White', 'Cream', 'Clear', 'Beige', 'Silver', 'Yellow'].includes(c.value) ? 'var(--ink)' : '#fff' }}>
                  {on && <CheckIcon width={16} height={16} strokeWidth={2.6} />}
                </span>
                {c.value}<span className="n">{count(c.count)}</span>
              </button>
            );
          })}
        </div>
      </Token></span>

      <span className="pair"><span className="word">from</span>
      <Token name="brand" {...t} label={list(state.brand, '', 'brands') || 'any brand'} isSet={state.brand.length > 0}
        onClear={() => set.many('brand', [])}>
        <div className="pop-head"><b>BRAND</b>{state.brand.length > 0 && <button type="button" className="link-btn" onClick={() => set.many('brand', [])}>Clear</button>}</div>
        <label className="pop-search">
          <SearchIcon width={16} height={16} />
          <input autoFocus value={brandText} onChange={(e) => setBrandText(e.target.value)} placeholder={`Filter ${count(facets.brands.length)} top brands`} aria-label="Filter brands" />
        </label>
        <div className="pop-list">
          {brands.map((b) => {
            const on = state.brand.includes(b.value);
            return (
              <button key={b.value} type="button" className={'opt' + (on ? ' on' : '')} onClick={() => set.toggle('brand', b.value)}>
                <Check on={on} /><span className="label">{b.value}</span><span className="n">{count(b.count)}</span>
              </button>
            );
          })}
          {brands.length === 0 && <div className="pop-note">No brand among these matches "{brandText}". Try the search bar at the top.</div>}
        </div>
        <div className="pop-note">{count(facets.brandTotal)} brands sell products matching your other filters. The biggest {count(facets.brands.length)} are listed.</div>
      </Token></span>

      <span className="pair"><span className="word">at</span>
      <Token name="price" {...t} width={360} label={priceLabel(state.min, state.max) || 'any price'} isSet={state.min != null || state.max != null}
        onClear={() => set.price(null, null)}>
        <div className="pop-head"><b>PRICE</b></div>
        <div className="histo">
          {facets.prices.map((b) => {
            const on = state.min === (b.min || null) && state.max === b.max;
            return (
              <button key={b.label} type="button" className={'hbar' + (on ? ' on' : '')} title={b.label}
                onClick={() => (on ? set.price(null, null) : set.price(b.min || null, b.max))} aria-pressed={on}>
                <span className="n">{count(b.count)}</span>
                <i style={{ height: `${Math.max(4, (b.count / maxBucket) * 76)}%` }} />
              </button>
            );
          })}
        </div>
        <div className="histo-labels">
          {facets.prices.map((b) => <span key={b.label}>{b.max == null ? `${rupees(b.min)}+` : b.min === 0 ? `< ${rupees(b.max + 1)}` : `${rupees(b.min)}–${count(b.max)}`}</span>)}
        </div>
        <PriceSlider min={state.min} max={state.max} onCommit={set.price} />
      </Token></span>

      <button type="button" className={'switch' + (state.inStock ? ' on' : '')} aria-pressed={state.inStock} onClick={() => set.flag('instock', !state.inStock)}>
        <span className="box">{state.inStock && <CheckIcon width={14} height={14} strokeWidth={2.6} />}</span>In stock
      </button>
      <button type="button" className={'switch' + (state.assured ? ' on' : '')} aria-pressed={state.assured} onClick={() => set.flag('assured', !state.assured)}>
        <span className="box">{state.assured && <CheckIcon width={14} height={14} strokeWidth={2.6} />}</span>Assured
      </button>
      {anyFilter ? <button type="button" className="clear-all" onClick={set.clearAll}>Clear all</button> : null}
    </div>
  );
}
