import { create } from "zustand";

import { API_URL } from "@/lib/config";
import {
  clearStoredAuth,
  getRefreshToken,
  loadStoredAuth,
  saveStoredAuth,
  syncAuthCookie,
} from "@/lib/auth-storage";
import type {
  AuthTokens,
  LoginCredentials,
  RegisterCredentials,
  User,
} from "@/types/auth";

type AuthState = {
  user: User | null;
  tokens: AuthTokens | null;
  initialized: boolean;
  loading: boolean;
  hydrate: () => void;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
  updateProfile: (data: { email?: string; avatar_emoji?: string }) => Promise<User>;
};

function parseApiError(body: unknown, fallback: string): string {

  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  const messages: string[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      messages.push(`${field}: ${value.join(", ")}`);
    } else if (typeof value === "string") {
      messages.push(value);
    }
  }
  return messages.length > 0 ? messages.join(" ") : fallback;
}

async function fetchTokens(username: string, password: string): Promise<AuthTokens> {
  const response = await fetch(`${API_URL}/api/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseApiError(body, "Invalid username or password"));
  }
  return body as AuthTokens;
}

async function fetchMe(access: string): Promise<User> {
  const response = await fetch(`${API_URL}/api/auth/me/`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseApiError(body, "Could not load profile"));
  }
  return body as User;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  initialized: false,
  loading: false,

  hydrate: () => {
    syncAuthCookie();
    const stored = loadStoredAuth();
    if (stored) {
      set({ user: stored.user, tokens: stored.tokens, initialized: true });
    } else {
      set({ user: null, tokens: null, initialized: true });
    }
  },

  login: async (credentials) => {
    set({ loading: true });
    try {
      const tokens = await fetchTokens(credentials.username, credentials.password);
      const user = await fetchMe(tokens.access);
      saveStoredAuth({ user, tokens });
      set({ user, tokens, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  register: async (credentials) => {
    set({ loading: true });
    try {
      const response = await fetch(`${API_URL}/api/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseApiError(body, "Registration failed"));
      }
      await get().login({
        username: credentials.username,
        password: credentials.password,
      });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  logout: () => {
    clearStoredAuth();
    set({ user: null, tokens: null });
  },

  refreshAccessToken: async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;

    const response = await fetch(`${API_URL}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    if (!response.ok) {
      get().logout();
      return false;
    }

    const data = (await response.json()) as { access: string };
    const stored = loadStoredAuth();
    if (!stored) return false;

    const tokens = { access: data.access, refresh: stored.tokens.refresh };
    saveStoredAuth({ user: stored.user, tokens });
    set({ tokens });
    return true;
  },

  updateProfile: async (data) => {
    const tokens = get().tokens;
    if (!tokens) throw new Error("Not authenticated");

    set({ loading: true });
    try {
      const response = await fetch(`${API_URL}/api/auth/me/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify(data),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(parseApiError(body, "Profile update failed"));
      }
      
      const updatedUser = body as User;
      saveStoredAuth({ user: updatedUser, tokens });
      set({ user: updatedUser, loading: false });
      return updatedUser;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },
}));
