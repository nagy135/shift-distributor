"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { UserRole } from "@/lib/roles";

export class AuthRedirectError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthRedirectError";
  }
}

type User = {
  id: number;
  email: string;
  role: UserRole;
  admin: boolean;
  doctorId: number | null;
} | null;

type AuthContextValue = {
  user: User;
  accessToken: string | null;
  isLoading: boolean;
  reloadUser: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMe = useCallback(async (token: string) => {
    const me = await fetchJson<{
      id: number;
      email: string;
      role: UserRole;
      admin: boolean;
      doctorId: number | null;
    }>("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(me);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const { accessToken: newToken } = await fetchJson<{
        accessToken: string;
      }>("/api/auth/refresh", {
        method: "POST",
      });
      setAccessToken(newToken);
      await loadMe(newToken);
      return newToken;
    } catch {
      setUser(null);
      setAccessToken(null);
      return null;
    }
  }, [loadMe]);

  const reloadUser = useCallback(async () => {
    if (!accessToken) {
      setUser(null);
      return;
    }

    await loadMe(accessToken);
  }, [accessToken, loadMe]);

  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  useEffect(() => {
    // Attempt to refresh on mount
    (async () => {
      await refreshAccessToken();
      setIsLoading(false);
    })();
  }, [refreshAccessToken]);

  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(
      () => {
        refreshAccessToken().catch(() => {});
      },
      1000 * 60 * 4,
    );
    return () => clearInterval(interval);
  }, [accessToken, refreshAccessToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken: token } = await fetchJson<{ accessToken: string }>(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      setAccessToken(token);
      await loadMe(token);
    },
    [loadMe],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await fetchJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    await fetchJson("/api/auth/logout", { method: "POST" });
    clearAuth();
  }, [clearAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      reloadUser,
      refreshAccessToken,
      clearAuth,
      login,
      register,
      logout,
    }),
    [
      user,
      accessToken,
      isLoading,
      reloadUser,
      refreshAccessToken,
      clearAuth,
      login,
      register,
      logout,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
