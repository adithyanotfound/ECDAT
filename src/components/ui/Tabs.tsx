"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  /** Controlled mode: pass both. */
  active?: string;
  onChange?: (id: string) => void;
  children: (activeTab: string) => React.ReactNode;
  className?: string;
  stripClassName?: string;
}

export function Tabs({
  tabs,
  defaultTab,
  active: controlled,
  onChange,
  children,
  className,
  stripClassName,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultTab ?? tabs[0]?.id ?? "");
  const active = controlled ?? internal;
  const select = (id: string) => {
    if (controlled === undefined) setInternal(id);
    onChange?.(id);
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-line", stripClassName)}>
        {tabs.map((tab) => {
          const on = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(tab.id)}
              className={cn(
                "relative -mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13.5px] font-medium whitespace-nowrap transition-colors",
                on ? "border-gold text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "num rounded-full px-1.5 text-[11px] font-semibold",
                    on ? "bg-charcoal text-white" : "bg-surface-2 text-muted",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="flex-1">
        {children(active)}
      </div>
    </div>
  );
}
