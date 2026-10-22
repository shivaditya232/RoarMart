import { NavLink, Outlet } from 'react-router-dom';
import { LogoMark } from '../components/Logo.jsx';
import { StudioProvider, useStudio } from './StudioContext.jsx';
import { count, bytes } from '../format.js';
import './studio.css';

const icon = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const STUDIO_NAV = [
  { to: '/studio', end: true, label: 'Live X-ray', icon: <svg {...icon}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg> },
  { to: '/studio/bitmaps', label: 'Bitmap explorer', icon: <svg {...icon}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg> },
  { to: '/studio/seller', label: 'Seller tools', icon: <svg {...icon}><path d="M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6" /></svg> },
];

function TopBar() {
  const { connected, overview } = useStudio();
  return (
    <header className="s-top">
      <div className="thread" />
      <div className="s-top-row">
        <div className="s-brand"><LogoMark size={24} inner="#121015" /><b>RoarMart</b><span>Engine Studio</span></div>
        <span className="s-live"><span className={'s-dot' + (connected ? ' on' : '')} />{connected ? 'Live · Storefront connected' : 'Connecting…'}</span>
        {overview && (
          <span className="s-stats">
            {count(overview.products)} products · {count(overview.terms)} bitmaps · {overview.chunks} chunk{overview.chunks === 1 ? '' : 's'} · {bytes(overview.termBytes)}
          </span>
        )}
      </div>
    </header>
  );
}

export default function StudioLayout() {
  return (
    <StudioProvider>
      <div className="studio">
        <TopBar />
        <div className="s-body">
          <nav className="s-nav" aria-label="Studio sections">
            {STUDIO_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>{n.icon}{n.label}</NavLink>
            ))}
          </nav>
          <main className="s-main"><Outlet /></main>
        </div>
      </div>
    </StudioProvider>
  );
}
