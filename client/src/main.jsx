import { Component, useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, ShoppingBag, UserRound } from 'lucide-react';
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from './api';
import { AccountProvider, AuthPage, Guard, ProfilePage, useAccount } from './account';
import { Catalog, Detail, Home } from './catalog';
import { CartPage, Checkout, OrderDetail, Orders } from './purchase';
import { BookEditor, CategoryEditor, Dashboard, ManageBooks, ManageCategories } from './admin';
import { Feedback, Heading, useAction } from './shared';
import { Policies } from './policies';
import './styles.css';

function StoreSearch() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const query = pathname === '/catalog' ? params.get('q') || '' : '';
  function submit(event) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q').trim();
    const next = new URLSearchParams(pathname === '/catalog' ? params : '');
    next.delete('page');
    if (value) next.set('q', value);
    else next.delete('q');
    navigate({ pathname: '/catalog', search: next.toString() });
  }
  return <form role="search" className="store-search" onSubmit={submit}>
    <label htmlFor="store-query">Search<span className="sr-only"> books</span></label>
    <input key={pathname + ':' + query} id="store-query" type="search" name="q"
      defaultValue={query} maxLength={120} placeholder="Title, author, or ISBN" />
    <button type="submit" aria-label="Submit book search"><Search size={18} aria-hidden="true" /></button>
  </form>;
}
function Frame() {
  const account = useAccount();
  const action = useAction();
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const mainRef = useRef(null);
  const previousPath = useRef(pathname);
  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const main = mainRef.current;
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches || !main.animate) return;
    const entrance = main.animate([
      { opacity: 0.72, transform: 'translateY(5px)' },
      { opacity: 1, transform: 'none' },
    ], { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)', id: 'folio-page-enter' });
    const stop = () => entrance.cancel();
    preference.addEventListener('change', stop);
    return () => {
      preference.removeEventListener('change', stop);
      stop();
    };
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
        <Link className="brand" to="/" aria-label="Folio home"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>folio</Link>
        <nav className="main-nav" aria-label="Store">
          <NavLink to="/" end>Home</NavLink><NavLink to="/catalog">Catalog</NavLink>
          {account.user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          {account.user?.role === 'customer' && <NavLink to="/orders">Orders</NavLink>}
        </nav>
        {!pathname.startsWith('/admin') && <StoreSearch />}
        <nav className="account-nav" aria-label="Account">
          {account.user ? <>
            {account.user.role === 'customer' && <NavLink to="/cart"><ShoppingBag size={17} aria-hidden="true" /> Cart</NavLink>}
            <NavLink to="/profile">Profile</NavLink>
            <button className="button text" aria-disabled={action.pending} onClick={signOut}>{action.pending ? 'Signing out…' : 'Sign out'}</button>
          </> : !account.loading && <NavLink to="/login"><UserRound size={17} aria-hidden="true" />Sign in</NavLink>}
        </nav>
      </div>
    </header>
    <main ref={mainRef} id="main-content" tabIndex={-1} className="shell main">
      <Feedback error={action.error} notice={location.state?.notice} />
      <Outlet />
    </main>
    <footer><div className="shell footer-inner"><Link to="/" className="footer-brand">Folio Bookshop</Link>
      <nav className="policy-links" aria-label="Store policies">
        <Link to="/privacy">Privacy notice</Link><Link to="/terms">Terms and conditions</Link>
      </nav><span>Prices in Philippine pesos · Cash on delivery</span></div></footer>
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
      <Route path="privacy" element={<Policies key="privacy" kind="privacy" />} />
      <Route path="terms" element={<Policies key="terms" kind="terms" />} />
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
class AppErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="shell main"><Heading title="The bookstore could not load" />
      <p>Please reload to try again.</p><a href="/">{'Return to Folio'}</a></main>;
  }
}
createRoot(document.getElementById('root')).render(<AppErrorBoundary><App /></AppErrorBoundary>);
