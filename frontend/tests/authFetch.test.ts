import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { authFetch, authHeaders, setCsrfToken } from '../src/utils/authFetch';

const clearCsrfCookie = () => {
  document.cookie = 'studylens_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
};

describe('authFetch utils', () => {
  beforeEach(() => {
    setCsrfToken(null);
    clearCsrfCookie();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCsrfCookie();
    setCsrfToken(null);
  });

  it('reads the CSRF cookie even when it is not the first cookie', () => {
    document.cookie = 'alpha=1; path=/';
    document.cookie = 'studylens_csrf=mid-string-token; path=/';
    document.cookie = 'omega=2; path=/';

    const headers = authHeaders({}, 'POST');
    expect(headers['X-CSRF-Token']).toBe('mid-string-token');
  });

  it('prefers the readable cookie over a stale in-memory token', () => {
    setCsrfToken('stale-memory-token');
    document.cookie = 'studylens_csrf=fresh-cookie-token; path=/';

    const headers = authHeaders({}, 'DELETE');
    expect(headers['X-CSRF-Token']).toBe('fresh-cookie-token');
  });

  it('falls back to the in-memory token when the cookie is absent', () => {
    setCsrfToken('memory-token');

    const headers = authHeaders({}, 'PATCH');
    expect(headers['X-CSRF-Token']).toBe('memory-token');
  });

  it('adds the CSRF header to authFetch for unsafe methods', async () => {
    document.cookie = 'studylens_csrf=fetch-cookie-token; path=/';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await authFetch('/api/example', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('X-CSRF-Token')).toBe('fetch-cookie-token');
  });
  it('does not add CSRF token when no cookie is present', () => {
    const headers = authHeaders({}, 'POST');
    expect(headers['X-CSRF-Token']).toBeUndefined();
  });

  it('does not add CSRF token for GET requests even without cookie', () => {
    const headers = authHeaders({}, 'GET');
    expect(headers['X-CSRF-Token']).toBeUndefined();
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('includes extra headers passed to authHeaders', () => {
    const headers = authHeaders({ 'Content-Type': 'application/json' }, 'POST');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-CSRF-Token']).toBeUndefined();
  });

  it('returns empty object when no arguments provided', () => {
    const headers = authHeaders({}, 'GET');
    expect(headers).toEqual({});
  });

  it('includes custom headers passed to authHeaders', () => {
    const headers = authHeaders({ 'X-Custom-Header': 'custom-value' }, 'GET');
    expect(headers['X-Custom-Header']).toBe('custom-value');
  });

  it('refreshes an expired session and retries the original request once', async () => {
    const expired = vi.fn();
    window.addEventListener('auth:session-expired', expired);
    let originalCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/auth/refresh') {
        return Promise.resolve(new Response(JSON.stringify({ csrfToken: 'refreshed-csrf' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      originalCalls += 1;
      if (originalCalls === 1) {
        return Promise.resolve(new Response(JSON.stringify({ code: 'INVALID_TOKEN' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }));
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await authFetch('/api/users/usr-1', { method: 'PUT' });

    expect(response.status).toBe(200);
    expect(originalCalls).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect(new Headers(retryInit.headers).get('X-CSRF-Token')).toBe('refreshed-csrf');
    expect(expired).not.toHaveBeenCalled();
    window.removeEventListener('auth:session-expired', expired);
  });

  it('expires the session when the refresh attempt fails', async () => {
    const expired = vi.fn();
    window.addEventListener('auth:session-expired', expired);
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/auth/refresh') {
        return Promise.resolve(new Response('{}', { status: 401 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ code: 'INVALID_TOKEN' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await authFetch('/api/users/usr-1', { method: 'PUT' });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:session-expired', expired);
  });

  it('does not refresh or log out on a non-session 401', async () => {
    const expired = vi.fn();
    window.addEventListener('auth:session-expired', expired);
    const fetchMock = vi.fn(() => Promise.resolve(new Response(
      JSON.stringify({ code: 'INVALID_CURRENT_PASSWORD' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )));
    vi.stubGlobal('fetch', fetchMock);

    const response = await authFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'wrong' }),
    });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
    window.removeEventListener('auth:session-expired', expired);
  });
});
