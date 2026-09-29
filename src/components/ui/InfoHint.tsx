"use client";

/**
 * The ⓘ next to a term. Hover or focus shows a short plain-language
 * explanation; a click pins it open (hover doesn't exist on touch screens).
 * The panel is portalled to <body> so a table or drawer with overflow:hidden
 * can't clip it, and it flips above the trigger near the bottom of the screen.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";

const WIDTH = 288;
const GAP = 8;
const EDGE = 12;

interface InfoHintProps {
  /** A glossary entry, or pass `text` for a one-off explanation. */
  term?: GlossaryKey;
  text?: ReactNode;
  /** Bold first line of the panel, and the accessible name ("What does … mean?"). */
  label: string;
  className?: string;
  /** Light trigger for use on the dark sidebar or bands. */
  onDark?: boolean;
}

export function InfoHint({ term, text, label, className, onDark = false }: InfoHintProps) {
  const body = text ?? (term ? GLOSSARY[term] : null);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(r.left + r.width / 2 - WIDTH / 2, EDGE), window.innerWidth - WIDTH - EDGE);
    const above = window.innerHeight - r.bottom < 200 && r.top > 200;
    setPos({ top: above ? r.top - GAP : r.bottom + GAP, left, above });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (trigger.current?.contains(t) || document.getElementById(id)?.contains(t)) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, id]);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    if (pinned) return;
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  if (!body) return null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`What does ${label} mean?`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          // Rows and cards behind the hint are often clickable themselves.
          e.stopPropagation();
          e.preventDefault();
          setPinned((p) => !p);
          setOpen(true);
        }}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hideSoon}
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full align-middle transition-colors",
          onDark ? "text-on-dark-muted hover:text-gold-bright" : "text-faint hover:text-gold-ink",
          className,
        )}
      >
        <Info size={14} strokeWidth={2} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hideSoon}
            onClick={(e) => e.stopPropagation()}
            className="animate-pop-in fixed z-[200] rounded-xl border border-line bg-surface p-4 text-left text-[13px] leading-relaxed text-ink-2 shadow-pop"
            style={{
              top: pos.top,
              left: pos.left,
              width: WIDTH,
              transform: pos.above ? "translateY(-100%)" : undefined,
            }}
          >
            <p className="mb-1 font-semibold text-ink">{label}</p>
            <div>{body}</div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** A label followed by its ⓘ, the most common pairing. */
export function Term({
  children,
  term,
  text,
  className,
}: {
  children: string;
  term?: GlossaryKey;
  text?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <InfoHint label={children} term={term} text={text} />
    </span>
  );
}
