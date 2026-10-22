import { useState } from 'react';

// Shows a product photo. If a photo fails to load, it tries the next one, and finally
// falls back to a neutral placeholder, so a dead image link never breaks the page.
export default function ProductImage({ images = [], alt = '' }) {
  const [index, setIndex] = useState(0);
  if (index >= images.length) {
    return (
      <svg className="placeholder" width="38%" height="38%" viewBox="0 0 40 40" aria-label="No image">
        <path d="M4 38 V18 A16 16 0 0 1 36 18 V38 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M14 38 V24 A6 6 0 0 1 26 24 V38" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return <img src={images[index]} alt={alt} loading="lazy" onError={() => setIndex((i) => i + 1)} />;
}
