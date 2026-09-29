/**
 * A headline number. The first layer of every page: one figure, one sentence
 * saying what it means, and, when `href` is set, a way to peel back to the
 * records behind it.
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { GlossaryKey } from "@/lib/glossary";
import { TONE, type Tone } from "@/lib/tones";
import { InfoHint } from "./InfoHint";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: Tone;
  term?: GlossaryKey;
  hint?: string;
  href?: string;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function StatCard({
  title,
  value,
  subtitle,
  tone = "gold",
  term,
  hint,
  href,
  icon,
  className,
  children,
}: StatCardProps) {
  const t = TONE[tone];
  const body = (
    <>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
          <span className="size-2 rounded-full" style={{ backgroundColor: t.fill }} />
          {title}
          {(term || hint) && (
            <span className="pointer-events-auto">
              <InfoHint label={title} term={term} text={hint} />
            </span>
          )}
        </p>
        {icon && (
          <span
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: t.tint, color: t.ink }}
          >
            {icon}
          </span>
        )}
      </div>
      {children ?? (
        <p className="num mt-3 text-[32px] leading-none font-semibold tracking-tight text-ink">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      )}
      {subtitle && <p className="mt-2 text-[13px] text-muted">{subtitle}</p>}
      {href && (
        <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-gold-ink opacity-80 transition-opacity group-hover:opacity-100">
          See the details{" "}
          <ArrowUpRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
      )}
    </>
  );

  const shell = cn(
    "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card animate-fade-in",
    href && "transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop",
    className,
  );

  if (!href) return <div className={shell}>{body}</div>;

  // A stretched link: the whole card is clickable, while the ⓘ stays a
  // separate control above it (a button inside a link isn't valid HTML).
  return (
    <div className={shell}>
      <Link href={href} aria-label={`${title}: see the details`} className="absolute inset-0 z-0 rounded-2xl" />
      <div className="pointer-events-none relative z-10 flex flex-col">{body}</div>
    </div>
  );
}
