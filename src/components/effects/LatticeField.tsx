"use client";

/**
 * A slowly breathing lattice: a nod to lattice-based cryptography (ML-KEM,
 * ML-DSA), which is what the post-quantum world is moving to. Gold "packets"
 * hop along its edges, and the lattice warms to gold around the cursor.
 *
 * Built to stay light:
 *   - one <canvas>, lines batched into a few paths per frame, ~40 fps cap;
 *   - pauses when scrolled off screen or when the tab is hidden;
 *   - pixel ratio capped at 1.5;
 *   - "reduce motion" gets a single still frame and no packets.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface LatticeFieldProps {
  /** "light" for off-white sections, "dark" for charcoal ones. */
  tone?: "light" | "dark";
  /** Distance between lattice points, in CSS pixels. */
  spacing?: number;
  /** Number of travelling gold packets. */
  packets?: number;
  /** Brighten the lattice around the pointer. */
  interactive?: boolean;
  className?: string;
}

// Bright gold reads on charcoal; the deeper brand gold reads on off-white.
const GOLD_ON_DARK = [217, 174, 74] as const;
const GOLD_ON_LIGHT = [196, 150, 44] as const;
const FRAME_MS = 1000 / 40;
const HOP_MS = 650;

export function LatticeField({
  tone = "light",
  spacing = 58,
  packets = 7,
  interactive = true,
  className,
}: LatticeFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dark = tone === "dark";
    const base = dark ? "255, 255, 255" : "29, 31, 35";
    const lineAlpha = dark ? 0.07 : 0.07;
    const dotAlpha = dark ? 0.16 : 0.13;
    const glowRadius = 230;
    const gold = (dark ? GOLD_ON_DARK : GOLD_ON_LIGHT).join(",");

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let rowH = 0;
    let visible = true;
    let raf = 0;
    let last = 0;
    const pointer = { x: -9999, y: -9999, on: false };

    // Packets walk from lattice point to neighbouring point.
    type Packet = { from: number; to: number; start: number; hops: number };
    let walkers: Packet[] = [];

    const index = (c: number, r: number) => r * cols + c;
    // Triangular lattice: odd rows are shifted half a step, so each point has six neighbours.
    const neighbours = (i: number): number[] => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const odd = r % 2 === 1;
      const out: number[] = [];
      const push = (cc: number, rr: number) => {
        if (cc >= 0 && cc < cols && rr >= 0 && rr < rows) out.push(index(cc, rr));
      };
      push(c - 1, r);
      push(c + 1, r);
      push(odd ? c : c - 1, r - 1);
      push(odd ? c + 1 : c, r - 1);
      push(odd ? c : c - 1, r + 1);
      push(odd ? c + 1 : c, r + 1);
      return out;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rowH = spacing * 0.866;
      cols = Math.ceil(width / spacing) + 2;
      rows = Math.ceil(height / rowH) + 2;
      const total = cols * rows;
      walkers = Array.from({ length: reduced ? 0 : packets }, (_, k) => {
        const from = Math.floor(((k + 1) / (packets + 1)) * total) % total;
        const n = neighbours(from);
        return {
          from,
          to: n[Math.floor(Math.random() * n.length)] ?? from,
          start: performance.now() - Math.random() * HOP_MS,
          hops: 0,
        };
      });
    };

    // Point position, gently displaced by two slow waves.
    const pos = (i: number, t: number) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const bx = (c - 1) * spacing + (r % 2 ? spacing / 2 : 0);
      const by = (r - 1) * rowH;
      const a = reduced ? 0 : 5;
      return {
        x: bx + a * Math.sin(t * 0.00055 + by * 0.013 + bx * 0.004),
        y: by + a * Math.cos(t * 0.00045 + bx * 0.011),
      };
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      const total = cols * rows;
      const pts = new Array(total);
      for (let i = 0; i < total; i++) pts[i] = pos(i, t);

      // 1. The whole lattice in one faint path (each edge drawn once: right, down-left, down-right).
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = index(c, r);
          const p = pts[i];
          const odd = r % 2 === 1;
          const targets = [c + 1 < cols ? index(c + 1, r) : -1];
          if (r + 1 < rows) {
            const dl = odd ? c : c - 1;
            const dr = odd ? c + 1 : c;
            if (dl >= 0) targets.push(index(dl, r + 1));
            if (dr < cols) targets.push(index(dr, r + 1));
          }
          for (const j of targets) {
            if (j < 0) continue;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pts[j].x, pts[j].y);
          }
        }
      }
      ctx.strokeStyle = `rgba(${base}, ${lineAlpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2. Points.
      ctx.fillStyle = `rgba(${base}, ${dotAlpha})`;
      ctx.beginPath();
      for (let i = 0; i < total; i++) {
        ctx.moveTo(pts[i].x + 1.3, pts[i].y);
        ctx.arc(pts[i].x, pts[i].y, 1.3, 0, Math.PI * 2);
      }
      ctx.fill();

      // 3. Gold warmth around the pointer.
      if (pointer.on) {
        for (let i = 0; i < total; i++) {
          const p = pts[i];
          const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
          if (d > glowRadius) continue;
          const k = 1 - d / glowRadius;
          for (const j of neighbours(i)) {
            if (j < i) continue;
            ctx.strokeStyle = `rgba(${gold}, ${0.7 * k * k})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
          ctx.fillStyle = `rgba(${gold}, ${0.9 * k})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.3 + 2 * k, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Packets: a glowing gold dot with a short trail along its edge.
      for (const w of walkers) {
        let f = (t - w.start) / HOP_MS;
        if (f >= 1) {
          // Arrived: step on to a random neighbour, never straight back.
          const prev = w.from;
          w.from = w.to;
          w.hops += 1;
          if (w.hops > 14) {
            // Respawn somewhere new so packets spread over the whole field.
            w.from = Math.floor(Math.random() * total);
            w.hops = 0;
          }
          const all = neighbours(w.from);
          const onward = all.filter((n) => n !== prev);
          const pool = onward.length ? onward : all;
          w.to = pool[Math.floor(Math.random() * pool.length)] ?? w.from;
          w.start = t;
          f = 0;
        }
        const a = pts[w.from];
        const b = pts[w.to];
        if (!a || !b) continue;
        const ease = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
        const x = a.x + (b.x - a.x) * ease;
        const y = a.y + (b.y - a.y) * ease;
        const trail = ctx.createLinearGradient(a.x, a.y, x, y);
        trail.addColorStop(0, `rgba(${gold}, 0)`);
        trail.addColorStop(1, `rgba(${gold}, ${dark ? 0.8 : 0.75})`);
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.lineWidth = 1;
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 11);
        glow.addColorStop(0, `rgba(${gold}, 0.9)`);
        glow.addColorStop(1, `rgba(${gold}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || t - last < FRAME_MS) return;
      last = t;
      draw(t);
    };

    resize();
    draw(performance.now());

    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
    });
    io.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.on = pointer.x >= -40 && pointer.y >= -40 && pointer.x <= r.width + 40 && pointer.y <= r.height + 40;
    };
    const onLeave = () => {
      pointer.on = false;
    };
    if (interactive && !reduced) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
    }

    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [tone, spacing, packets, interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}
