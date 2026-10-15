const TOKEN_KEY = "studylens_token";

export const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage unavailable (private mode) - session still works in-memory
  }
};

export const authHeaders = (extra?: Record<string, string>): Record<string, string> => {
  const headers: Record<string, string> = { ...(extra || {}) };
  const token = getStoredToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

let _loggedOut = false;

export const authFetch = (url: string, options?: RequestInit): Promise<Response> => {
  const headers = new Headers(options?.headers);
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers }).then((response) => {
    if (response.status === 401 && !_loggedOut && token) {
      _loggedOut = true;
      setStoredToken(null);
      try {
        localStorage.removeItem("studylens_user");
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent("auth:session-expired"));
      setTimeout(() => { _loggedOut = false; }, 5000);
    }
    return response;
  });
};
