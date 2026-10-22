// Plain-language names for what the engine did, shown in the X-ray.
export const METHOD = {
  merge: 'Array ∩ array: merge (two pointers)',
  gallop: 'Array ∩ array: galloping search',
  'bit-test': "Array ∩ bitmap: test each value's bit",
  'word-and': 'Bitmap ∩ bitmap: AND 2,048 words',
  'run-search': 'Run ∩ array: binary search in runs',
  'run-expand': 'Runs expanded to a bitmap, then AND',
};

// The container type to show for a bitmap, from its per-type container counts.
export function kindOf(containers) {
  if (!containers) return 'mixed';
  const types = ['array', 'bitmap', 'run'].filter((t) => containers[t] > 0);
  return types.length === 1 ? types[0] : types.length === 0 ? 'array' : 'mixed';
}

export const COLOR = { array: 'var(--c-array)', bitmap: 'var(--c-bitmap)', run: 'var(--c-run)' };

export function ago(t, now) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 3) return 'just now';
  if (s < 60) return `${s} s ago`;
  return `${Math.round(s / 60)} min ago`;
}

// Turns a query object into the chips shown in the Studio.
export function queryChips(q) {
  const chips = [];
  const f = (q && q.filters) || {};
  for (const field of ['cat', 'brand', 'color', 'for']) {
    if (f[field] && f[field].length) chips.push(`${field}:${f[field].join('|')}`);
  }
  if (q && q.price) chips.push(`price:${q.price.min ?? 0}–${q.price.max ?? '∞'}`);
  if (q && q.assured) chips.push('assured');
  if (q && q.inStock) chips.push('NOT out-of-stock');
  return chips;
}
