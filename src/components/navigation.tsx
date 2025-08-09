"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">Shift</h1>
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className={`text-sm font-medium transition-colors px-3 py-2 rounded-md ${pathname === "/"
              ? "text-foreground border-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          Calendar
        </Link>
        <Link
          href="/doctors"
          className={`text-sm font-medium transition-colors px-3 py-2 rounded-md ${pathname === "/doctors"
              ? "text-foreground border-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground"
            }`}
        >
          Doctors
        </Link>
        <div className="pl-2 ml-2 border-l">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
} 
