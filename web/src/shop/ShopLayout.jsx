import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import ProductImage from './ProductImage.jsx';
import BitField from '../components/BitField.jsx';
import Logo from '../components/Logo.jsx';
import { useBag } from './BagContext.jsx';
import { BagIcon, CloseIcon } from '../components/Icons.jsx';
import { rupees } from '../format.js';

function BagDrawer() {
  const { items, remove, open, setOpen } = useBag();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
  if (!open) return null;
  const total = items.reduce((s, p) => s + p.price, 0);
  const mrp = items.reduce((s, p) => s + Math.max(p.mrp, p.price), 0);
  return (
    <>
      <div className="scrim" onClick={() => setOpen(false)} />
      <aside className="drawer" aria-label="Your bag">
        <div className="drawer-head">
          <BitField seed={11} density={0.2} cell={20} />
          <h2>Your <em>bag</em></h2>
          <button type="button" aria-label="Close bag" onClick={() => setOpen(false)}><CloseIcon /></button>
        </div>
        <div className="drawer-body">
          {items.length === 0 && (
            <div className="bag-empty">
              <BagIcon width={40} height={40} style={{ color: 'var(--rose)' }} />
              <b>Nothing here yet</b>
              Add something you like and it will wait for you here.
            </div>
          )}
          {items.map((p) => (
            <div className="bag-item" key={p.id}>
              <Link to={`/product/${p.id}`} className="tile" onClick={() => setOpen(false)}><ProductImage images={p.images} alt={p.name} /></Link>
              <div className="info">
                <span className="card-brand"><span>{p.brand}</span></span>
                <span className="nm">{p.name}</span>
                <span className="price">{rupees(p.price)}</span>
                <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => remove(p.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <div className="bag-foot">
          <div className="bag-total"><span>Total</span><span className="price">{rupees(total)}</span></div>
          {mrp > total && <span className="bag-save">You save {rupees(mrp - total)} on MRP</span>}
          <button type="button" className="btn btn-primary" disabled>Checkout</button>
          <span className="note">RoarMart is a demo store, so there is no checkout.</span>
        </div>
      </aside>
    </>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <Logo size={34} />
          <p style={{ marginTop: 16 }}>
            A shop where every product is a bit and every filter is a bitmap. Each click intersects
            Roaring Bitmaps that we built from scratch, so results come back in about a millisecond.
          </p>
        </div>
        <div>
          <h3>SHOP</h3>
          <ul>
            <li><Link to="/shop?cat=Clothing&for=Women">Women</Link></li>
            <li><Link to="/shop?cat=Clothing&for=Men">Men</Link></li>
            <li><Link to="/shop?cat=Jewellery">Jewellery</Link></li>
            <li><Link to="/shop?cat=Footwear">Footwear</Link></li>
          </ul>
        </div>
        <div>
          <h3>THE PROJECT</h3>
          <ul>
            <li>DSA case study: Roaring Bitmaps</li>
            <li>Shivaditya, Monish, Navikesh, Sudharshan</li>
            <li><Link to="/studio">Open the Engine Studio</Link></li>
          </ul>
        </div>
      </div>
      <div className="wrap footer-base">
        <span>Catalogue: Flipkart product sample (2016)</span>
        <span>Demo store. No real orders are placed.</span>
      </div>
      <div className="footer-word" aria-hidden="true">Roar<em>Mart</em></div>

    </footer>
  );
}

export default function ShopLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <Header />
      <main className="shop-main"><Outlet /></main>
      <Footer />
      <BagDrawer />
    </>
  );
}
