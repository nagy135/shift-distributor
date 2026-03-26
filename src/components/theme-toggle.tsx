"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

const THEME_STORAGE_KEY = "theme"; // "light" | "dark"

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);

    const storedPreference =
      typeof window !== "undefined"
        ? localStorage.getItem(THEME_STORAGE_KEY)
        : null;
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const shouldUseDark =
      storedPreference === "dark" || (storedPreference === null && prefersDark);

    setIsDark(shouldUseDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;

    // Get button center for the circle origin
    const button = buttonRef.current;
    if (!button || !document.startViewTransition) {
      // Fallback: just toggle without animation
      setIsDark(nextIsDark);
      document.documentElement.classList.toggle("dark", nextIsDark);
      localStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? "dark" : "light");
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

    const transition = document.startViewTransition(() => {
      setIsDark(nextIsDark);
      document.documentElement.classList.toggle("dark", nextIsDark);
      localStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? "dark" : "light");
    });

    transition.ready.then(() => {
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
    });
  };

  if (!mounted) return null;

  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      size="icon"
      aria-label={
        isDark ? "Zum hellen Modus wechseln" : "Zum dunklen Modus wechseln"
      }
      onClick={toggleTheme}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="sr-only">Designmodus umschalten</span>
    </Button>
  );
}
