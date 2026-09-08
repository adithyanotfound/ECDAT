"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  children: (activeTab: string) => React.ReactNode;
  className?: string;
}

export function Tabs({ tabs, defaultTab, children, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Tab strip */}
      <div
        className="flex"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className="px-4 py-2.5 text-sm font-medium transition-all duration-150 relative"
            style={{
              color: active === tab.id ? "var(--color-ink)" : "var(--color-ink-muted)",
              borderBottom: active === tab.id ? "2px solid var(--color-accent)" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1">{children(active)}</div>
    </div>
  );
}
