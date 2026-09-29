/**
 * Empty, loading and notice states. An empty screen should always say why
 * it's empty and what to do next.
 */
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { TONE, type Tone } from "@/lib/tones";

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-gold-soft text-gold-ink">
          {icon}
        </span>
      )}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i} className="border-b border-line last:border-0">
          {Array.from({ length: cols }, (_, j) => (
            <td key={j} className="px-4 py-3.5">
              <div className="skeleton h-3.5" style={{ width: j === 0 ? "70%" : `${40 + ((i * 7 + j * 13) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

const NOTICE_ICON: Partial<Record<Tone, React.ReactNode>> = {
  critical: <AlertTriangle size={16} />,
  high: <AlertTriangle size={16} />,
  moderate: <AlertTriangle size={16} />,
  safe: <CheckCircle2 size={16} />,
};

export function Notice({
  tone = "neutral",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-xl px-4 py-3 text-[13.5px]", className)}
      style={{ backgroundColor: t.tint, color: t.ink }}
    >
      <span className="mt-0.5 shrink-0">{NOTICE_ICON[tone] ?? <Info size={16} />}</span>
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
