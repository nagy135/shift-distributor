"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type User = { id: number; email: string } | null;

type AuthContextValue = {
  user: User;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMe = useCallback(async (token: string) => {
    const me = await fetchJson<{ id: number; email: string }>("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(me);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const { accessToken: newToken } = await fetchJson<{ accessToken: string }>("/api/auth/refresh", {
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

  useEffect(() => {
    // Attempt to refresh on mount
    (async () => {
      await refreshAccessToken();
      setIsLoading(false);
    })();
  }, [refreshAccessToken]);

  // Token refresh loop (optional)
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      refreshAccessToken().catch(() => { });
    }, 1000 * 60 * 10); // every 10 minutes
    return () => clearInterval(interval);
  }, [accessToken, refreshAccessToken]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken: token } = await fetchJson<{ accessToken: string }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(token);
    await loadMe(token);
  }, [loadMe]);

  const register = useCallback(async (email: string, password: string) => {
    await fetchJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    await login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    await fetchJson("/api/auth/logout", { method: "POST" });
    setUser(null);
    setAccessToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, accessToken, isLoading, login, register, logout }), [user, accessToken, isLoading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


