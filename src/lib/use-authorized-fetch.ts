"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { AuthRedirectError, useAuth } from "@/lib/auth-client";

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
  const { accessToken, refreshAccessToken, clearAuth } = useAuth();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const redirectToLogin = (): never => {
        clearAuth();
        router.replace("/login");
        throw new AuthRedirectError();
      };

      let token = accessToken;

      if (!token) {
        token = await refreshAccessToken();
      }

      if (!token) {
        redirectToLogin();
      }

      const activeToken = token as string;
      let response = await fetch(input, withBearerToken(init, activeToken));

      if (response.status !== 401) {
        return response;
      }

      token = await refreshAccessToken();
      if (!token) {
        redirectToLogin();
      }

      const refreshedToken = token as string;
      response = await fetch(input, withBearerToken(init, refreshedToken));

      if (response.status === 401) {
        redirectToLogin();
      }

      return response;
    },
    [accessToken, clearAuth, refreshAccessToken, router],
  );
}
