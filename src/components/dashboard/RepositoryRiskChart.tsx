"use client";

/**
 * Priority map: each repository is a bubble placed by its quantum readiness
 * (x, 0–10) and how many of its assets need action first (y, critical + high).
 * Bubble area is its total asset count; colour is its readiness band, the same
 * colours as the readiness chips. Top-left is "fix first", bottom-right is
 * "in good shape".
 *
 * Plain SVG sized to its container, so text stays crisp and nothing extra is
 * downloaded. Hover or focus a bubble for its details; click to open it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RepositoryRisk } from "@/fixtures/types";
import { TONE, pqcTone } from "@/lib/tones";

const HEIGHT = 340;
const PAD = { top: 18, right: 20, bottom: 44, left: 48 };
const R_MIN = 7;
const R_MAX = 24;
// Values are drawn inside the plot by this much, so a bubble at 0 or 10 never
// sits on the axis labels or gets cut off at the edge.
const INSET = 18;

type Point = RepositoryRisk & { total: number; urgent: number; x: number; y: number; r: number };

const shortName = (fullName: string) => fullName.split("/").pop() ?? fullName;

/** Round an axis maximum up to a friendly number with integer ticks. */
function niceMax(v: number): { max: number; step: number } {
  if (v <= 4) return { max: 4, step: 1 };
  const step = v <= 10 ? 2 : v <= 25 ? 5 : v <= 50 ? 10 : Math.ceil(v / 5 / 10) * 10;
  return { max: Math.ceil(v / step) * step, step };
}

export function RepositoryRiskChart({ data }: { data: RepositoryRisk[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scored = useMemo(() => data.filter((r) => r.readiness !== null), [data]);
  const unscored = data.length - scored.length;

  const { points, yAxis } = useMemo(() => {
    const plotW = Math.max(0, width - PAD.left - PAD.right);
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const rows = scored.map((r) => ({
      ...r,
      total: r.critical + r.high + r.moderate + r.low + r.safe,
      urgent: r.critical + r.high,
    }));
    const yAxis = niceMax(Math.max(1, ...rows.map((r) => r.urgent)));
    const maxTotal = Math.max(1, ...rows.map((r) => r.total));
    // Area, not radius, follows the asset count.
    const radius = (t: number) => R_MIN + (R_MAX - R_MIN) * Math.sqrt(t / maxTotal);
    const placed: Point[] = rows
      // Big bubbles first, so small ones draw on top and stay visible.
      .sort((a, b) => b.total - a.total)
      .map((r) => ({
        ...r,
        x: PAD.left + INSET + ((r.readiness ?? 0) / 10) * (plotW - 2 * INSET),
        y: PAD.top + plotH - INSET - (r.urgent / yAxis.max) * (plotH - 2 * INSET),
        r: radius(r.total),
      }));
    // Nudge exact duplicates apart so every repository can be seen and hovered.
    const seen = new Map<string, number>();
    for (const p of placed) {
      const key = `${Math.round(p.x)}:${Math.round(p.y)}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      if (n) p.x += n * 10 * (n % 2 ? 1 : -1);
    }
    return { points: placed, yAxis };
  }, [scored, width]);

  if (scored.length === 0) {
    return (
      <p className="py-10 text-center text-[13.5px] text-muted">
        Nothing to plot yet. Repositories appear here once a scan finds algorithms, keys or certificates.
      </p>
    );
  }

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const xAt = (v: number) => PAD.left + INSET + (v / 10) * (plotW - 2 * INSET);
  const yAt = (v: number) => PAD.top + plotH - INSET - (v / yAxis.max) * (plotH - 2 * INSET);
  const yTicks = Array.from({ length: yAxis.max / yAxis.step + 1 }, (_, i) => i * yAxis.step);
  // Label the most urgent few directly; the rest name themselves on hover.
  const labelled = new Set(
    [...points]
      .sort((a, b) => b.urgent - a.urgent || (a.readiness ?? 0) - (b.readiness ?? 0))
      .slice(0, 5)
      .map((p) => p.id),
  );
  const current = points.find((p) => p.id === active) ?? null;

  return (
    <div ref={box} className="relative">
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label="Repositories by quantum readiness and urgent assets">
          {/* Quadrant wash: the "fix first" corner is where to look */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={xAt(5) - PAD.left}
            height={yAt(yAxis.max / 2) - PAD.top}
            fill={TONE.critical.tint}
            opacity={0.7}
            rx={8}
          />
          <text x={PAD.left + 10} y={PAD.top + 18} fontSize="12" fontWeight="600" fill="var(--color-critical-ink)">
            Fix first
          </text>
          <text
            x={PAD.left + plotW - 10}
            y={PAD.top + plotH - 10}
            fontSize="12"
            fontWeight="600"
            textAnchor="end"
            fill="var(--color-safe-ink)"
          >
            In good shape
          </text>

          {/* Recessive grid and axes */}
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={yAt(t)} y2={yAt(t)} stroke="var(--color-line)" />
              <text x={PAD.left - 10} y={yAt(t) + 4} fontSize="11.5" textAnchor="end" fill="var(--color-muted)">
                {t}
              </text>
            </g>
          ))}
          {[0, 2, 4, 6, 8, 10].map((t) => (
            <text
              key={`x${t}`}
              x={xAt(t)}
              y={PAD.top + plotH + 18}
              fontSize="11.5"
              textAnchor="middle"
              fill="var(--color-muted)"
            >
              {t}
            </text>
          ))}
          <line
            x1={xAt(5)}
            x2={xAt(5)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="var(--color-line-strong)"
            strokeDasharray="4 4"
          />
          <text x={PAD.left + plotW / 2} y={HEIGHT - 6} fontSize="12" textAnchor="middle" fill="var(--color-ink-2)">
            Quantum readiness (out of 10) →
          </text>
          <text
            transform={`translate(14 ${PAD.top + plotH / 2}) rotate(-90)`}
            fontSize="12"
            textAnchor="middle"
            fill="var(--color-ink-2)"
          >
            Urgent assets (critical + high) →
          </text>

          {/* Bubbles: each one opens its repository */}
          {points.map((p) => {
            const tone = TONE[pqcTone(p.readiness ?? 0)];
            const on = active === p.id;
            return (
              <Link
                key={p.id}
                href={`/scanning/repositories/${p.id}`}
                aria-label={`${p.fullName}: readiness ${p.readiness} of 10, ${p.urgent} urgent of ${p.total} assets`}
                onMouseEnter={() => setActive(p.id)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(p.id)}
                onBlur={() => setActive(null)}
                className="outline-none"
              >
                {/* Generous invisible hit area */}
                <circle cx={p.x} cy={p.y} r={p.r + 6} fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={on ? p.r + 2 : p.r}
                  fill={tone.fill}
                  fillOpacity={active && !on ? 0.35 : 0.85}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                  style={{ transition: "r 150ms, fill-opacity 150ms" }}
                />
                {on && <circle cx={p.x} cy={p.y} r={p.r + 6} fill="none" stroke={tone.fill} strokeWidth={1.5} />}
                {labelled.has(p.id) && (
                  <text
                    x={p.x + p.r + 6}
                    y={p.y + 4}
                    fontSize="12"
                    fontWeight={on ? 600 : 500}
                    fill="var(--color-ink-2)"
                    style={{ paintOrder: "stroke", stroke: "var(--color-surface)", strokeWidth: 3 }}
                  >
                    {shortName(p.fullName)}
                  </text>
                )}
              </Link>
            );
          })}
        </svg>
      )}

      {current && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 w-60 rounded-xl border border-line bg-surface p-3.5 text-[12.5px] shadow-pop"
          style={{
            left: Math.min(Math.max(current.x - 120, 0), Math.max(0, width - 240)),
            top: current.y > HEIGHT / 2 ? current.y - current.r - 118 : current.y + current.r + 12,
          }}
        >
          <p className="truncate font-semibold text-ink">{current.fullName}</p>
          <p className="mt-1 text-muted">
            Readiness <b className="num text-ink">{current.readiness}/10</b> · {current.total} assets
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {(
              [
                ["Critical", current.critical, "critical"],
                ["High", current.high, "high"],
                ["Moderate", current.moderate, "moderate"],
                ["Low", current.low, "low"],
                ["Safe", current.safe, "safe"],
              ] as const
            ).map(([label, n, tone]) => (
              <li key={label} className="flex items-center gap-1.5 text-ink-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: TONE[tone].fill }} />
                {label} <span className="num ml-auto font-semibold text-ink">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {(
            [
              // Same cut-offs as pqcTone; readiness has one decimal, so the bands meet.
              ["Not ready (below 4)", "critical"],
              ["Partly ready (4 to 7)", "moderate"],
              ["Ready (7 and up)", "safe"],
            ] as const
          ).map(([label, tone]) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: TONE[tone].fill }} />
              {label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="inline-flex size-3 items-center justify-center rounded-full border border-faint" />
            Bigger bubble = more assets
          </li>
        </ul>
        {unscored > 0 && (
          <span>
            {unscored} {unscored === 1 ? "repository has" : "repositories have"} nothing to score yet.
          </span>
        )}
      </div>
    </div>
  );
}
