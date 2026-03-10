"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useApiClient } from "@/lib/use-api-client";
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
  const { notificationsApi } = useApiClient();
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => notificationsApi.getUnread(),
    enabled: !!user,
  });
  const unreadCount = notifications.length;
  const markNotificationsMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread"] });
    },
  });
  const navItems = [
    { href: "/", label: "Kalender", active: pathname === "/" },
    {
      href: "/vacations",
      label: "Urlaub",
      active: pathname === "/vacations",
    },
    {
      href: "/night-shifts",
      label: "Nachtdienste",
      active: pathname === "/night-shifts",
    },
    { href: "/doctors", label: "Ärzte", active: pathname === "/doctors" },
  ];

  if (user?.role === "shift_assigner") {
    navItems.push({
      href: "/admin/users",
      label: "Benutzer",
      active: pathname === "/admin/users",
    });
  }

  return (
    <nav className="flex flex-col">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dienstplan</h1>
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
                aria-label="Navigationsmenü öffnen"
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
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Urlaubsbenachrichtigungen"
                    className="relative"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-2">
                  <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
                    Benachrichtigungen
                  </div>
                  <div className="my-2 h-px bg-border" />
                  {notifications.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      Keine neuen Benachrichtigungen.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((item) => (
                        <PopoverClose key={item.id} asChild>
                          <Link
                            href="/vacations"
                            className="block rounded-md border px-3 py-2 text-sm hover:bg-accent"
                            onClick={() => {
                              if (unreadCount > 0) {
                                markNotificationsMutation.mutate();
                              }
                            }}
                          >
                            {item.message}
                          </Link>
                        </PopoverClose>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <PopoverClose asChild>
                      <Link
                        href="/vacations"
                        className="block w-full rounded-md border px-3 py-2 text-center text-sm font-medium hover:bg-accent"
                        onClick={() => {
                          if (unreadCount > 0) {
                            markNotificationsMutation.mutate();
                          }
                        }}
                      >
                        Urlaub öffnen
                      </Link>
                    </PopoverClose>
                  </div>
                </PopoverContent>
              </Popover>
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
                    Abmelden
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
                Registrieren
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm border-2 border-primary bg-primary/5 px-3 py-2 rounded-md"
              >
                Anmelden
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
