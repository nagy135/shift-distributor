"use client";

import type { UserRole } from "@/lib/roles";
import { useQueryClient } from "@tanstack/react-query";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  getSessionGeneration: () => number;
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
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const generation = useRef(0);
  const currentUser = useRef<User>(null);
  const refreshFlight = useRef<Promise<string | null> | null>(null);
  const getSessionGeneration = useCallback(() => generation.current, []);
  const clearAuth = useCallback(() => {
    generation.current += 1;
    refreshFlight.current = null;
    currentUser.current = null;
    void queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
    setAccessToken(null);
  }, [queryClient]);
  const loadMe = useCallback(
    async (token: string, expectedGeneration = generation.current) => {
      const me = await fetchJson<NonNullable<User>>("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (generation.current !== expectedGeneration)
        throw new AuthRedirectError();
      const previous = currentUser.current;
      if (
        previous &&
        (previous.id !== me.id ||
          previous.role !== me.role ||
          previous.admin !== me.admin ||
          previous.doctorId !== me.doctorId)
      ) {
        generation.current += 1;
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      currentUser.current = me;
      setUser(me);
    },
    [queryClient],
  );
  const refreshAccessToken = useCallback(() => {
    if (refreshFlight.current) return refreshFlight.current;
    const expected = generation.current;
    const flight = (async () => {
      try {
        const { accessToken: token } = await fetchJson<{ accessToken: string }>(
          "/api/auth/refresh",
          { method: "POST" },
        );
        if (expected !== generation.current) return null;
        await loadMe(token, expected);
        setAccessToken(token);
        return token;
      } catch {
        if (expected === generation.current) clearAuth();
        return null;
      }
    })();
    refreshFlight.current = flight;
    void flight.finally(() => {
      if (refreshFlight.current === flight) refreshFlight.current = null;
    });
    return flight;
  }, [clearAuth, loadMe]);
  const reloadUser = useCallback(async () => {
    if (accessToken) await loadMe(accessToken);
  }, [accessToken, loadMe]);
  useEffect(() => {
    void refreshAccessToken().finally(() => setIsLoading(false));
  }, [refreshAccessToken]);
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(
      () => {
        void refreshAccessToken();
      },
      4 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [accessToken, refreshAccessToken]);
  const login = useCallback(
    async (email: string, password: string) => {
      clearAuth();
      const expected = generation.current;
      const { accessToken: token } = await fetchJson<{ accessToken: string }>(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      if (expected !== generation.current) throw new AuthRedirectError();
      await loadMe(token, expected);
      setAccessToken(token);
    },
    [clearAuth, loadMe],
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
    clearAuth();
    await fetchJson("/api/auth/logout", { method: "POST" });
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
      getSessionGeneration,
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
      getSessionGeneration,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
