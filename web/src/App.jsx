import { Routes, Route } from 'react-router-dom';
import { BagProvider } from './shop/BagContext.jsx';
import ShopLayout from './shop/ShopLayout.jsx';
import Home from './shop/Home.jsx';
import Listing from './shop/Listing.jsx';
import Product from './shop/Product.jsx';

export default function App() {
  return (
    <BagProvider>
      <Routes>
        <Route element={<ShopLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Listing />} />
          <Route path="/product/:id" element={<Product />} />
        </Route>
      </Routes>
    </BagProvider>
  );
}
