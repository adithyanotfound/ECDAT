"use client";

import { useEffect, useRef, useState } from "react";
import { X, Terminal, CheckCircle2, XCircle, Loader2, GitCompare } from "lucide-react";
import { ScanDiffPanel } from "./ScanDiffPanel";

interface LogEntry {
  id: string;
  ts: string;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  message: string;
}

interface ScanLogDrawerProps {
  scanId: string | null;
  onClose: () => void;
}

const levelColor: Record<string, string> = {
  DEBUG: "var(--color-ink-faint)",
  INFO: "var(--color-ink-muted)",
  WARN: "var(--color-stat-amber)",
  ERROR: "var(--color-critical)",
};

const levelPrefix: Record<string, string> = {
  DEBUG: "[DBG]",
  INFO: "[INF]",
  WARN: "[WRN]",
  ERROR: "[ERR]",
};

export function ScanLogDrawer({ scanId, onClose }: ScanLogDrawerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<"streaming" | "done" | "failed" | "idle">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"logs" | "changes">("logs");
  const scrollRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setActiveTab("logs");
    setErrorMessage(null);
  }, [scanId]);

  useEffect(() => {
    if (!scanId) {
      setLogs([]);
      setStatus("idle");
      return;
    }

    setLogs([]);
    setStatus("streaming");

    const es = new EventSource(`/api/scans/${scanId}/logs/stream`);
    esRef.current = es;

    const handleLog = (data: string) => {
      const entry = JSON.parse(data) as LogEntry;
      setLogs((prev) => prev.some(l => l.id === entry.id) ? prev : [...prev, entry]);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    };

    es.onmessage = (e) => handleLog(e.data);
    es.addEventListener("log", (e) => handleLog((e as MessageEvent).data));

    es.addEventListener("done", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { status: string; errorMessage?: string };
      setStatus(data.status === "FAILED" ? "failed" : "done");
      if (data.errorMessage) {
        setErrorMessage(data.errorMessage);
      }
      es.close();
    });

    es.addEventListener("heartbeat", () => {
      // Connection alive, do nothing
    });

    es.onerror = () => {
      setStatus("failed");
      es.close();
    };

    return () => {
      es.close();
    };
  }, [scanId]);

  if (!scanId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-4 md:inset-8 z-50 flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          minHeight: "60vh",
          maxHeight: "90vh"
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <Terminal size={16} style={{ color: "var(--color-accent)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                Scan Logs
              </p>
              <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-ink-faint)" }}>
                {scanId.slice(0, 8)}…
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {status === "streaming" && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-accent)" }}>
                <Loader2 size={12} className="animate-spin" />
                Live
              </div>
            )}
            {status === "done" && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-safe)" }}>
                <CheckCircle2 size={12} />
                Completed
              </div>
            )}
            {status === "failed" && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-critical)" }}>
                <XCircle size={12} />
                Failed
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg"
              style={{
                backgroundColor: "var(--color-surface-2)",
                color: "var(--color-ink-muted)",
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex items-center gap-1 px-4 pt-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
          {([
            { id: "logs" as const, label: "Logs", icon: Terminal },
            { id: "changes" as const, label: "Changes", icon: GitCompare },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
              style={{
                color: activeTab === tab.id ? "var(--color-accent)" : "var(--color-ink-muted)",
                borderBottom: activeTab === tab.id ? "2px solid var(--color-accent)" : "2px solid transparent",
              }}
            >
              <tab.icon size={12} /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "changes" && <ScanDiffPanel scanId={scanId} />}

        {/* Log output */}
        <div
          hidden={activeTab !== "logs"}
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono"
          style={{
            fontSize: "12px",
            lineHeight: "1.6",
            backgroundColor: "var(--color-bg)",
          }}
        >
          {logs.length === 0 && status === "streaming" && (
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: "var(--color-ink-faint)" }}
            >
              <Loader2 size={12} className="animate-spin" />
              Waiting for logs…
            </div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="flex gap-3 mb-1">
              <span style={{ color: "var(--color-ink-faint)", flexShrink: 0 }}>
                {new Date(log.ts).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span
                style={{ color: levelColor[log.level] ?? "var(--color-ink-muted)", flexShrink: 0 }}
              >
                {levelPrefix[log.level] ?? log.level}
              </span>
              <span style={{ color: "var(--color-ink)", wordBreak: "break-all" }}>
                {log.message}
              </span>
            </div>
          ))}
          {status === "done" && (
            <div
              className="mt-3 pt-3 text-xs"
              style={{
                color: "var(--color-safe)",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              ✓ Scan completed — {logs.length} log entries
            </div>
          )}
          {status === "failed" && (
            <div
              className="mt-3 pt-3 text-xs"
              style={{
                color: "var(--color-critical)",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              <div className="font-semibold mb-1">✕ Scan failed</div>
              {errorMessage && (
                <div className="opacity-90 mt-1 whitespace-pre-wrap font-sans text-sm">
                  {errorMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
