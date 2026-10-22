import { RoaringBitmap } from './RoaringBitmap.js';
import { BitSlicedIndex } from './BitSlicedIndex.js';

// CatalogIndex: turns a product catalogue into Roaring Bitmaps.
//
//   term "brand:S4S"      -> bitmap of product IDs from S4S
//   term "color:Red"      -> bitmap of red product IDs
//   term "cat:Clothing"   -> bitmap of IDs in that category (every level of the tree)
//   term "for:Women"      -> bitmap of IDs for women
//   term "assured"        -> bitmap of Assured products
//   term "oos"            -> OUT-of-stock IDs. Only ~7% of products are out of stock,
//                            so we store that small side and subtract it (ANDNOT),
//                            instead of storing a 93%-full "in stock" set.
//   price, discount       -> bit-sliced indexes for range filters
//
// The engine never sees product names or images: only IDs and terms.
export const FIELDS = ['cat', 'brand', 'color', 'for'];

export function termsOf(product) {
  const terms = [];
  const cat = product.category || [];
  for (let level = 0; level < cat.length; level++) {
    terms.push('cat:' + cat.slice(0, level + 1).join(' > '));
  }
  if (product.brand) terms.push('brand:' + product.brand);
  for (const c of product.colors || []) terms.push('color:' + c);
  for (const f of product.idealFor || []) terms.push('for:' + f);
  if (product.assured) terms.push('assured');
  if (product.inStock === false) terms.push('oos');
  return terms;
}

export class CatalogIndex {
  constructor({ priceBits = 20, discountBits = 7 } = {}) {
    this.terms = new Map(); // term -> RoaringBitmap
    this.all = new RoaringBitmap();
    this.price = new BitSlicedIndex(priceBits);
    this.discount = new BitSlicedIndex(discountBits);
  }

  // Time: O(t · log), t = terms per product
  addProduct(id, product) {
    this.all.add(id);
    for (const t of termsOf(product)) {
      let bm = this.terms.get(t);
      if (!bm) { bm = new RoaringBitmap(); this.terms.set(t, bm); }
      bm.add(id);
    }
    this.price.set(id, product.price);
    this.discount.set(id, product.discount || 0);
  }

  // Time: O(t · log)
  removeProduct(id, product) {
    this.all.remove(id);
    for (const t of termsOf(product)) {
      const bm = this.terms.get(t);
      if (!bm) continue;
      bm.remove(id);
      if (bm.isEmpty()) this.terms.delete(t);
    }
    this.price.remove(id);
    this.discount.remove(id);
  }

  bitmap(term) {
    return this.terms.get(term) || new RoaringBitmap();
  }

  // All values of one field, e.g. values('color') -> ['Black', 'Blue', ...]
  // Time: O(number of terms)
  values(field) {
    const prefix = field + ':';
    const out = [];
    for (const t of this.terms.keys()) if (t.startsWith(prefix)) out.push(t.slice(prefix.length));
    return out;
  }

  // Compresses consecutive IDs into run containers everywhere.
  runOptimizeAll() {
    let runs = this.all.runOptimize();
    for (const bm of this.terms.values()) runs += bm.runOptimize();
    return runs;
  }
}
