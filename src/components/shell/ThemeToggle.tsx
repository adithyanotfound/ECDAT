"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find((r) => r.startsWith("theme="))
      ?.split("=")[1] as "dark" | "light" | undefined;
    const t = saved ?? "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-ink-muted)",
      }}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Moon size={12} /> : <Sun size={12} />}
      <span>{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
