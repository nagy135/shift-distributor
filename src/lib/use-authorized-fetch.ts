"use client";

import { AuthRedirectError, useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

function withBearerToken(init: RequestInit | undefined, token: string) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return {
    ...init,
    headers,
  } satisfies RequestInit;
}

export function useAuthorizedFetch() {
  const router = useRouter();
  const { accessToken, refreshAccessToken, clearAuth, getSessionGeneration } =
    useAuth();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const generation = getSessionGeneration();
      const ensureCurrentSession = () => {
        if (generation !== getSessionGeneration())
          throw new AuthRedirectError();
      };
      const redirectToLogin = (): never => {
        ensureCurrentSession();
        clearAuth();
        router.replace("/login");
        throw new AuthRedirectError();
      };

      let token = accessToken;

      if (!token) {
        token = await refreshAccessToken();
      }

      ensureCurrentSession();
      if (!token) {
        redirectToLogin();
      }

      const activeToken = token as string;
      let response = await fetch(input, withBearerToken(init, activeToken));

      ensureCurrentSession();
      if (response.status !== 401) {
        return response;
      }

      token = await refreshAccessToken();
      if (!token) {
        redirectToLogin();
      }

      ensureCurrentSession();
      const refreshedToken = token as string;
      response = await fetch(input, withBearerToken(init, refreshedToken));

      ensureCurrentSession();
      if (response.status === 401) {
        redirectToLogin();
      }

      return response;
    },
    [accessToken, clearAuth, refreshAccessToken, getSessionGeneration, router],
  );
}
