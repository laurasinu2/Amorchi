import { useCallback, useEffect, useState } from 'react';

export type Account = { id: string; email: string; display_name: string; created_at: string };
type Tokens = { access_token: string; expires_in: number };
type AuthPayload = { email: string; password: string; remember: boolean };
const api = '/api/v1';

async function request<T>(path: string, body?: object, token?: string): Promise<T> {
  const response = await fetch(api + path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  if (!response.ok) {
    let message = 'No se pudo conectar con Memrly.';
    try {
      const data = await response.json() as { detail?: string | { msg: string }[] };
      if (typeof data.detail === 'string') message = data.detail;
      else if (Array.isArray(data.detail)) message = data.detail.map(item => item.msg).join('. ');
    } catch { /* Network and invalid-response errors fall back to the generic message. */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function useAccount() {
  const [user, setUser] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const accept = useCallback(async (tokens: Tokens) => {
    const next = await request<Account>('/auth/me', undefined, tokens.access_token);
    setToken(tokens.access_token);
    setUser(next);
  }, []);

  useEffect(() => {
    // Only the HttpOnly cookie persists. Never store access tokens in localStorage.
    request<Tokens>('/account/refresh', {}).then(accept).catch(() => {
      setToken(null); setUser(null);
    }).finally(() => setChecking(false));
  }, [accept]);

  async function login(credentials: AuthPayload) {
    const tokens = await request<Tokens>('/account/login', credentials);
    await accept(tokens);
  }
  async function logout() {
    await request('/account/logout', {});
    setToken(null); setUser(null);
  }

  return { user, token, checking, login, logout };
}

export function accountRequest(path: string, body: object) {
  return request<{message: string}>('/account/' + path, body);
}
