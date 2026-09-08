"use client";

import { useState } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--color-bg)" }}>
      <Sidebar collapsed={collapsed} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onToggleSidebar={() => setCollapsed((c) => !c)} />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: "var(--color-bg)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
