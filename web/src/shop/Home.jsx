import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard.jsx';
import ProductImage from './ProductImage.jsx';
import BitField from '../components/BitField.jsx';
import { ArrowRight } from '../components/Icons.jsx';
import { FOR_COLORS, audienceLink } from './Header.jsx';
import { api } from '../api.js';
import { count } from '../format.js';

const catLink = (v) => `/shop?cat=${encodeURIComponent(v)}`;

// The hero picture: products laid out like the bits of a bitmap. Photos are bits that
// are set, solid squares are set bits, outlines are empty bits.
const MOSAIC = [
  ['off', 1, 1], ['photo-big', 2, 1], ['photo', 4, 1], ['on', 5, 1],
  ['photo', 1, 2], ['soft', 4, 2], ['photo', 5, 2],
  ['on', 1, 3], ['photo', 2, 3], ['off', 3, 3], ['photo', 4, 3], ['off', 5, 3],
  ['soft', 1, 4], ['on', 2, 4], ['photo', 3, 4], ['soft', 4, 4], ['photo', 5, 4],
];
const MOSAIC_PICKS = [
  { cat: ['Clothing'], for: ['Women'] }, { cat: ['Jewellery'] }, { cat: ['Footwear'] }, { cat: ['Watches'] },
  { cat: ['Sunglasses'] }, { cat: ['Home Decor & Festive Needs'] }, { cat: ['Bags, Wallets & Belts'] }, { cat: ['Clothing'], for: ['Men'] },
];

function Mosaic({ photos, total }) {
  let next = 0;
  return (
    <div className="mosaic-wrap">
      <div className="mosaic" aria-hidden="true">
        {MOSAIC.map(([kind, c, r], i) => {
          const style = { gridColumn: kind === 'photo-big' ? `${c} / span 2` : c, gridRow: kind === 'photo-big' ? `${r} / span 2` : r, animationDelay: `${0.05 + i * 0.035}s` };
          if (kind.startsWith('photo')) {
            const p = photos[next++];
            return (
              <Link key={i} to={p ? `/product/${p.id}` : '/shop'} tabIndex={-1} className={'cell photo' + (kind === 'photo-big' ? ' big' : '')} style={style}>
                {p && <ProductImage images={p.images} alt="" />}
              </Link>
            );
          }
          return <span key={i} className={'cell ' + (kind === 'off' ? 'off' : 'on')} style={style}>{kind === 'off' ? '0' : <b>1</b>}</span>;
        })}
      </div>
      <div className="mosaic-caption">
        <span>Every product is one bit.</span>
        <span><b>{total ? count(total) : '…'}</b> bits, one per product</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [catalog, setCatalog] = useState(null);
  const [deals, setDeals] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [prices, setPrices] = useState(null);

  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => {});
    api.search({ filters: { cat: ['Clothing'] }, inStock: true, sort: 'discount', pageSize: 30 })
      .then((d) => setDeals(d.items.filter((p) => p.images.length).slice(0, 14)))
      .catch(() => {});
    api.search({ pageSize: 1 }).then((d) => setPrices(d.facets.prices)).catch(() => {});
    Promise.all(MOSAIC_PICKS.map((f) => api.search({ filters: f, inStock: true, pageSize: 3 }).catch(() => null)))
      .then((res) => setPhotos(res.map((d) => d && d.items.find((p) => p.images.length)).filter(Boolean)));
  }, []);

  const audiences = catalog ? ['Women', 'Men', 'Girls', 'Boys', 'Baby'].map((v) => catalog.audiences.find((a) => a.value === v)).filter(Boolean) : [];
  const under = (i) => (prices ? prices.slice(0, i + 1).reduce((s, b) => s + b.count, 0) : null);
  const bands = [[500, 499], [1000, 999], [2000, 1999]];

  return (
    <>
      <section className="stage">
        <BitField seed={3} density={0.09} />
        <div className="wrap hero">
          <div className="hero-copy">
            <span className="eyebrow"><i />Roaring Bitmap engine · live</span>
            <h1>
              <span className="line">{catalog ? count(catalog.products) : '16,932'} products.</span>
              <span className="line">Filtered before</span>
              <span className="line"><em>you blink.</em></span>
            </h1>
            <p>
              Every product is a bit and every filter is a bitmap. Pick a brand, a colour and a price,
              and RoarMart intersects them in about a millisecond.
            </p>
            <div className="hero-actions">
              <Link to="/shop" className="btn btn-white">Start shopping <ArrowRight width={18} height={18} /></Link>
              <a href="#steals" className="btn btn-ghost">Today's steepest drops</a>
            </div>
            <div className="quick-links">
              <Link to="/shop?cat=Clothing&for=Women">Women's clothing</Link>
              <Link to="/shop?cat=Jewellery&max=999">Jewellery under ₹1,000</Link>
              <Link to={"/shop?cat=" + encodeURIComponent("Footwear > Men's Footwear")}>Men's footwear</Link>
              <Link to="/shop?cat=Watches">Watches</Link>
            </div>
          </div>
          <Mosaic photos={photos} total={catalog && catalog.products} />
        </div>
      </section>

      <div className="wrap">
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Browse by <em>department</em></h2>
              <p>{catalog ? `${count(catalog.categories.length)} departments, ${count(catalog.brands)} brands.` : ' '}</p>
            </div>
            <Link to="/shop" className="more-link">Everything <ArrowRight width={16} height={16} /></Link>
          </div>
          <div className="index">
            {(catalog ? catalog.categories.slice(0, 10) : []).map((c, i) => (
              <Link key={c.value} to={catLink(c.value)}>
                <span className="no">{String(i + 1).padStart(2, '0')}</span>
                <span className="name">{c.value}</span>
                <span className="n">{count(c.count)}</span>
                <ArrowRight width={20} height={20} />
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head"><h2>Who are you <em>shopping for?</em></h2></div>
          <div className="for-row">
            {audiences.map((a, i) => (
              <Link key={a.value} to={audienceLink(a.value)} className="for-card" style={{ background: `linear-gradient(150deg, ${FOR_COLORS[i]}, ${FOR_COLORS[Math.min(i + 1, 4)]})` }}>
                <span className="n">{count(a.count)} products</span>
                <span className="big">{a.value}</span>
                <span className="go"><ArrowRight width={18} height={18} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section" id="steals">
          <div className="section-head">
            <div>
              <h2>Steepest <em>drops</em></h2>
              <p>The biggest discounts in clothing right now.</p>
            </div>
            <Link to="/shop?cat=Clothing&sort=discount" className="more-link">See all <ArrowRight width={16} height={16} /></Link>
          </div>
          <div className="rail">
            {deals.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>

        <section className="section">
          <div className="section-head"><h2>Great finds <em>under</em></h2></div>
          <div className="bands">
            {bands.map(([amount, max], i) => (
              <Link key={amount} to={`/shop?max=${max}`} className="band">
                <span className="under">UNDER</span>
                <span className="amount grad-text"><small>₹</small>{count(amount)}</span>
                <span className="n">{under(i) != null ? `${count(under(i))} products` : ' '}</span>
                <ArrowRight width={22} height={22} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
