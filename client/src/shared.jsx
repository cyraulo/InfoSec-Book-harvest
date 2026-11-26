import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

export const money = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100);
export const date = value => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value));
export const orderNumber = id => '#' + id.slice(-8).toUpperCase();
export const authors = book => book.authors?.join(', ') || 'Author unavailable';
export function parsePeso(value) {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return NaN;
  const [pesos, centavos = ''] = value.split('.');
  return Number(pesos) * 100 + Number(centavos.padEnd(2, '0'));
}
export function useAction() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  async function run(action, message = '') {
    if (busy.current) return null;
    busy.current = true;
    setPending(true);
    setError(null);
    setNotice('');
    try {
      const result = await action();
      setNotice(typeof message === 'function' ? message(result) : message);
      return result;
    } catch (problem) {
      setError(problem);
      return null;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { run, pending, error, notice, setError };
}
export function Heading({ title, children, action }) {
  return <header className="page-heading"><div><h1>{title}</h1>{children && <p>{children}</p>}</div>{action}</header>;
}
export function Feedback({ error, notice, form = false, prefix = '' }) {
  const summary = useRef(null);
  useEffect(() => {
    if (error && form) summary.current?.focus();
  }, [error, form]);
  return <>
    {error && <div className="feedback error" role="alert" ref={summary} tabIndex={form ? -1 : undefined}>
      {error.message}
      {form && Object.keys(error.fields ?? {}).filter(key => key !== 'form').length > 0 &&
        <ul>{Object.entries(error.fields).filter(([key]) => key !== 'form').map(([key, message]) =>
          <li key={key}><a href={'#' + prefix + key}>{message}</a></li>)}</ul>}
    </div>}
    <div className="announcement" role="status">{notice && <p className="feedback success">{notice}</p>}</div>
  </>;
}
export function Field({ label, name, error, prefix = '', as: Element = 'input', children, hint, ...props }) {
  const id = prefix + name;
  const description = [hint ? id + '-hint' : '', error ? id + '-error' : ''].filter(Boolean).join(' ') || undefined;
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    {hint && <small id={id + '-hint'}>{hint}</small>}
    <Element id={id} name={name} aria-invalid={error ? true : undefined} aria-describedby={description} {...props}>{children}</Element>
    {error && <small className="field-error" id={id + '-error'}>{error}</small>}
  </div>;
}
export function Result({ resource, children, label = 'Loading…' }) {
  if (resource.error) return <div className="empty"><Feedback error={resource.error} />
    <button className="button secondary" onClick={resource.retry}>Try again</button></div>;
  if (!resource.data) return <p className="loading" role="status">{label}</p>;
  return <>{resource.loading && <p role="status" className="sr-only">Refreshing results…</p>}{children(resource.data)}</>;
}
export function Empty({ title, children }) {
  return <section className="empty"><h2>{title}</h2>{children}</section>;
}
export function Cover({ book, eager = false, className = '' }) {
  const [failedPath, setFailedPath] = useState(null);
  return <div className={'cover ' + className}>
    {book.coverPath && failedPath !== book.coverPath
      ? <img alt="" src={book.coverPath} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined}
          decoding="async" onError={() => setFailedPath(book.coverPath)} />
      : <div className="cover-fallback"><BookOpen aria-hidden="true" /><span>Cover unavailable</span></div>}
  </div>;
}
export function BookTile({ book }) {
  const location = useLocation();
  return <article className="book-tile">
    <Link to={'/books/' + book._id} state={{ returnTo: location.pathname + location.search }}>
      <Cover book={book} />
      <h3>{book.title}</h3>
    </Link>
    <p className="book-author">{authors(book)}</p>
    <div className="book-meta"><strong>{money(book.priceCents)}</strong><Availability book={book} /></div>
  </article>;
}
export function Availability({ book }) {
  return <span className={'availability ' + (book.archived || !book.stock ? 'unavailable' : '')}>
    {book.archived ? 'Archived' : book.stock ? 'In stock' : 'Out of stock'}
  </span>;
}
export function Status({ value }) {
  return <span className={'status status-' + value.toLowerCase()}>{value}</span>;
}
export function Pager({ data, onChange }) {
  if (data.pages <= 1) return null;
  return <nav className="pagination" aria-label="Result pages">
    <button className="button secondary" disabled={data.page <= 1} onClick={() => onChange(data.page - 1)}>
      <ChevronLeft size={17} aria-hidden="true" /> Previous
    </button>
    <span>Page {data.page} of {data.pages}</span>
    <button className="button secondary" disabled={data.page >= data.pages} onClick={() => onChange(data.page + 1)}>
      Next <ChevronRight size={17} aria-hidden="true" />
    </button>
  </nav>;
}
export function Table({ label, headers, children }) {
  return <div tabIndex={0} className="table-wrap" role="region" aria-label={label}>
    <table><caption className="sr-only">{label}</caption>
      <thead><tr>{headers.map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>;
}
export function Confirm({ title, children, onCancel, onConfirm, pending, error, fallbackId }) {
  const dialog = useRef(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element.showModal();
    element.querySelector('button').focus();
    return () => {
      if (element.open) element.close();
      requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus();
        else if (fallbackId) document.getElementById(fallbackId)?.focus();
      });
    };
  }, [fallbackId]);
  function containFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <dialog ref={dialog} aria-labelledby={id} onKeyDown={containFocus}
    onCancel={event => { event.preventDefault(); if (!pending) onCancel(); }}>
    <h2 id={id}>{title}</h2><p>{children}</p><Feedback error={error} />
    <div className="actions">
      <button className="button secondary" disabled={pending} onClick={onCancel}>Keep it</button>
      <button className="button danger" aria-disabled={pending} onClick={onConfirm}>{pending ? 'Removing…' : 'Confirm removal'}</button>
    </div>
  </dialog>;
}
