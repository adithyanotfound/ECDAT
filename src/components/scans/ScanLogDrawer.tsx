"use client";

/**
 * A scan, opened: its live log (streamed over SSE while it runs) and what
 * changed compared with the previous scan.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, GitCompare, Loader2, Terminal, XCircle } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Pill";
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
  title?: string;
}

const LEVEL: Record<LogEntry["level"], { tag: string; color: string }> = {
  DEBUG: { tag: "debug", color: "#8b8f97" },
  INFO: { tag: "info ", color: "#8fc3a0" },
  WARN: { tag: "warn ", color: "#e3b95a" },
  ERROR: { tag: "error", color: "#f08a8a" },
};

type StreamState = "streaming" | "done" | "failed" | "lost" | "idle";

export function ScanLogDrawer({ scanId, onClose, title = "Scan details" }: ScanLogDrawerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<StreamState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tab, setTab] = useState("logs");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scanId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset for the newly opened scan
    setLogs([]);
    setStatus("streaming");
    setErrorMessage(null);
    setTab("logs");

    const es = new EventSource(`/api/scans/${scanId}/logs/stream`);
    const handleLog = (data: string) => {
      const entry = JSON.parse(data) as LogEntry;
      setLogs((prev) => (prev.some((l) => l.id === entry.id) ? prev : [...prev, entry]));
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    };
    es.onmessage = (e) => handleLog(e.data);
    es.addEventListener("log", (e) => handleLog((e as MessageEvent).data));
    es.addEventListener("done", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { status: string; errorMessage?: string };
      setStatus(data.status === "FAILED" ? "failed" : "done");
      if (data.errorMessage) setErrorMessage(data.errorMessage);
      es.close();
    });
    es.addEventListener("timeout", () => {
      setStatus("lost");
      es.close();
    });
    // A dropped connection isn't a failed scan; say so honestly.
    es.onerror = () => {
      setStatus((s) => (s === "streaming" ? "lost" : s));
      es.close();
    };
    return () => es.close();
  }, [scanId]);

  const state = {
    streaming: (
      <Badge tone="low" pulse>
        Running
      </Badge>
    ),
    done: <Badge tone="safe">Completed</Badge>,
    failed: <Badge tone="critical">Failed</Badge>,
    lost: <Badge tone="neutral">Live view paused</Badge>,
    idle: null,
  }[status];

  return (
    <Drawer
      open={!!scanId}
      onClose={onClose}
      title={title}
      eyebrow={state}
      subtitle={scanId ? <span className="font-mono">Scan {scanId.slice(-8)}</span> : undefined}
      width="820px"
    >
      <Tabs
        active={tab}
        onChange={setTab}
        stripClassName="px-6"
        tabs={[
          { id: "logs", label: "What happened", icon: <Terminal size={14} /> },
          { id: "changes", label: "What changed", icon: <GitCompare size={14} /> },
        ]}
      >
        {(active) =>
          active === "changes" && scanId ? (
            <ScanDiffPanel scanId={scanId} />
          ) : (
            <div className="p-6">
              <div
                ref={scrollRef}
                className="h-[min(60vh,560px)] overflow-y-auto rounded-xl bg-charcoal p-4 font-mono text-[12.5px] leading-relaxed text-on-dark"
              >
                {logs.length === 0 && status === "streaming" && (
                  <p className="flex items-center gap-2 text-on-dark-muted">
                    <Loader2 size={13} className="animate-spin" /> Waiting for the scanner to start…
                  </p>
                )}
                {logs.map((log) => {
                  const lv = LEVEL[log.level] ?? LEVEL.INFO;
                  return (
                    <div key={log.id} className="flex gap-3">
                      <span className="shrink-0 text-white/35">
                        {new Date(log.ts).toLocaleTimeString("en-GB", { hour12: false })}
                      </span>
                      <span className="w-10 shrink-0" style={{ color: lv.color }}>
                        {lv.tag}
                      </span>
                      <span className="break-words whitespace-pre-wrap">{log.message}</span>
                    </div>
                  );
                })}
                {status === "done" && (
                  <p className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-[#8fc3a0]">
                    <CheckCircle2 size={14} /> Finished. {logs.length} log lines.
                  </p>
                )}
                {status === "failed" && (
                  <div className="mt-4 border-t border-white/10 pt-3 text-[#f08a8a]">
                    <p className="flex items-center gap-2">
                      <XCircle size={14} /> The scan failed.
                    </p>
                    {errorMessage && (
                      <p className="mt-2 font-sans text-[13px] whitespace-pre-wrap text-on-dark">{errorMessage}</p>
                    )}
                  </div>
                )}
                {status === "lost" && (
                  <p className="mt-4 border-t border-white/10 pt-3 font-sans text-[13px] text-on-dark-muted">
                    The live connection closed. The scan may still be running; reopen this panel to pick up where it
                    left off.
                  </p>
                )}
              </div>
            </div>
          )
        }
      </Tabs>
    </Drawer>
  );
}
