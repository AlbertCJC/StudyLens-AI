export interface BackendInfo {
  platformName?: string;
  version?: string;
  institution?: string;
  degree?: string;
  techStack?: Record<string, string>;
  database?: string;
}

export interface ProbeResult {
  ok: boolean;
  url: string;
  latency?: number;
  info?: BackendInfo;
  error?: string;
}

const PROBE_TIMEOUT_MS = 6000;

export async function probeUrl(url: string): Promise<ProbeResult> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const latency = Math.round(performance.now() - started);
    if (!res.ok) {
      return { ok: false, url, latency, error: `HTTP ${res.status} ${res.statusText}` };
    }
    const info = (await res.json()) as BackendInfo;
    return { ok: true, url, latency, info };
  } catch (err) {
    return {
      ok: false,
      url,
      error: err instanceof Error ? err.message : "Network / CORS error",
    };
  } finally {
    clearTimeout(timer);
  }
}

export const remoteStorageKey = "studylens_remote_api_endpoint";

export const loadRemoteEndpoint = (): string => {
  try {
    return localStorage.getItem(remoteStorageKey) || "";
  } catch {
    return "";
  }
};

export const saveRemoteEndpoint = (endpoint: string): void => {
  try {
    if (endpoint) localStorage.setItem(remoteStorageKey, endpoint);
    else localStorage.removeItem(remoteStorageKey);
  } catch (err) {
    console.warn("Unable to persist remote endpoint", err);
  }
};

export const appendSystemPath = (baseUrl: string): string =>
  `${baseUrl.replace(/\/+$/, "")}/api/system/info`;

export const probeEndpoint = (baseUrl: string): string => appendSystemPath(baseUrl);