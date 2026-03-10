"use client";

import { useMemo } from "react";
import { createApiClient } from "@/lib/api";
import { useAuthorizedFetch } from "@/lib/use-authorized-fetch";

export function useApiClient() {
  const authorizedFetch = useAuthorizedFetch();

  return useMemo(() => createApiClient(authorizedFetch), [authorizedFetch]);
}
