"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const THEME_STORAGE_KEY = "theme";
type ThemePreference = "system" | "light" | "dark";

function SystemThemeIcon({ className }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      <Monitor className="size-full" />
      <Sun className="absolute -right-1 -bottom-1 size-3 rounded-full bg-background dark:hidden" />
      <Moon className="absolute -right-1 -bottom-1 hidden size-3 rounded-full bg-background dark:block" />
    </span>
  );
}

const themeOptions = [
  { value: "system", label: "System", icon: SystemThemeIcon },
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
] as const;

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference | null>(null);
  const themeRef = useRef<ThemePreference>("system");
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let preference: ThemePreference = "system";
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") preference = stored;
    } catch {
      // Use the system preference when storage is unavailable.
    }

    themeRef.current = preference;
    setTheme(preference);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      const isDark =
        themeRef.current === "dark" ||
        (themeRef.current === "system" && mediaQuery.matches);
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };

    updateTheme();
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, []);

  const selectTheme = (value: string) => {
    if (value !== "system" && value !== "light" && value !== "dark") return;

    themeRef.current = value;
    setTheme(value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // The selected theme still applies for this session.
    }

    const nextIsDark =
      value === "dark" ||
      (value === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    const applyTheme = () => {
      document.documentElement.classList.toggle("dark", nextIsDark);
      document.documentElement.style.colorScheme = nextIsDark
        ? "dark"
        : "light";
    };

    // Get button center for the circle origin
    const button = buttonRef.current;
    if (
      !button ||
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.classList.contains("dark") === nextIsDark
    ) {
      applyTheme();
      return;
    }

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // Max radius to cover the entire page from the button center
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = document.startViewTransition(applyTheme);

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 700,
            easing: "ease-out",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        // A skipped transition still applies the selected theme.
      });
  };

  if (!theme) return null;

  const selectedOption =
    themeOptions.find((option) => option.value === theme) ?? themeOptions[0];
  const SelectedIcon = selectedOption.icon;

  return (
    <Select value={theme} onValueChange={selectTheme}>
      <SelectTrigger
        ref={buttonRef}
        aria-label="Designmodus"
        className="w-9 justify-center border-0 px-0 shadow-none hover:bg-accent dark:bg-transparent dark:hover:bg-accent/50 [&>svg]:hidden"
      >
        <SelectValue>
          <SelectedIcon className="size-4" aria-hidden="true" />
          <span className="sr-only">{selectedOption.label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <SelectItem key={value} value={value}>
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
