// Line icons used across the app (no icon font, no emoji).
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const SearchIcon = (p) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;
export const UserIcon = (p) => <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>;
export const HeartIcon = ({ filled, ...p }) => <svg {...base} {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill={filled ? 'currentColor' : 'none'} /></svg>;
export const BagIcon = (p) => <svg {...base} {...p}><path d="M5 8h14l-1.2 12H6.2z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
export const CloseIcon = (p) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const FilterIcon = (p) => <svg {...base} {...p}><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
export const ChevronLeft = (p) => <svg {...base} {...p}><path d="M15 6l-6 6 6 6" /></svg>;
export const ChevronRight = (p) => <svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>;
export const ChevronDown = (p) => <svg {...base} {...p}><path d="M6 9l6 6 6-6" /></svg>;
export const ArrowRight = (p) => <svg {...base} {...p}><path d="M4 12h15M13 6l6 6-6 6" /></svg>;
export const CheckIcon = (p) => <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
export const GridIcon = (p) => <svg {...base} {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>;
export const ShieldIcon = (p) => <svg {...base} {...p}><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>;
export const BoltIcon = (p) => <svg {...base} {...p}><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" /></svg>;
export const PlusIcon = (p) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>;
