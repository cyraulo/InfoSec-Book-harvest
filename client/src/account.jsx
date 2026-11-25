import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api';
import { Feedback, Field, Heading, useAction } from './shared';

const Account = createContext(null);
export const useAccount = () => useContext(Account);
export function AccountProvider({ children }) {
  const [session, setSession] = useState({ loading: true, user: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const expire = () => setSession({ loading: false, user: null });
    window.addEventListener('folio-session-expired', expire);
    api('/profile', { signal: controller.signal }).then(user => {
      if (!controller.signal.aborted) setSession({ loading: false, user });
    }).catch(error => {
      if (!controller.signal.aborted && error.status !== 401) setSession({ loading: false, user: null, error });
    });
    return () => {
      controller.abort();
      window.removeEventListener('folio-session-expired', expire);
    };
  }, [attempt]);
  const setUser = user => setSession({ loading: false, user });
  return <Account.Provider value={{ ...session, setUser, retry: () => setAttempt(value => value + 1) }}>{children}</Account.Provider>;
}
export function Guard({ role }) {
  const { user, loading, error, retry } = useAccount();
  const location = useLocation();
  if (loading) return <p role="status">Checking your session…</p>;
  if (error) return <><Feedback error={error} /><button className="button" onClick={retry}>Retry session check</button></>;
  if (!user) return <Navigate to="/login" replace state={{ returnTo: location.pathname + location.search, required: true }} />;
  if (role && user.role !== role) return <><Heading title="Access restricted" /><Link to="/catalog">Browse the catalog</Link></>;
  return <Outlet />;
}
export function AuthPage({ register = false }) {
  const { user, setUser } = useAccount();
  const action = useAction();
  const navigate = useNavigate();
  const { state } = useLocation();
  const returnTo = typeof state?.returnTo === 'string' && /^\/(?!\/)/.test(state.returnTo) ? state.returnTo : '/catalog';
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : returnTo} replace />;
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const account = await action.run(() => api(register ? '/auth/register' : '/auth/login', { method: 'POST', body: values }));
    if (account) {
      setUser(account);
      navigate(account.role === 'admin' ? '/admin' : returnTo, { replace: true,
        state: { notice: register ? 'Account created.' : 'Signed in.' } });
    }
  }
  const errors = action.error?.fields ?? {};
  return <div className="narrow">
    <Heading title={register ? 'Create your account' : 'Sign in'} />
    {state?.required && <p>Sign in to continue to your requested page.</p>}
    <form className="panel stack" onSubmit={submit}>
      <Feedback error={action.error} form />
      {register && <Field name="name" label="Full name" autoComplete="name" required maxLength={100} error={errors.name} />}
      <Field name="email" label="Email" type="email" autoComplete="email" required maxLength={254} error={errors.email} />
      <Field name="password" label="Password" type="password" autoComplete={register ? 'new-password' : 'current-password'}
        hint={register ? 'Use at least 10 characters.' : undefined} minLength={register ? 10 : undefined} maxLength={128}
        required error={errors.password} />
      <button className="button" aria-disabled={action.pending}>{action.pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
    </form>
    <p>{register ? 'Already have an account? ' : 'New to Folio? '}
      <Link to={register ? '/login' : '/register'} state={state}>{register ? 'Sign in' : 'Create an account'}</Link>
    </p>
  </div>;
}
export function ProfilePage() {
  const { user, setUser } = useAccount();
  const action = useAction();
  async function submit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const updated = await action.run(() => api('/profile', { method: 'PATCH', body }), 'Profile saved.');
    if (updated) setUser(updated);
  }
  return <div className="narrow">
    <Heading title="Your profile" />
    <form className="panel stack" onSubmit={submit}>
      <Feedback error={action.error} notice={action.notice} form />
      <Field name="email" label="Email" value={user.email} disabled />
      <Field name="name" label="Full name" defaultValue={user.name} autoComplete="name" required maxLength={100} error={action.error?.fields.name} />
      <Field name="phone" label="Phone (optional)" defaultValue={user.phone} type="tel" autoComplete="tel" maxLength={30} error={action.error?.fields.phone} />
      <button className="button" aria-disabled={action.pending}>{action.pending ? 'Saving…' : 'Save profile'}</button>
    </form>
  </div>;
}
