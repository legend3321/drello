import type { AuthTokens, User } from "@/types/auth";

import { AUTH_COOKIE } from "@/lib/auth-constants";

const STORAGE_KEY = "drello_auth";
const LEGACY_AUTH_COOKIE = "authenticated";

export type StoredAuth = {
  user: User;
  tokens: AuthTokens;
};

export function loadStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function saveStoredAuth(auth: StoredAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function clearStoredAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${LEGACY_AUTH_COOKIE}=; path=/; max-age=0`;
}

/** Drop route-guard cookies when there is no saved session (e.g. after rename or logout). */
export function syncAuthCookie(): void {
  if (typeof window === "undefined") return;
  if (loadStoredAuth()) return;
  clearStoredAuth();
}

export function getAccessToken(): string | null {
  return loadStoredAuth()?.tokens.access ?? null;
}

export function getRefreshToken(): string | null {
  return loadStoredAuth()?.tokens.refresh ?? null;
}
