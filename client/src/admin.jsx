import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, RequestError, useResource } from './api';
import { Availability, Confirm, date, Empty, Feedback, Field, Heading, money, orderNumber, Pager, parsePeso, Result, Status, Table, useAction } from './shared';

export function Dashboard() {
  const resource = useResource('/admin/dashboard');
  return <><Heading title="Store dashboard">Review new orders and books that need stock.</Heading>
    <Result resource={resource}>{data => <>
      <section className="admin-highlight"><div><h2>Pending orders</h2><p>{data.pending} awaiting confirmation</p></div>
        <Link className="button" to="/admin/orders?status=Pending">Review orders</Link></section>
      <div className="dashboard-grid">
        <section><h2>Low stock</h2>
          {data.lowStock.length ? <Table label="Low stock books" headers={['Book', 'Copies']}>
            {data.lowStock.map(book => <tr key={book._id}><th scope="row"><Link to={'/admin/books/' + book._id}>{book.title}</Link></th><td>{book.stock}</td></tr>)}
          </Table> : <p>No active books have five or fewer copies.</p>}
        </section>
        <section><h2>Recent orders</h2>
          {data.recent.length ? <Table label="Recent orders" headers={['Order', 'Placed', 'Status', 'Total']}>
            {data.recent.map(order => <tr key={order._id}><th scope="row"><Link to={'/admin/orders/' + order._id}>{orderNumber(order._id)}</Link></th>
              <td>{date(order.createdAt)}</td><td><Status value={order.status} /></td><td className="number">{money(order.totalCents)}</td></tr>)}
          </Table> : <p>Orders will appear here after checkout.</p>}
        </section>
      </div>
    </>}</Result>
  </>;
}

export function ManageBooks() {
  const [params, setParams] = useSearchParams();
  const resource = useResource('/admin/books?' + params);
  const action = useAction();
  const [selected, setSelected] = useState(null);
  async function remove() {
    const result = await action.run(() => api('/admin/books/' + selected._id, { method: 'DELETE' }),
      result => result.action === 'archived' ? 'Book archived. Its order and cart references are preserved.' : 'Book removed.');
    if (result) {
      const items = resource.data.items.flatMap(book => book._id !== selected._id ? [book]
        : result.action === 'archived' ? [{ ...book, archived: true }] : []);
      resource.update({ ...resource.data, items });
      setSelected(null);
      resource.retry();
    }
  }
  function search(event) {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get('admin-search').trim();
    setParams(query ? { q: query } : {});
  }
  return <>
    <Heading title="Manage books" action={<Link id="add-book" className="button" to="/admin/books/new">Add book</Link>} />
    <form className="table-tools actions" onSubmit={search} key={params.get('q') ?? ''}>
      <Field name="admin-search" label="Search books" placeholder="Title, author, or ISBN" defaultValue={params.get('q') ?? ''} maxLength={120} />
      <button className="button secondary">Search</button>
      {params.has('q') && <Link className="button text" to="/admin/books">Clear search</Link>}
    </form>
    {!selected && <Feedback notice={action.notice} />}
    <Result resource={resource}>{data => data.items.length ? <>
      <Table label="Book inventory" headers={['Title', 'Category', 'Price', 'Stock', 'Availability', 'Actions']}>
        {data.items.map(book => <tr key={book._id}>
          <th scope="row"><Link to={'/admin/books/' + book._id}>{book.title}</Link></th>
          <td>{book.category?.name}</td><td className="number">{money(book.priceCents)}</td><td>{book.stock}</td><td><Availability book={book} /></td>
          <td><div className="row-actions"><Link to={'/admin/books/' + book._id} aria-label={'Edit ' + book.title}>Edit</Link>
            {!book.archived && <button className="button text danger-text" aria-label={'Remove ' + book.title}
              onClick={() => { action.setError(null); setSelected(book); }}>Remove</button>}</div></td>
        </tr>)}
      </Table>
      <Pager data={data} onChange={page => { const next = new URLSearchParams(params); next.set('page', page); setParams(next); }} />
    </> : <Empty title={params.has('q') ? 'No books match your search' : 'No books in the catalog'} />}</Result>
    {selected && <Confirm title="Remove this book?" onCancel={() => setSelected(null)} onConfirm={remove} pending={action.pending}
      error={action.error} fallbackId="add-book">“{selected.title}” will be archived if it appears in an order or a cart.</Confirm>}
  </>;
}
function BookForm({ book, categories }) {
  const action = useAction();
  const navigate = useNavigate();
  const errors = action.error?.fields ?? {};
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!Number.isFinite(parsePeso(values.priceCents))) {
      action.setError(new RequestError('Check the book price.', 400, { priceCents: 'Use a peso amount with up to two decimal places.' }));
      return;
    }
    const body = {
      ...values, priceCents: parsePeso(values.priceCents), stock: Number(values.stock),
      authors: values.authors.split(',').map(name => name.trim()).filter(Boolean),
      pageCount: values.pageCount === '' ? null : Number(values.pageCount),
    };
    const result = await action.run(() => api(book?._id ? '/admin/books/' + book._id : '/admin/books', {
      method: book?._id ? 'PUT' : 'POST', body,
    }), 'Book saved.');
    if (result && !book?._id) navigate('/admin/books/' + result._id, { replace: true, state: { notice: 'Book created.' } });
  }
  return <form className="panel stack form-wide" onSubmit={submit}>
    <Feedback error={action.error} notice={action.notice} form />
    {book?.archived && <p className="feedback">This book is archived.</p>}
    <Field name="title" label="Title" defaultValue={book?.title} error={errors.title} maxLength={500} required />
    <Field name="subtitle" label="Subtitle (optional)" defaultValue={book?.subtitle} error={errors.subtitle} maxLength={500} />
    <Field name="authors" label="Authors (optional)" defaultValue={book?.authors?.join(', ')} error={errors.authors}
      hint="Separate author names with commas." />
    <div className="field-pair">
      <Field name="category" label="Category" as="select" defaultValue={book?.category?._id ?? ''} error={errors.category} required>
        <option value="" disabled>Choose a category</option>
        {categories.map(category => <option key={category._id} value={category._id}>{category.name}</option>)}
      </Field>
      <Field name="isbn" label="ISBN (optional)" defaultValue={book?.isbn} error={errors.isbn} />
    </div>
    <div className="field-pair">
      <Field name="priceCents" label="Price (₱)" defaultValue={book ? (book.priceCents / 100).toFixed(2) : ''}
        error={errors.priceCents} inputMode="decimal" required />
      <Field name="stock" label="Stock" type="number" min={0} max={1000000} defaultValue={book?.stock ?? 0} error={errors.stock} required />
    </div>
    <Field name="description" label="Description (optional)" as="textarea" rows={5} defaultValue={book?.description} error={errors.description} maxLength={50000} />
    <div className="field-pair">
      <Field name="publisher" label="Publisher (optional)" defaultValue={book?.publisher} error={errors.publisher} maxLength={250} />
      <Field name="publishedDate" label="Publication date (optional)" defaultValue={book?.publishedDate} error={errors.publishedDate}
        hint="Use YYYY, YYYY-MM, or YYYY-MM-DD." />
    </div>
    <div className="field-pair">
      <Field name="pageCount" label="Pages (optional)" type="number" min={0} max={100000} defaultValue={book?.pageCount} error={errors.pageCount} />
      <Field name="language" label="Language (optional)" defaultValue={book?.language} error={errors.language} maxLength={20} />
    </div>
    <Field name="coverPath" label="Cover path (optional)" defaultValue={book?.coverPath} error={errors.coverPath}
      hint="Use a file such as /covers/fiction/example.jpg or leave blank." maxLength={500} />
    <div className="actions"><button className="button" aria-disabled={action.pending}>{action.pending ? 'Saving…' : book ? 'Save book' : 'Create book'}</button>
      <Link className="button secondary" to="/admin/books">Back to books</Link></div>
  </form>;
}
export function BookEditor() {
  const { id } = useParams();
  const book = useResource(id ? '/admin/books/' + id : null);
  const categories = useResource('/admin/categories');
  return <>
    <Heading title={id ? 'Edit book' : 'Add book'} />
    <Result resource={categories}>{items => !items.length
      ? <Empty title="Create a category first"><Link className="button" to="/admin/categories/new">Add category</Link></Empty>
      : id ? <Result resource={book}>{value => <BookForm key={value._id} book={value} categories={items} />}</Result>
        : <BookForm categories={items} />}</Result>
  </>;
}
export function ManageCategories() {
  const resource = useResource('/admin/categories');
  const action = useAction();
  const [selected, setSelected] = useState(null);
  async function remove() {
    const result = await action.run(() => api('/admin/categories/' + selected._id, { method: 'DELETE' }), 'Category removed.');
    if (result) {
      resource.update(resource.data.filter(category => category._id !== selected._id));
      setSelected(null);
      resource.retry();
    }
  }
  return <>
    <Heading title="Manage categories" action={<Link className="button" id="add-category" to="/admin/categories/new">Add category</Link>} />
    {!selected && <Feedback notice={action.notice} />}
    <Result resource={resource}>{items => items.length
      ? <Table label="Categories" headers={['Name', 'Description', 'Actions']}>
        {items.map(category => <tr key={category._id}>
          <th scope="row"><Link to={'/admin/categories/' + category._id}>{category.name}</Link></th>
          <td>{category.description || '—'}</td><td><div className="row-actions">
            <Link to={'/admin/categories/' + category._id} aria-label={'Edit ' + category.name}>Edit</Link>
            <button className="button text danger-text" aria-label={'Remove ' + category.name} onClick={() => {
              action.setError(null); setSelected(category);
            }}>Remove</button>
          </div></td></tr>)}
      </Table> : <Empty title="No categories yet" />}</Result>
    {selected && <Confirm title="Remove this category?" onCancel={() => setSelected(null)} onConfirm={remove} pending={action.pending}
      error={action.error} fallbackId="add-category">Remove “{selected.name}”. Move its books into another category first if it is in use.</Confirm>}
  </>;
}
function CategoryForm({ category }) {
  const action = useAction();
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const result = await action.run(() => api(category ? '/admin/categories/' + category._id : '/admin/categories', {
      method: category ? 'PUT' : 'POST', body,
    }), 'Category saved.');
    if (result && !category) navigate('/admin/categories/' + result._id, { replace: true, state: { notice: 'Category created.' } });
  }
  return <form className="panel stack narrow" onSubmit={submit}>
    <Feedback error={action.error} notice={action.notice} form />
    <Field name="name" label="Category name" required maxLength={80} defaultValue={category?.name} error={action.error?.fields.name} />
    <Field name="description" label="Description (optional)" as="textarea" rows={4} maxLength={500}
      defaultValue={category?.description} error={action.error?.fields.description} />
    <div className="actions"><button className="button" aria-disabled={action.pending}>{action.pending ? 'Saving…' : category ? 'Save category' : 'Create category'}</button>
      <Link to="/admin/categories" className="button secondary">Back to categories</Link></div>
  </form>;
}
export function CategoryEditor() {
  const { id } = useParams();
  const resource = useResource(id ? '/admin/categories/' + id : null);
  return <><Heading title={id ? 'Edit category' : 'Add category'} />
    {id ? <Result resource={resource}>{category => <CategoryForm key={category._id} category={category} />}</Result> : <CategoryForm />}</>;
}
