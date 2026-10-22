import { useId } from 'react';

// The RoarMart mark: a market-stall arch in the RoarMart gradient.
// On a gradient background pass solid="#FFFFFF" to draw it in one colour.
export function LogoMark({ size = 28, inner = '#FFFFFF', solid }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6A62B" />
          <stop offset="0.52" stopColor="#E5482D" />
          <stop offset="1" stopColor="#A11E5B" />
        </linearGradient>
      </defs>
      <path d="M4 38 V18 A16 16 0 0 1 36 18 V38 Z" fill={solid || `url(#${id})`} />
      <path d="M14 38 V24 A6 6 0 0 1 26 24 V38 Z" fill={inner} />
    </svg>
  );
}

// Wordmark: "Roar" upright, "Mart" in italic.
export default function Logo({ size = 30, inner, solid, short = false }) {
  return (
    <span className="logo">
      <LogoMark size={size} inner={inner} solid={solid} />
      {!short && <span className="logo-word">Roar<em>Mart</em></span>}
    </span>
  );
}
