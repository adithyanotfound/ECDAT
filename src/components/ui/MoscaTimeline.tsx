/**
 * Mosca's inequality, as a first-class card — not a verdict alone.
 * X (data lifetime) + Y (migration time) > Z (time to CRQC) ⟹ act now.
 * (IMPLEMENTATION_PLAN.md §4c "Mosca's inequality — give it a first-class card")
 *
 * Shown as two stacked bars against a deadline line, with the verdict in
 * words first, so it reads without knowing the formula.
 */
import { MOSCA, TONE, type MoscaVerdict } from "@/lib/tones";
import { VerdictPill } from "./Pill";
import { InfoHint } from "./InfoHint";

interface MoscaTimelineProps {
  x: number;
  y: number;
  z: number;
  verdict: MoscaVerdict;
}

export function MoscaTimeline({ x, y, z, verdict }: MoscaTimelineProps) {
  const cfg = MOSCA[verdict] ?? MOSCA.PLAN;
  const tone = TONE[cfg.tone];
  const total = Math.max(x + y, z, 1) * 1.1;
  const pct = (v: number) => `${(v / total) * 100}%`;
  const margin = z - (x + y);
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            Is there time to move?
            <InfoHint label="Mosca's rule" term="mosca" />
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{cfg.plain}</p>
        </div>
        <VerdictPill verdict={verdict} />
      </div>

      <div className="rounded-xl bg-surface-2/70 p-4">
        {/* Years needed: how long the data must stay secret, then how long the move takes */}
        <div className="relative pt-6 pb-8">
          <div className="flex h-7 overflow-hidden rounded-lg bg-sunken">
            <div
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ width: pct(x), backgroundColor: "var(--color-charcoal-3)" }}
              title={`X: the data must stay secret for ${x} years`}
            >
              {x >= 2 ? `${x}y` : ""}
            </div>
            <div
              className="flex items-center justify-center text-[11px] font-semibold text-white"
              style={{ width: pct(y), backgroundColor: tone.fill }}
              title={`Y: moving to new cryptography takes about ${y} years`}
            >
              {y >= 2 ? `${y}y` : ""}
            </div>
          </div>
          {/* The deadline: when a quantum computer is expected */}
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: pct(z), transform: "translateX(-50%)" }}
          >
            <span className="rounded-md bg-charcoal px-1.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap text-white">
              Quantum computer · {z}y
            </span>
            <span className="w-0.5 flex-1 bg-charcoal" />
          </div>
        </div>

        <div className="grid gap-2 text-[12.5px] text-ink-2 sm:grid-cols-3">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: "var(--color-charcoal-3)" }} />
            Data kept secret: <b className="num">{x} years</b>
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: tone.fill }} />
            Time to migrate: <b className="num">{y} years</b>
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-0.5 bg-charcoal" />
            Quantum computer in: <b className="num">{z} years</b>
          </span>
        </div>
      </div>

      <p className="text-[13.5px] leading-relaxed text-ink-2">
        {margin > 0 ? (
          <>
            You have about <b>{margin} years</b> of slack: start the move by <b>{year + margin}</b> at the latest.
          </>
        ) : margin === 0 ? (
          <>
            There is <b>no slack</b>: the move needs to start this year.
          </>
        ) : (
          <>
            The move is <b>{Math.abs(margin)} years late</b>. Anything encrypted with this today could be read once a
            quantum computer exists.
          </>
        )}
      </p>
    </div>
  );
}
