import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProductCard from './ProductCard.jsx';
import ProductImage from './ProductImage.jsx';
import BitField from '../components/BitField.jsx';
import { ArrowRight, BagIcon, CheckIcon, HeartIcon, ShieldIcon } from '../components/Icons.jsx';
import { useBag } from './BagContext.jsx';
import { api } from '../api.js';
import { count, rupees, SWATCH } from '../format.js';

export default function Product() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [shown, setShown] = useState(0);
  const { add, items, wish, toggleWish, setOpen } = useBag();

  useEffect(() => {
    setData(null); setError(null); setShown(0);
    api.product(id).then(setData).catch((e) => setError(e.message));
    window.scrollTo(0, 0);
  }, [id]);

  if (error) {
    return (
      <>
        <section className="stage pdp-stage" style={{ paddingBottom: 60 }}><BitField seed={9} /></section>
        <div className="wrap" style={{ marginTop: 40 }}>
          <div className="empty"><h2>We couldn't find that product</h2><p>It may have been removed from the catalogue.</p><Link to="/shop" className="btn btn-primary">Back to the shop</Link></div>
        </div>
      </>
    );
  }
  if (!data) return <section className="stage pdp-stage"><BitField seed={9} /><div className="wrap" style={{ minHeight: '40vh' }} /></section>;

  const p = data.product;
  const inBag = items.some((x) => x.id === p.id);
  const cat = p.category;
  const images = p.images;
  const chunk = p.id >>> 16;
  const low = p.id & 0xffff;

  return (
    <>
      <section className="stage pdp-stage">
        <BitField seed={(p.id % 97) + 1} />
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            {cat.map((c, i) => (
              <span key={i} style={{ display: 'contents' }}>
                <span className="sep">/</span><Link to={`/shop?cat=${encodeURIComponent(cat.slice(0, i + 1).join(' > '))}`}>{c}</Link>
              </span>
            ))}
            <span className="sep">/</span><span className="here">{p.brand}</span>
          </nav>
        </div>
      </section>

      <div className="wrap">
        <div className="pdp">
          <div className="gallery">
            <div className="gallery-main">
              <div className="tile" key={shown}><ProductImage images={images.slice(shown)} alt={`${p.brand} ${p.name}`} /></div>
            </div>
            {images.length > 1 && (
              <div className="thumbs">
                {images.slice(0, 6).map((src, i) => (
                  <button key={src} type="button" className={i === shown ? 'on' : ''} onClick={() => setShown(i)} aria-label={`Show photo ${i + 1}`}>
                    <div className="tile"><ProductImage images={[src]} alt="" /></div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pdp-info">
            <div>
              <div className="pdp-brand">
                <Link to={`/shop?brand=${encodeURIComponent(p.brand)}`}>{p.brand}</Link>
                {p.assured && <span className="assured"><ShieldIcon width={12} height={12} strokeWidth={2.2} />Assured</span>}
              </div>
              <h1>{p.name}</h1>
            </div>

            <div className="pdp-price">
              <div className="price-row" style={{ gap: 12, marginTop: 0, alignItems: 'center' }}>
                <span className="price">{rupees(p.price)}</span>
                {p.discount > 0 && <span className="save-pill">{p.discount}% off</span>}
              </div>
              {p.mrp > p.price && <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>MRP <s>{rupees(p.mrp)}</s> · you save {rupees(p.mrp - p.price)}</span>}
              <span className="stock" style={{ color: p.inStock ? 'var(--ok)' : 'var(--deal)' }}><i />{p.inStock ? 'In stock' : 'Out of stock'}</span>
            </div>

            {p.colors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="pdp-label">COLOUR</span>
                <div className="pdp-colors">
                  {p.colors.map((c) => (
                    <Link key={c} to={`/shop?cat=${encodeURIComponent(cat.join(' > '))}&color=${encodeURIComponent(c)}`} title={`More ${c} in ${cat.at(-1)}`}>
                      <span><i className="swatch" style={{ background: SWATCH[c] || '#D9CBB8' }} />{c}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="pdp-actions">
              <button type="button" className="btn btn-primary" disabled={!p.inStock} onClick={() => (inBag ? setOpen(true) : add(p))}>
                {inBag ? <><CheckIcon width={20} height={20} />In your bag, view</> : <><BagIcon width={20} height={20} />Add to bag</>}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => toggleWish(p.id)} aria-pressed={wish.has(p.id)}>
                <HeartIcon width={18} height={18} filled={wish.has(p.id)} style={{ color: wish.has(p.id) ? 'var(--rose)' : undefined }} />{wish.has(p.id) ? 'Saved' : 'Save'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
              <span className="pdp-label">DETAILS</span>
              <dl className="details">
                <dt>Product</dt><dd>{p.fullName}</dd>
                <dt>Category</dt><dd>{cat.join(' › ')}</dd>
                {p.idealFor && p.idealFor.length > 0 && <><dt>Ideal for</dt><dd>{p.idealFor.join(', ')}</dd></>}
                <dt>Bit address</dt><dd><span className="bit-addr">product {count(p.id)} = chunk {chunk}, bit {count(low)}</span></dd>
              </dl>
            </div>
          </div>
        </div>

        {data.similar.length > 0 && (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>More in <em>{cat.at(-1)}</em></h2>
                <p>Same category, picked from its bitmap.</p>
              </div>
              <Link to={`/shop?cat=${encodeURIComponent(cat.join(' > '))}`} className="more-link">See all <ArrowRight width={16} height={16} /></Link>
            </div>
            <div className="rail">{data.similar.map((s) => <ProductCard key={s.id} p={s} />)}</div>
          </section>
        )}
      </div>
    </>
  );
}
