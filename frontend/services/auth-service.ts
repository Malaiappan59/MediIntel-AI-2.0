import { deleteCookie, getCookie, setCookie } from "@/lib/cookies";
import { ROLE_COOKIE, SESSION_COOKIE, USER_COOKIE } from "@/lib/constants";
import type { AuthState, LoginPayload } from "@/types/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_PATH ?? "/api/backend/v1";
const STORAGE_KEY = "medintel-auth";

type AuthApiResponse = {
  user: {
    id: number;
    username: string;
    full_name: string;
    email: string;
    role: AuthState["role"];
    permissions: string[];
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
};

const emptyAuthState: AuthState = {
  isAuthenticated: false,
  role: null,
  username: null,
  email: null,
  token: null,
  refreshToken: null,
  permissions: [],
};

function isFormDataBody(body: BodyInit | null | undefined): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = "Request failed.";
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? detail;
    } catch {
      detail = response.statusText || detail;
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

function persistAuthState(nextState: AuthState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  if (nextState.token) {
    setCookie(SESSION_COOKIE, nextState.token, { days: 1 });
  }
  if (nextState.role) {
    setCookie(ROLE_COOKIE, nextState.role, { days: 1 });
  }
  if (nextState.username) {
    setCookie(USER_COOKIE, nextState.username, { days: 1 });
  }
}

function normalizeAuthState(response: AuthApiResponse): AuthState {
  return {
    isAuthenticated: true,
    role: response.user.role,
    username: response.user.full_name,
    email: response.user.email,
    token: response.tokens.access_token,
    refreshToken: response.tokens.refresh_token,
    permissions: response.user.permissions,
  };
}

async function refreshTokens(refreshToken: string): Promise<AuthState> {
  const response = await fetch(`${API_BASE}/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  const payload = await parseResponse<AuthApiResponse>(response);
  const nextState = normalizeAuthState(payload);
  persistAuthState(nextState);
  return nextState;
}

export async function login(payload: LoginPayload): Promise<AuthState> {
  const response = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await parseResponse<AuthApiResponse>(response);
  const nextState = normalizeAuthState(data);
  persistAuthState(nextState);
  return nextState;
}

export async function logout(): Promise<void> {
  const authState = getStoredAuthState();
  if (authState.refreshToken) {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: authState.refreshToken }),
        cache: "no-store",
      });
    } catch {
      // Swallow network errors so the client can still clear local state.
    }
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  deleteCookie(SESSION_COOKIE);
  deleteCookie(ROLE_COOKIE);
  deleteCookie(USER_COOKIE);
}

export function getStoredAuthState(): AuthState {
  if (typeof window === "undefined") {
    return emptyAuthState;
  }

  const storedValue = window.localStorage.getItem(STORAGE_KEY);
  if (storedValue) {
    try {
      const parsed = {
        ...emptyAuthState,
        ...(JSON.parse(storedValue) as Partial<AuthState>),
      };
      return {
        ...parsed,
        isAuthenticated: Boolean(parsed.token),
      };
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  const token = getCookie(SESSION_COOKIE);
  const role = getCookie(ROLE_COOKIE);
  const username = getCookie(USER_COOKIE);

  if (!token) {
    return emptyAuthState;
  }

  return {
    isAuthenticated: true,
    role: role as AuthState["role"],
    username,
    email: null,
    token,
    refreshToken: null,
    permissions: [],
  };
}

export async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const authState = getStoredAuthState();
  const headers = new Headers(init?.headers ?? {});
  if (init?.body != null && !isFormDataBody(init.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authState.token) {
    headers.set("Authorization", `Bearer ${authState.token}`);
  }

  let response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 401 && authState.refreshToken) {
    const refreshed = await refreshTokens(authState.refreshToken);
    const retryHeaders = new Headers(init?.headers ?? {});
    if (init?.body != null && !isFormDataBody(init.body) && !retryHeaders.has("Content-Type")) {
      retryHeaders.set("Content-Type", "application/json");
    }
    retryHeaders.set("Authorization", `Bearer ${refreshed.token}`);
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: retryHeaders,
      cache: "no-store",
    });
  }

  return response;
}

export function getEmptyAuthState(): AuthState {
  return emptyAuthState;
}
