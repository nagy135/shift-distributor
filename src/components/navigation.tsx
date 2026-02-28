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
  PopoverClose,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Navigation() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const navItems = [
    { href: "/", label: "Calendar", active: pathname === "/" },
    { href: "/doctors", label: "Doctors", active: pathname === "/doctors" },
  ];

  if (user?.role === "admin") {
    navItems.push({
      href: "/admin/users",
      label: "Users",
      active: pathname === "/admin/users",
    });
  }

  return (
    <nav className="flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shift</h1>
        <div className="flex items-center gap-1">
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Button
                key={item.href}
                asChild
                size="sm"
                variant={item.active ? "default" : "ghost"}
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="md:hidden"
                aria-label="Open navigation menu"
              >
                <span className="flex flex-col gap-1">
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                  <span className="h-0.5 w-4 rounded-full bg-current" />
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-1">
              <div className="flex flex-col">
                {navItems.map((item) => (
                  <PopoverClose key={item.href} asChild>
                    <Button
                    asChild
                    size="sm"
                    variant={item.active ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                      <Link href={item.href}>{item.label}</Link>
                    </Button>
                  </PopoverClose>
                ))}
              </div>
            </PopoverContent>
          </Popover>
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
