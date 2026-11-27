import { useEffect, useState } from 'react';

export class RequestError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
export async function api(route, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch('/api' + route, {
      method, signal, credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new RequestError('Could not reach the bookstore. Check your connection and try again.', 0);
  }
  if (response.status === 204) return true;
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    if (response.status >= 500) {
      throw new RequestError('The bookstore is temporarily unavailable. Please try again shortly.', response.status);
    }
    if (response.status === 401 && !signal?.aborted && !route.startsWith('/auth/')) {
      window.dispatchEvent(new Event('folio-session-expired'));
    }
    throw new RequestError(data?.error?.message ?? 'The bookstore is temporarily unavailable.', response.status, data?.error?.fields);
  }
  return data;
}
export function useResource(route) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ route: null, attempt: -1 });
  useEffect(() => {
    if (!route) return;
    const controller = new AbortController();
    api(route, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ route, attempt, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ route, attempt, error });
    });
    return () => controller.abort();
  }, [route, attempt]);
  const current = result.route === route;
  return {
    data: current ? result.data : undefined,
    error: current && result.attempt === attempt ? result.error : undefined,
    loading: Boolean(route && (!current || result.attempt !== attempt)),
    retry: () => setAttempt(value => value + 1),
    update: data => setResult({ route, attempt, data }),
  };
}
