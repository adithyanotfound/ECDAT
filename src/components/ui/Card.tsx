/**
 * Cards and page headers: the containers every screen is built from.
 */
import { cn } from "@/lib/cn";
import type { GlossaryKey } from "@/lib/glossary";
import { InfoHint } from "./InfoHint";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}>{children}</section>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  term?: GlossaryKey;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, term, hint, action, icon, className }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold-soft text-gold-ink">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            {title}
            {(term || hint) && <InfoHint label={title} term={term} text={hint} />}
          </h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, back, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 max-w-3xl">
        {back}
        {eyebrow && <p className="text-xs font-semibold tracking-[0.14em] text-gold-ink uppercase">{eyebrow}</p>}
        <h1 className="mt-1.5 text-[26px] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/** A small heading that starts a group of cards on a page. */
export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
