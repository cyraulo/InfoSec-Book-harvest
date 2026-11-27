import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, useResource } from './api';
import { useAccount } from './account';
import { Confirm, Cover, date, Empty, Feedback, Field, Heading, money, orderNumber, Pager, Result, Status, Table, useAction } from './shared';

function CartLine({ line, change, pending, validation }) {
  const book = line.book;
  return <article className="cart-line">
    <Cover book={book ?? {}} />
    <div>
      <h2>{book && !book.archived ? <Link to={'/books/' + book._id}>{book.title}</Link> : book?.title || 'Unavailable book'}</h2>
      {book && <p>{money(book.priceCents)} per copy</p>}
      {!line.available && <p className="field-error">{book?.archived ? 'This title is no longer for sale.' : 'The requested quantity is unavailable.'}</p>}
      {book && <div className="actions cart-actions">
        {!book.archived && book.stock > 0 && <form className="quantity-form" onSubmit={event => {
          event.preventDefault();
          change('PATCH', '/cart/items/' + book._id, { quantity: Number(new FormData(event.currentTarget).get('quantity')) }, 'Quantity updated.');
        }}>
          <Field name="quantity" prefix={book._id + '-'} label="Quantity" type="number" defaultValue={line.quantity} min={1}
            max={Math.min(book.stock, 99)} required error={validation} />
          <button className="button secondary" aria-disabled={pending}>Update quantity</button>
        </form>}
        <button className="button text danger-text" disabled={pending} onClick={() => change('DELETE', '/cart/items/' + book._id, undefined, 'Item removed.')}>Remove</button>
      </div>}
    </div>
    <strong>{money(line.lineTotalCents)}</strong>
  </article>;
}
export function CartPage() {
  const resource = useResource('/cart');
  const action = useAction();
  const [confirm, setConfirm] = useState(false);
  const [lineId, setLineId] = useState(null);
  async function change(method, route, body, message) {
    setLineId(route.split('/').at(-1));
    const updated = await action.run(() => api(route, { method, body }), message);
    if (updated) { resource.update(updated); setConfirm(false); }
  }
  return <>
    <Heading title="Your cart" />
    {!confirm && <Feedback error={action.error} notice={action.notice} />}
    <Result resource={resource}>{cart => cart.items.length ? <div className="purchase-layout">
      <section aria-label="Cart items">
        {cart.items.map((line, index) => <CartLine key={(line.book?._id || index) + '-' + cart.revision} line={line} change={change}
          pending={action.pending} validation={lineId === line.book?._id ? action.error?.fields.quantity : undefined} />)}
        <button className="button text danger-text" disabled={action.pending} onClick={() => { action.setError(null); setConfirm(true); }}>Clear cart</button>
      </section>
      <aside className="panel summary">
        <h2>Order summary</h2><p className="summary-total"><span>Total</span><strong>{money(cart.totalCents)}</strong></p>
        <p>Cash on delivery. No delivery fee.</p>
        {cart.items.every(line => line.available)
          ? <Link className="button" to="/checkout">Continue to checkout</Link>
          : <p>Update or remove unavailable items before checking out.</p>}
      </aside>
    </div> : <Empty title="Your cart is empty"><Link className="button" to="/catalog">Browse the catalog</Link></Empty>}</Result>
    {confirm && <Confirm title="Clear your cart?" pending={action.pending} error={action.error} onCancel={() => setConfirm(false)}
      fallbackId="main-content" onConfirm={() => change('DELETE', '/cart', undefined, 'Cart cleared.')}>This removes every item in your cart.</Confirm>}
  </>;
}

const checkoutStorage = user => 'folio-checkout-' + user._id;
export function Checkout() {
  const { user } = useAccount();
  const resource = useResource('/cart');
  const navigate = useNavigate();
  const action = useAction();
  const [draft, setDraft] = useState({ name: user.name, phone: user.phone, address: '' });
  const [key, setKey] = useState(() => sessionStorage.getItem(checkoutStorage(user)) || '');
  const [lookupDone, setLookupDone] = useState(!key);
  const [lookupError, setLookupError] = useState(null);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  useEffect(() => {
    if (!key || lookupDone) return;
    const controller = new AbortController();
    api('/orders/checkout/' + key, { signal: controller.signal }).then(order => {
      if (controller.signal.aborted) return;
      sessionStorage.removeItem(checkoutStorage(user));
      navigate('/orders/' + order._id + '/confirmation', { replace: true });
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error.status === 404) { setLookupError(null); setLookupDone(true); }
      else setLookupError(error);
    });
    return () => controller.abort();
  }, [key, lookupDone, lookupAttempt, navigate, user]);
  async function submit(event, cart) {
    event.preventDefault();
    const result = await action.run(async () => {
      const checkoutKey = key || crypto.randomUUID();
      sessionStorage.setItem(checkoutStorage(user), checkoutKey);
      setKey(checkoutKey);
      try {
        return await api('/orders', { method: 'POST', body: {
          checkoutKey, revision: cart.revision, expectedTotalCents: cart.totalCents, delivery: draft,
        } });
      } catch (error) {
        if (error.status === 409) resource.retry();
        throw error;
      }
    });
    if (result) {
      sessionStorage.removeItem(checkoutStorage(user));
      navigate('/orders/' + result._id + '/confirmation', { replace: true });
    }
  }
  const errors = action.error?.fields ?? {};
  const input = name => ({ value: draft[name], onChange: event => {
    const value = event.target.value;
    setDraft(current => ({ ...current, [name]: value }));
  } });
  return <>
    <Link to="/cart" className="back">Back to cart</Link><Heading title="Checkout" />
    {!lookupDone ? lookupError ? <><Feedback error={lookupError} /><button className="button" onClick={() => {
      setLookupError(null); setLookupAttempt(value => value + 1);
    }}>Check previous order again</button></> : <p role="status">Checking for an existing order…</p>
      : <Result resource={resource}>{cart => cart.items.length ? <form className="purchase-layout" onSubmit={event => submit(event, cart)}>
        <section className="panel stack">
          <h2>Delivery details</h2><Feedback error={action.error} form />
          <Field name="delivery.name" label="Recipient name" autoComplete="shipping name" {...input('name')}
            maxLength={100} required error={errors['delivery.name']} />
          <Field name="delivery.phone" label="Phone" type="tel" autoComplete="shipping tel" {...input('phone')}
            maxLength={30} required error={errors['delivery.phone']} />
          <Field name="delivery.address" label="Delivery address" hint="Include the street, barangay, city, and postal code."
            autoComplete="shipping street-address" as="textarea" rows={4} minLength={8} maxLength={500} required
            error={errors['delivery.address']} {...input('address')} />
        </section>
        <aside className="panel summary">
          <h2>Review your order</h2>
          <ul className="summary-lines">{cart.items.map((line, index) => <li key={line.book?._id ?? index}>
            <span>{line.quantity} × {line.book?.title ?? 'Unavailable book'}</span><strong>{money(line.lineTotalCents)}</strong>
          </li>)}</ul>
          <p><strong>Payment method</strong><br />Cash on delivery</p><p className="summary-total"><span>Total</span><strong>{money(cart.totalCents)}</strong></p>
          <p>Review the <Link to="/terms" target="_blank" rel="noopener">Terms and conditions</Link> for delivery and returns.</p>
          <button className="button" disabled={resource.loading || cart.items.some(line => !line.available)} aria-disabled={action.pending}>
            {action.pending ? 'Placing order…' : 'Place order'}
          </button>
          {cart.items.some(line => !line.available) && <p>Return to your cart to fix unavailable items.</p>}
          {action.error?.status === 0 && <p>Retrying will check for your original order before placing another.</p>}
        </aside>
      </form> : <Empty title="Your cart is empty"><Link to="/catalog">Browse the catalog</Link></Empty>}</Result>}
  </>;
}
export function Orders({ admin = false }) {
  const [params, setParams] = useSearchParams();
  const prefix = admin ? '/admin/orders' : '/orders';
  const resource = useResource(prefix + '?' + params);
  return <>
    <Heading title={admin ? 'Manage orders' : 'Order history'} />
    {admin && <div className="table-tools"><Field name="status-filter" as="select" label="Filter by status"
      value={params.get('status') ?? ''} onChange={event => setParams(event.target.value ? { status: event.target.value } : {})}>
      <option value="">All statuses</option>
      {['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].map(status => <option key={status}>{status}</option>)}
    </Field></div>}
    <Result resource={resource}>{data => data.items.length ? <>
      <Table label="Orders" headers={admin ? ['Order', 'Placed', 'Recipient', 'Status', 'Payment', 'Total'] : ['Order', 'Placed', 'Status', 'Payment', 'Total']}>
        {data.items.map(order => <tr key={order._id}>
          <th scope="row"><Link to={prefix + '/' + order._id}>{orderNumber(order._id)}</Link></th>
          <td>{date(order.createdAt)}</td>{admin && <td>{order.delivery.name}</td>}<td><Status value={order.status} /></td>
          <td>{order.paymentStatus}</td><td className="number">{money(order.totalCents)}</td>
        </tr>)}
      </Table>
      <Pager data={data} onChange={page => { const next = new URLSearchParams(params); next.set('page', page); setParams(next); }} />
    </> : <Empty title="No orders found">{!admin && <Link to="/catalog">Browse books</Link>}</Empty>}</Result>
  </>;
}
export function OrderDetail({ admin = false, confirmation = false }) {
  const { id } = useParams();
  const prefix = admin ? '/admin/orders' : '/orders';
  const route = prefix + '/' + id;
  const resource = useResource(route);
  const action = useAction();
  const [cancel, setCancel] = useState(false);
  async function update(status) {
    const updated = await action.run(() => api(route + '/status', { method: 'PATCH', body: { status } }), 'Order status updated.');
    if (updated) { resource.update(updated); setCancel(false); }
  }
  return <>
    <Link to={prefix} className="back">{admin ? 'Back to orders' : 'Order history'}</Link>
    <Result resource={resource}>{order => <>
      <Heading title={confirmation ? 'Order received' : 'Order ' + orderNumber(order._id)}>
        {confirmation ? 'Your order ' + orderNumber(order._id) + ' is in your order history.' : 'Placed ' + date(order.createdAt)}
      </Heading>
      {!cancel && <Feedback error={action.error} notice={action.notice} />}
      <div className="purchase-layout">
        <section>
          <h2>Books ordered</h2>
          <Table label="Order lines" headers={['Book', 'Quantity', 'Unit price', 'Subtotal']}>
            {order.items.map(item => <tr key={item.book}><th scope="row">{item.title}</th><td>{item.quantity}</td>
              <td className="number">{money(item.unitPriceCents)}</td><td className="number">{money(item.unitPriceCents * item.quantity)}</td></tr>)}
          </Table>
          {admin && order.nextStatuses.length > 0 && <form className="status-form" key={order.status} onSubmit={event => {
            event.preventDefault();
            const status = new FormData(event.currentTarget).get('status');
            if (status === 'Cancelled') { action.setError(null); setCancel(true); }
            else update(status);
          }}>
            <Field label="New fulfillment status" name="status" as="select" defaultValue="" required>
              <option value="" disabled>Select a status</option>
              {order.nextStatuses.map(status => <option key={status}>{status}</option>)}
            </Field>
            <button className="button" aria-disabled={action.pending}>{action.pending ? 'Saving…' : 'Update status'}</button>
          </form>}
          {confirmation && <Link className="button secondary" to={'/orders/' + id}>View order details</Link>}
        </section>
        <aside className="panel summary"><h2>Order summary</h2>
          <p><Status value={order.status} /></p>
          <p><strong>Payment</strong><br />{order.paymentMethod} · {order.paymentStatus}</p>
          <p><strong>Deliver to</strong><br />{order.delivery.name}<br />{order.delivery.phone}<br />{order.delivery.address}</p>
          <p className="summary-total"><span>Total</span><strong>{money(order.totalCents)}</strong></p>
        </aside>
      </div>
      {cancel && <Confirm title="Cancel this order?" pending={action.pending} error={action.error} fallbackId="main-content"
        onConfirm={() => update('Cancelled')} onCancel={() => setCancel(false)}>The order will remain in history and its copies will return to stock.</Confirm>}
    </>}</Result>
  </>;
}
