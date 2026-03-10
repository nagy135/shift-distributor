"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 15 * 1000;

export function useOnlineHeartbeat(accessToken: string | null) {
  useEffect(() => {
    if (!accessToken) return;

    let isDisposed = false;

    const sendHeartbeat = async () => {
      try {
        const response = await fetch("/api/auth/alive", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
          keepalive: true,
        });

        if (!response.ok && response.status !== 401 && !isDisposed) {
          console.error("Alive request failed", response.status);
        }
      } catch (error) {
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
  }, [accessToken]);
}
