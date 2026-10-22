import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import { HeartIcon, ShieldIcon, PlusIcon, CheckIcon } from '../components/Icons.jsx';
import { useBag } from './BagContext.jsx';
import { rupees } from '../format.js';

export default function ProductCard({ p }) {
  const { wish, toggleWish, add, items } = useBag();
  const on = wish.has(p.id);
  const inBag = items.some((x) => x.id === p.id);
  const stop = (fn) => (e) => { e.preventDefault(); e.stopPropagation(); fn(); };

  return (
    <Link to={`/product/${p.id}`} className={'card' + (p.inStock ? '' : ' oos')}>
      <div className="tile">
        <ProductImage images={p.images} alt={`${p.brand} ${p.name}`} />
        {p.discount >= 5 && <span className="stamp">{p.discount}%<small>OFF</small></span>}
        {!p.inStock && <span className="tile-oos">OUT OF STOCK</span>}
        <button type="button" className={'wish' + (on ? ' on' : '')}
          aria-label={on ? 'Remove from wishlist' : 'Add to wishlist'} aria-pressed={on}
          onClick={stop(() => toggleWish(p.id))}>
          <HeartIcon width={17} height={17} filled={on} />
        </button>
        {p.inStock && (
          <button type="button" className={'quick' + (inBag ? ' done' : '')} onClick={stop(() => add(p))}>
            {inBag ? <><CheckIcon width={16} height={16} />In your bag</> : <><PlusIcon width={16} height={16} />Add to bag</>}
          </button>
        )}
      </div>
      <div className="card-body">
        <div className="card-brand">
          <span>{p.brand}</span>
          {p.assured && <span className="assured"><ShieldIcon width={12} height={12} strokeWidth={2.2} />Assured</span>}
        </div>
        <div className="card-name">{p.name}</div>
        <div className="price-row">
          <span className="price">{rupees(p.price)}</span>
          {p.mrp > p.price && <span className="mrp">{rupees(p.mrp)}</span>}
        </div>
      </div>
    </Link>
  );
}
