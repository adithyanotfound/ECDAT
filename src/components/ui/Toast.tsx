"use client";

/**
 * A short confirmation in the corner ("Scan started"), with an optional
 * next step. Dismisses itself; never blocks the page.
 */
import { useEffect } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

export interface ToastMessage {
  id: number;
  tone: "success" | "error";
  title: string;
  body?: string;
  action?: { label: string; href: string };
}

export function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  const ok = toast.tone === "success";
  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-[120] flex w-[min(380px,calc(100vw-2rem))] items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-pop animate-pop-in"
    >
      <span className={ok ? "text-safe" : "text-critical"}>
        {ok ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-[13px] text-muted">{toast.body}</p>}
        {toast.action && (
          <a
            href={toast.action.href}
            className="mt-2 inline-block text-[13px] font-semibold text-gold-ink hover:underline"
          >
            {toast.action.label} →
          </a>
        )}
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="text-faint hover:text-ink">
        <X size={16} />
      </button>
    </div>
  );
}
