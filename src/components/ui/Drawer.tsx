"use client";

/**
 * Side panel and centred dialog. The drawer is the deepest layer of the
 * "peel the onion" flow: summary → table row → everything about that row.
 * Both close on Escape or a click on the backdrop, lock page scroll while
 * open, and move keyboard focus into themselves.
 */
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

function useOverlay(open: boolean, onClose: () => void, panel: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose, panel]);
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  /** Small row above the title, e.g. badges. */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  width?: string;
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  className,
  width = "600px",
}: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, panel);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "absolute top-3 right-3 bottom-3 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop outline-none animate-slide-in",
          className,
        )}
        style={{ width: `min(${width}, calc(100vw - 1.5rem))` }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            {eyebrow && <div className="mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div>}
            <h2 className="text-lg leading-snug font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line bg-surface-2/60 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, description, icon, children, footer, width = "480px" }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, panel);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 sm:pt-[12vh]">
      <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full rounded-2xl border border-line bg-surface shadow-pop outline-none animate-pop-in"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start gap-3.5 px-6 pt-6">
          {icon && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold-ink">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
            {description && <div className="mt-1 text-[13.5px] leading-relaxed text-muted">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-2 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
        {children && <div className="px-6 pt-5">{children}</div>}
        {footer ? (
          <div className="mt-6 flex justify-end gap-2.5 border-t border-line px-6 py-4">{footer}</div>
        ) : (
          <div className="h-6" />
        )}
      </div>
    </div>
  );
}
