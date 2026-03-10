"use client";

import { useAuth } from "@/lib/auth-client";
import { useOnlineHeartbeat } from "@/lib/use-online-heartbeat";

export function OnlineHeartbeat() {
  const { accessToken } = useAuth();

  useOnlineHeartbeat(accessToken);

  return null;
}
