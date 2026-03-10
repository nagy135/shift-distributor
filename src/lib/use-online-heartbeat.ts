"use client";

import { useEffect } from "react";
import { AuthRedirectError } from "@/lib/auth-client";
import { useAuthorizedFetch } from "@/lib/use-authorized-fetch";

const HEARTBEAT_INTERVAL_MS = 15 * 1000;

export function useOnlineHeartbeat(enabled: boolean) {
  const authorizedFetch = useAuthorizedFetch();

  useEffect(() => {
    if (!enabled) return;

    let isDisposed = false;

    const sendHeartbeat = async () => {
      try {
        const response = await authorizedFetch("/api/auth/alive", {
          method: "POST",
          cache: "no-store",
          keepalive: true,
        });

        if (!response.ok && response.status !== 401 && !isDisposed) {
          console.error("Alive request failed", response.status);
        }
      } catch (error) {
        if (error instanceof AuthRedirectError) {
          return;
        }
        if (!isDisposed) {
          console.error("Alive request failed", error);
        }
      }
    };

    void sendHeartbeat();

    const interval = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      isDisposed = true;
      window.clearInterval(interval);
    };
  }, [authorizedFetch, enabled]);
}
