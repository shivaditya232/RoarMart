import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { SearchIcon, HeartIcon, BagIcon, GridIcon, ChevronDown } from '../components/Icons.jsx';
import { useBag } from './BagContext.jsx';
import { api } from '../api.js';
import { count } from '../format.js';

const KIND = { brand: 'BRAND', cat: 'CATEGORY', color: 'COLOUR' };
const PARAM = { brand: 'brand', cat: 'cat', color: 'color' };
// The five audience shortcuts take one step of the gradient each.
export const FOR_COLORS = ['#F6A62B', '#F07F2A', '#E5482D', '#C9304F', '#A11E5B'];
export const audienceLink = (a) => (a === 'Women' || a === 'Men' ? `/shop?cat=Clothing&for=${a}` : `/shop?for=${a}`);

// Closes a popup when the user clicks anywhere outside `ref`.
export function useOutside(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [ref, open, close]);
}

// Search: as you type, the server suggests brands, categories and colours with product
// counts read from their bitmaps. Picking one opens the filtered listing.
function SearchBar() {
  const [text, setText] = useState('');
  const [list, setList] = useState([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const box = useRef(null);
  const input = useRef(null);
  useOutside(box, open, () => setOpen(false));

  useEffect(() => {
    if (text.trim().length < 2) { setList([]); return undefined; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api.suggest(text, ctrl.signal).then((d) => { setList(d.suggestions); setActive(0); }).catch(() => {});
    }, 120);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [text]);

  // "/" jumps to the search box, like many web apps.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (s) => {
    if (!s) return;
    navigate(`/shop?${PARAM[s.field]}=${encodeURIComponent(s.value)}`);
    setText(''); setList([]); setOpen(false); input.current?.blur();
  };

  return (
    <div className="search" ref={box}>
      <label className="search-box">
        <SearchIcon width={19} height={19} />
        <span className="visually-hidden">Search for brands, categories and colours</span>
        <input
          ref={input} type="search" value={text} placeholder="Search brands, categories, colours"
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); go(list[active]); }
          }}
        />
        <kbd>/</kbd>
      </label>
      {open && list.length > 0 && (
        <div className="suggest" role="listbox">
          <div className="suggest-title">JUMP TO</div>
          {list.map((s, i) => (
            <button key={s.field + s.value} type="button" role="option" aria-selected={i === active}
              className={i === active ? 'on' : ''} onMouseEnter={() => setActive(i)} onClick={() => go(s)}>
              <span className="sg-kind">{KIND[s.field]}</span>
              <span>{s.label}</span>
              {s.path && s.path.includes(' > ') && <span className="where">in {s.path.split(' > ').slice(0, -1).join(' › ')}</span>}
              <span className="n">{count(s.count)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The departments menu: every top-level category with its product count.
function DepartmentsPanel({ catalog }) {
  if (!catalog) return <div className="dept-panel" />;
  const audiences = catalog.audiences.filter((a) => ['Women', 'Men', 'Girls', 'Boys', 'Baby'].includes(a.value));
  return (
    <div className="dept-panel">
      <div>
        <div className="panel-label">DEPARTMENTS · {count(catalog.categories.length)}</div>
        <div className="dept-list">
          {catalog.categories.map((c) => (
            <Link key={c.value} to={`/shop?cat=${encodeURIComponent(c.value)}`}>{c.value}<span>{count(c.count)}</span></Link>
          ))}
        </div>
      </div>
      <div className="dept-aside">
        <div className="panel-label">SHOP FOR</div>
        {audiences.map((a, i) => (
          <Link key={a.value} to={audienceLink(a.value)} style={{ background: FOR_COLORS[i] }}>{a.value}<span>{count(a.count)}</span></Link>
        ))}
      </div>
    </div>
  );
}

export default function Header() {
  const { items, setOpen, wish } = useBag();
  const [dept, setDept] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [bump, setBump] = useState(false);
  const location = useLocation();
  const dockRef = useRef(null);
  useOutside(dockRef, dept, () => setDept(false));

  useEffect(() => { setDept(false); }, [location.pathname, location.search]);
  useEffect(() => { if (dept && !catalog) api.catalog().then(setCatalog).catch(() => {}); }, [dept, catalog]);
  useEffect(() => {
    if (!items.length) return undefined;
    setBump(true);
    const t = setTimeout(() => setBump(false), 420);
    return () => clearTimeout(t);
  }, [items.length]);

  return (
    <header className="topbar">
      <div className="wrap">
        <div className="dock" ref={dockRef}>
          <Link to="/" aria-label="RoarMart home"><Logo /></Link>
          <button type="button" className={'dept-btn' + (dept ? ' on' : '')} aria-expanded={dept} onClick={() => setDept((d) => !d)}>
            <GridIcon width={19} height={19} /><span className="label">Departments</span><ChevronDown className="chev" width={16} height={16} />
          </button>
          <SearchBar />
          <div className="dock-icons">
            <span className="icon-btn wish-btn" title="Wishlist">
              <HeartIcon />{wish.size > 0 && <span className="badge-count">{wish.size}</span>}
            </span>
            <button type="button" className={'icon-btn bag' + (bump ? ' bump' : '')} onClick={() => setOpen(true)} aria-label={`Bag, ${items.length} items`}>
              <BagIcon />{items.length > 0 && <span className="badge-count">{items.length}</span>}
            </button>
          </div>
          {dept && <DepartmentsPanel catalog={catalog} />}
        </div>
      </div>
    </header>
  );
}
