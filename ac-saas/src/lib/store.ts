import type { AuthUser } from "./api";

export type { AuthUser as User };

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("bt_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser) {
  localStorage.setItem("bt_user", JSON.stringify(user));
}

export function setToken(token: string) {
  localStorage.setItem("bt_token", token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bt_token");
}

export function clearUser() {
  localStorage.removeItem("bt_user");
  localStorage.removeItem("bt_token");
}

export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
