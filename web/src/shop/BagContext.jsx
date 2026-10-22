import { createContext, useContext, useState, useCallback } from 'react';

// The shopping bag and wishlist live in the browser only (this is a demo store:
// there is no checkout).
const BagContext = createContext(null);

export function BagProvider({ children }) {
  const [items, setItems] = useState([]);
  const [wish, setWish] = useState(() => new Set());
  const [open, setOpen] = useState(false);

  const add = useCallback((p) => {
    setItems((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
  }, []);
  const remove = useCallback((id) => setItems((list) => list.filter((x) => x.id !== id)), []);
  const toggleWish = useCallback((id) => {
    setWish((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  return (
    <BagContext.Provider value={{ items, add, remove, open, setOpen, wish, toggleWish }}>
      {children}
    </BagContext.Provider>
  );
}

export const useBag = () => useContext(BagContext);
