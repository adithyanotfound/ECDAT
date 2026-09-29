/**
 * Structured JSON logging keyed by scanId (IMPLEMENTATION_PLAN.md §Phase 5
 * "Hardening"). Every worker/scanner log line goes to stdout as one JSON
 * object so it's greppable/correlatable in any log aggregator, in addition
 * to the ScanLog rows the UI streams over SSE.
 */
export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export function logScan(scanId: string, level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    scanId,
    level,
    message,
    ...meta,
  };
  const out = level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;
  out(JSON.stringify(line));
}
