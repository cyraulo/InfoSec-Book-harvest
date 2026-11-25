import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, ShoppingBag } from 'lucide-react';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import { AccountProvider, AuthPage, Guard, ProfilePage, useAccount } from './account';
import { Catalog, Detail, Home } from './catalog';
import { CartPage, Checkout, OrderDetail, Orders } from './purchase';
import { BookEditor, CategoryEditor, Dashboard, ManageBooks, ManageCategories } from './admin';
import { Feedback, Heading, useAction } from './shared';
import './styles.css';

function Frame() {
  const account = useAccount();
  const action = useAction();
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main && document.activeElement !== document.body) main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);
  async function signOut() {
    const result = await action.run(() => api('/auth/logout', { method: 'POST', body: {} }));
    if (result) {
      account.setUser(null);
      navigate('/', { state: { notice: 'Signed out.' } });
    }
  }
  return <>
    <a className="skip" href="#main-content">Skip to content</a>
    <header className="masthead">
      <div className="shell masthead-inner">
        <Link className="brand" to="/" aria-label="Folio home"><span><BookOpen size={22} aria-hidden="true" /></span>folio<span className="brand-dot">.</span></Link>
        <nav className="main-nav" aria-label="Store">
          <NavLink to="/" end>Home</NavLink><NavLink to="/catalog">Catalog</NavLink>
          {account.user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          {account.user?.role === 'customer' && <NavLink to="/orders">Orders</NavLink>}
        </nav>
        <nav className="account-nav" aria-label="Account">
          {account.user ? <>
            {account.user.role === 'customer' && <NavLink to="/cart"><ShoppingBag size={17} aria-hidden="true" /> Cart</NavLink>}
            <NavLink to="/profile">Profile</NavLink>
            <button className="button text" aria-disabled={action.pending} onClick={signOut}>{action.pending ? 'Signing out…' : 'Sign out'}</button>
          </> : !account.loading && <NavLink to="/login">Sign in</NavLink>}
        </nav>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="shell main">
      <Feedback error={action.error} notice={location.state?.notice} />
      <Outlet />
    </main>
    <footer><div className="shell footer-inner"><Link to="/" className="footer-brand">Folio Bookshop</Link>
      <span>Prices in Philippine pesos · Cash on delivery</span></div></footer>
  </>;
}
function AdminFrame() {
  return <>
    <nav className="admin-nav" aria-label="Administration">
      <NavLink to="/admin" end>Dashboard</NavLink>
      <NavLink to="/admin/books">Books</NavLink>
      <NavLink to="/admin/categories">Categories</NavLink>
      <NavLink to="/admin/orders">Orders</NavLink>
    </nav>
    <Outlet />
  </>;
}
function App() {
  return <BrowserRouter><AccountProvider><Routes>
    <Route element={<Frame />}>
      <Route index element={<Home />} />
      <Route path="catalog" element={<Catalog />} />
      <Route path="books/:id" element={<Detail />} />
      <Route path="login" element={<AuthPage key="login" />} />
      <Route path="register" element={<AuthPage key="register" register />} />
      <Route element={<Guard />}><Route path="profile" element={<ProfilePage />} /></Route>
      <Route element={<Guard role="customer" />}>
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="orders/:id/confirmation" element={<OrderDetail confirmation />} />
      </Route>
      <Route element={<Guard role="admin" />}>
        <Route path="admin" element={<AdminFrame />}>
          <Route index element={<Dashboard />} />
          <Route path="books" element={<ManageBooks />} />
          <Route path="books/new" element={<BookEditor />} />
          <Route path="books/:id" element={<BookEditor />} />
          <Route path="categories" element={<ManageCategories />} />
          <Route path="categories/new" element={<CategoryEditor />} />
          <Route path="categories/:id" element={<CategoryEditor />} />
          <Route path="orders" element={<Orders admin />} />
          <Route path="orders/:id" element={<OrderDetail admin />} />
        </Route>
      </Route>
      <Route path="*" element={<><Heading title="Page not found" /><Link to="/catalog">Browse the catalog</Link></>} />
    </Route>
  </Routes></AccountProvider></BrowserRouter>;
}
createRoot(document.getElementById('root')).render(<App />);
