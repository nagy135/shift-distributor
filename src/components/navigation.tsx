"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Navigation() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <nav className="flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shift</h1>
        <div className="flex items-center gap-1">
          <Button
            asChild
            size="sm"
            variant={pathname === "/" ? "default" : "ghost"}
          >
            <Link href="/">Calendar</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant={pathname === "/doctors" ? "default" : "ghost"}
          >
            <Link href="/doctors">Doctors</Link>
          </Button>
          <div className=" ml-2 border-l">
            <ThemeToggle />
          </div>

          {user && (
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    aria-label="Account menu"
                    className="inline-flex cursor-pointer"
                  >
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        {user.email?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <div className="px-2 py-1 text-sm text-muted-foreground truncate">
                    {user.email}
                  </div>
                  <div className="my-2 h-px bg-border" />
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => logout()}
                  >
                    Logout
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-2 border-t pt-2">
        {!user && (
          <div className="flex items-center gap-3">
            {pathname === "/login" ? (
              <Link
                href="/register"
                className="text-sm border-2 border-primary bg-primary/5 px-3 py-2 rounded-md"
              >
                Register
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm border-2 border-primary bg-primary/5 px-3 py-2 rounded-md"
              >
                Login
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
