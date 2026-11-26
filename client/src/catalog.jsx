import { useEffect, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { api, RequestError, useResource } from './api';
import { useAccount } from './account';
import { authors, Availability, BookTile, Cover, Empty, Feedback, Field, Heading, money, Pager, parsePeso, Result, useAction } from './shared';

function FeaturedBooks({ books }) {
  const [position, setPosition] = useState(0);
  const location = useLocation();
  const index = position % books.length;
  const book = books[index];
  return <section className="front-table" aria-label="Featured books">
    <div className="feature-copy">
      <p className="feature-kicker"><Bookmark size={16} aria-hidden="true" /> Featured book
        {book.category?.name && <span>{book.category.name}</span>}</p>
      <div className="feature-info" aria-live="polite" aria-atomic="true">
        <h1>{book.title}</h1><p className="feature-author">{authors(book)}</p>
        <div className="book-meta"><strong>{money(book.priceCents)}</strong><Availability book={book} /></div>
      </div>
      <Link className="button" to={'/books/' + book._id} state={{ returnTo: location.pathname + location.search }}>View book</Link>
    </div>
    <div className="feature-stage">
      <Cover book={book} eager />
      {books.length > 1 && <div className="feature-controls" role="group" aria-label="Featured book selection">
        <button aria-label="Previous featured book" onClick={() => setPosition((index + books.length - 1) % books.length)}><ChevronLeft size={17} /></button>
        <span>{index + 1} / {books.length}</span>
        <button aria-label="Next featured book" onClick={() => setPosition((index + 1) % books.length)}><ChevronRight size={17} /></button>
      </div>}
    </div>
  </section>;
}
function ShelfFilters({ items, selected, onChange }) {
  const options = [{ slug: '', name: 'All' }, ...items];
  return <>
    <nav className="shelf-tabs" aria-label="Shelf categories">{options.map(item =>
      <Link key={item.slug} to={item.slug ? '/?' + new URLSearchParams({ shelf: item.slug }) : '/'}
        preventScrollReset aria-current={item.slug === selected ? 'page' : undefined}>{item.name}</Link>)}</nav>
    <div className="shelf-select field"><label htmlFor="shelf-category">Shelf category</label>
      <select id="shelf-category" value={selected} onChange={event => onChange(event.target.value)}>
        {options.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
      </select>
    </div>
  </>;
}
export function Home() {
  const table = useResource('/books/front-table');
  const categories = useResource('/categories');
  const [params, setParams] = useSearchParams();
  const category = params.get('shelf') || '';
  const filtered = useResource(category ? '/books?' + new URLSearchParams({ category }) : null);
  const featureCount = Math.min(3, Math.max(1, (table.data?.length || 0) - 6));
  const shelf = category ? filtered : table;
  return <>
    <div className="feature-slot"><Result resource={table} label="Loading featured books…">{books => books.length
      ? <FeaturedBooks books={books.slice(0, featureCount)} />
      : <Heading title="Folio bookshop" />}</Result></div>
    <section className="home-section" aria-labelledby="shelf-title">
      <div className="section-title"><h2 id="shelf-title">On the shelves</h2>
        <Link to={category ? '/catalog?' + new URLSearchParams({ category }) : '/catalog'}>View catalog</Link></div>
      <Result resource={categories} label="Loading categories…">{items => items.length > 0 &&
        <ShelfFilters items={items} selected={category} onChange={value => setParams(value ? { shelf: value } : {})} />}</Result>
      {!(table.error && !category) && <Result resource={shelf} label="Loading books…">{data => {
        const books = category ? data.items.slice(0, 6) : data.slice(data.length > 1 ? featureCount : 0);
        return books.length ? <div className="book-grid">{books.map(book => <BookTile key={book._id} book={book} />)}</div>
          : <Empty title={category ? 'No books on this shelf' : 'The shelves are empty'}>
              {category ? <Link to="/">See all shelves</Link> : <p>Check back for new arrivals.</p>}
            </Empty>;
      }}</Result>}
    </section>
  </>;
}

function Filters({ params, categories, onApply }) {
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(() => window.matchMedia('(min-width: 769px)').matches);
  useEffect(() => {
    const layout = window.matchMedia('(min-width: 769px)');
    const resize = event => setExpanded(event.matches);
    layout.addEventListener('change', resize);
    return () => layout.removeEventListener('change', resize);
  }, []);
  const pesoValue = key => params.has(key) ? (Number(params.get(key)) / 100).toString() : '';
  function apply(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const next = new URLSearchParams();
    if (params.get('q')) next.set('q', params.get('q'));
    const fields = {};
    for (const key of ['category', 'availability', 'sort']) {
      const value = values[key]?.trim();
      if (value && !(key === 'sort' && value === 'title')) next.set(key, value);
    }
    for (const key of ['min', 'max']) {
      if (!values[key]) continue;
      const value = parsePeso(values[key]);
      if (!Number.isFinite(value) || value > 10000000) fields[key] = 'Use an amount from 0 to 100,000, with up to two decimals.';
      else next.set(key, value);
    }
    if (next.has('min') && next.has('max') && Number(next.get('min')) > Number(next.get('max'))) {
      fields.max = 'Maximum must be at least the minimum.';
    }
    if (Object.keys(fields).length) {
      setExpanded(true);
      return setError(new RequestError('Check the price range.', 400, fields));
    }
    setError(null);
    onApply(next);
  }
  return <form className="catalog-filters" onSubmit={apply} aria-label="Catalog filters">
    <Feedback error={error} form />
    <details className="filter-details" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary><span className="filter-heading"><SlidersHorizontal size={17} aria-hidden="true" />Filters{['category', 'min', 'max', 'availability', 'sort'].some(key => params.has(key)) ? ' (active)' : ''}</span></summary>
      <div className="filter-options">
    <Field name="category" label="Category" as="select" defaultValue={params.get('category') || ''}>
      <option value="">All categories</option>{categories.map(item => <option key={item._id} value={item.slug}>{item.name}</option>)}
    </Field>
    <div className="field-pair">
      <Field name="min" label="Min (₱)" inputMode="decimal" defaultValue={pesoValue('min')} error={error?.fields.min} />
      <Field name="max" label="Max (₱)" inputMode="decimal" defaultValue={pesoValue('max')} error={error?.fields.max} />
    </div>
    <Field name="availability" label="Availability" as="select" defaultValue={params.get('availability') || ''}>
      <option value="">Any availability</option><option value="in">In stock</option><option value="out">Out of stock</option>
    </Field>
    <Field name="sort" label="Sort by" as="select" defaultValue={params.get('sort') || 'title'}>
      <option value="title">Title, A–Z</option><option value="recent">Recently added</option>
      <option value="price-asc">Price, low to high</option><option value="price-desc">Price, high to low</option>
    </Field>
      </div>
    <div className="actions">
      <button className="button">Apply filters</button><Link className="button secondary" to="/catalog">Clear</Link>
    </div>
    </details>
  </form>;
}
export function Catalog() {
  const [params, setParams] = useSearchParams();
  const filters = new URLSearchParams(params);
  filters.delete('page');
  const categories = useResource('/categories');
  const results = useResource('/books?' + params);
  return <>
    <Heading title="Browse books" />
    <div className="catalog-layout">
      <Result resource={categories} label="Loading filters…">{items =>
        <Filters key={String(filters)} params={params} categories={items} onApply={setParams} />}</Result>
      <section aria-label="Catalog results" className="catalog-results">
        <Result resource={results} label="Loading books…">{data => <>
          <p className="result-count" role="status">{data.total} {data.total === 1 ? 'book' : 'books'}{params.get('q') && ' for “' + params.get('q') + '”'}</p>
          {data.items.length ? <div className="book-grid">{data.items.map(book => <BookTile key={book._id} book={book} />)}</div>
            : <Empty title={filters.size ? 'No books match your search' : 'The catalog is empty'}>
              {filters.size ? <Link to="/catalog">Clear filters and browse all books</Link> : <p>Check back for new arrivals.</p>}
            </Empty>}
          <Pager data={data} onChange={page => { const next = new URLSearchParams(params); next.set('page', page); setParams(next); }} />
        </>}</Result>
      </section>
    </div>
  </>;
}
export function Detail() {
  const { id } = useParams();
  const resource = useResource('/books/' + id);
  const { user } = useAccount();
  const location = useLocation();
  const back = location.state?.returnTo ?? '/catalog';
  const action = useAction();
  return <>
    <Link className="back" to={back}><ChevronLeft size={16} aria-hidden="true" />{back.split('?')[0] === '/' ? 'Home' : 'Back to catalog'}</Link>
    <Result resource={resource}>{book =>
      <div className="book-details">
        <Cover book={book} eager />
        <div className="detail-copy">
          <p className="eyebrow">{book.category?.name}</p><h1>{book.title}</h1>
          {book.subtitle && <p className="subtitle">{book.subtitle}</p>}
          <p className="byline">{authors(book)}</p>
          <div className="book-meta"><strong className="detail-price">{money(book.priceCents)}</strong><Availability book={book} /></div>
          {book.stock > 0 && user?.role === 'customer' && <form className="purchase" onSubmit={event => {
            event.preventDefault();
            const quantity = Number(new FormData(event.currentTarget).get('quantity'));
            action.run(() => api('/cart/items', { method: 'POST', body: { book: id, quantity } }), 'Added to your cart.');
          }}>
            <Field name="quantity" label="Quantity" type="number" min={1} max={Math.min(book.stock, 99)} defaultValue={1} required error={action.error?.fields.quantity} />
            <button className="button" aria-disabled={action.pending}>{action.pending ? 'Adding…' : 'Add to cart'}</button>
          </form>}
          {book.stock > 0 && !user && <Link className="button" to="/login" state={{ returnTo: location.pathname, required: true }}>Sign in to add to cart</Link>}
          <Feedback error={action.error} notice={action.notice} />
          {action.error?.status === 0 && <p>Check your cart before adding this book again.</p>}
          {(action.notice || action.error?.status === 0) && <Link to="/cart">View cart</Link>}
          <section className="about"><h2>About this book</h2><p className="description">{book.description || 'A description is unavailable.'}</p>
            <dl className="facts">
              {Object.entries({ ISBN: book.isbn, Publisher: book.publisher, Published: book.publishedDate,
                Pages: book.pageCount || '', Language: book.language, 'Google Books rating': book.averageRating === undefined ? '' :
                  book.averageRating + ' / 5 (' + (book.ratingsCount ?? 0) + ' ratings)' }).filter(([, value]) => value).map(([key, value]) =>
                <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
            </dl>
          </section>
        </div>
      </div>}</Result>
  </>;
}
