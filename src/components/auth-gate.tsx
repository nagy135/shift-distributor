"use client";

import { useAuth } from "@/lib/auth-client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (!isLoading && !user && !isAuthPage) {
      router.replace("/login");
    }
  }, [isLoading, user, isAuthPage, router]);

  if (isAuthPage) return <>{children}</>;
  if (isLoading) return <div className="text-center">Lädt...</div>;
  if (!user) return null;
  return <>{children}</>;
}
