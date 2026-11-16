import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { STORAGE_KEYS, getItem, setItem, getJSON as storageGetJSON, setJSON } from '../../utils/storage';
import { uint8ToBase64 } from '../../utils/base64';

const DEFAULT_PORT = 5000;

function devMachineIp(): string | null {
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri && !hostUri.startsWith('localhost')) {
      return hostUri.split(':')[0];
    }
  } catch {
    // fall through to platform default
  }
  return null;
}

export function defaultApiBaseUrl(): string {
  const host = devMachineIp() || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
  return `http://${host}:${DEFAULT_PORT}/api`;
}

let apiBaseUrl: string | null = null;
let baseUrlReady = false;

export async function initApiBaseUrl(): Promise<void> {
  const stored = await getItem(STORAGE_KEYS.apiBaseUrl);
  apiBaseUrl = stored || defaultApiBaseUrl();
  baseUrlReady = true;
}

export const setApiBaseUrl = (url: string | null) => {
  apiBaseUrl = url && url.trim() ? url.trim().replace(/\/+$/, '') : defaultApiBaseUrl();
  setItem(STORAGE_KEYS.apiBaseUrl, apiBaseUrl);
};

export const getApiBaseUrl = (): string => apiBaseUrl || defaultApiBaseUrl();

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

// Called when a request bearing a token comes back 401 (expired/revoked
// session). AuthContext registers this so a dead session bounces to Login.
let onUnauthorized: (() => void) | null = null;
let unauthorizedFired = false;

export const setOnUnauthorized = (handler: (() => void) | null) => {
  onUnauthorized = handler;
  unauthorizedFired = false;
};

export function handleUnauthorized(res: Response): boolean {
  if (res.status !== 401 || !authToken) return false;
  if (unauthorizedFired) return true;
  unauthorizedFired = true;
  try {
    onUnauthorized?.();
  } catch {
    // ignore
  }
  setTimeout(() => {
    unauthorizedFired = false;
  }, 5000);
  return true;
}

export function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(extra || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return headers;
}

export type Fallback<T> = T | (() => T);

function resolveFallback<T>(fallback: Fallback<T>): T {
  return typeof fallback === 'function' ? (fallback as () => T)() : fallback;
}

// ----------------------------------------------------------------
// OFFLINE CACHE ΓÇö stale-while-revalidate
// Screens render instantly from the last-known payload (memory first, device
// storage on cold start) and stay usable fully offline. Any successful write
// invalidates the memory layer so freshly-created data is never shadowed.
// ----------------------------------------------------------------
const CACHE_PREFIX = '@studylens_cache_';
const apiMemoryCache = new Map<string, unknown>();

const cacheKeyFor = (path: string): string => path.replace(/[^a-zA-Z0-9]+/g, '_');

export function invalidateApiCache(): void {
  apiMemoryCache.clear();
}

async function readDiskCache<T>(key: string): Promise<T | null> {
  try {
    return await storageGetJSON<T>(CACHE_PREFIX + key);
  } catch {
    return null;
  }
}

async function writeDiskCache(key: string, data: unknown): Promise<void> {
  try {
    await setJSON(CACHE_PREFIX + key, data);
  } catch {
    // storage full/unavailable ΓÇö memory cache still works
  }
}

async function revalidate(path: string, key: string): Promise<void> {
  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, { headers: buildHeaders() });
    if (handleUnauthorized(res)) return;
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data) && data.length === 0) return;
    apiMemoryCache.set(key, data);
    void writeDiskCache(key, data);
  } catch {
    // offline ΓÇö keep serving the cached copy
  }
}

export async function getJSON<T>(path: string, fallback: Fallback<T>): Promise<T> {
  const key = cacheKeyFor(path);

  // Instant render: serve the in-memory copy from an earlier visit and
  // quietly refresh it in the background.
  if (apiMemoryCache.has(key)) {
    const cached = apiMemoryCache.get(key) as T;
    void revalidate(path, key);
    return cached;
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, { headers: buildHeaders() });
    if (handleUnauthorized(res)) return resolveFallback(fallback);
    if (res.ok) {
      const data = await res.json();
      // Respect the server's answer as the source of truth: an empty list is a
      // real (empty DB / no visits) result and must NOT be replaced with demo
      // data. Demo fallback below is only for genuine network failure/offline.
      apiMemoryCache.set(key, data);
      void writeDiskCache(key, data);
      return data;
    }
  } catch (err) {
    console.warn(`[Mobile] API offline at ${getApiBaseUrl()}${path}, using local demo data`);
  }

  // Offline / cold start: prefer the last-known payload over demo data.
  const disk = await readDiskCache<T>(key);
  if (disk !== null) return disk;
  return resolveFallback(fallback);
}

export async function postJSON<T>(path: string, body: unknown, fallback: Fallback<T>, signal?: AbortSignal): Promise<T> {
  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
      signal,
    });
    if (handleUnauthorized(res)) return resolveFallback(fallback);
    if (res.ok) {
      invalidateApiCache();
      const data = await res.json();
      if (data === null || data === undefined) return resolveFallback(fallback);
      return data;
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    console.warn(`[Mobile] API offline at ${getApiBaseUrl()}${path}, using local demo data`);
  }
  return resolveFallback(fallback);
}

export async function postForm<T>(path: string, form: FormData, fallback: Fallback<T>): Promise<T> {
  try {
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: form,
    });
    if (handleUnauthorized(res)) return resolveFallback(fallback);
    if (res.ok) {
      invalidateApiCache();
      const data = await res.json();
      if (data === null || data === undefined) return resolveFallback(fallback);
      return data;
    }
  } catch (err) {
    console.warn(`[Mobile] Upload API offline at ${getApiBaseUrl()}${path}, using local demo data`);
  }
  return resolveFallback(fallback);
}

export const offlineError = (path: string): never => {
  throw new Error(`Couldn't reach the StudyLens server at ${getApiBaseUrl()}${path}. Make sure the backend is running (0.0.0.0:5000) and your phone is on the same network as the computer. You can also set a Server URL on the login screen.`);
};

export async function mutateJSON<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: buildHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `Couldn't reach the StudyLens server at ${getApiBaseUrl()}. Check that the backend is running and your phone is on the same network.`
    );
  }
  if (handleUnauthorized(res)) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { error?: string }).error || `Request to ${path} failed (${res.status}).`);
  }
  invalidateApiCache();
  return (res.status === 204 ? {} : await res.json()) as T;
}

export * from './types';
