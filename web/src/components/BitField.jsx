import { useId, useMemo } from 'react';

// The texture on every gradient stage: a field of small squares, like the bits of a bitmap.
// A few of them slowly switch on and off. The layout is seeded, so it is the same on every load.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export default function BitField({ seed = 7, density = 0.13, cell = 26 }) {
  const mask = useId();
  const cells = useMemo(() => {
    const rnd = seeded(seed);
    const out = [];
    const cols = Math.ceil(1600 / cell);
    const rows = Math.ceil(640 / cell);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd() < density) {
          const blink = rnd() < 0.14;
          out.push({ x: c * cell, y: r * cell, o: 0.05 + rnd() * 0.16, blink, delay: (rnd() * 6).toFixed(2) });
        }
      }
    }
    return out;
  }, [seed, density, cell]);
  const size = cell - 8;

  return (
    <div className="bitfield" aria-hidden="true">
      <svg viewBox="0 0 1600 640" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={mask + 'g'} x1="0" y1="0" x2="1" y2="0.35">
            <stop offset="0" stopColor="#fff" stopOpacity="0.15" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id={mask}>
            <rect width="1600" height="640" fill={`url(#${mask}g)`} />
          </mask>
        </defs>
        <g mask={`url(#${mask})`} fill="#fff">
          {cells.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={size} height={size} rx="4"
              className={b.blink ? 'bit-blink' : undefined}
              style={b.blink ? { animationDelay: `${b.delay}s` } : { opacity: b.o }} />
          ))}
        </g>
      </svg>
    </div>
  );
}
