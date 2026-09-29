"use client";

/**
 * Small illustrations for the landing page's feature cards. Plain HTML/SVG
 * animated with transforms and opacity only; each plays once when scrolled
 * into view.
 */
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

const once = { once: true, margin: "-40px" } as const;
const ease = [0.2, 0, 0, 1] as const;

/** Where ECDAT Atlas looks: chips popping in one after another. */
export function SourceChips() {
  const sources = [
    ["Source code", "#b3263c"],
    ["Dependencies", "#d0632a"],
    ["Certificates", "#c4962c"],
    ["Config files", "#3f74bb"],
    ["Secrets", "#b3263c"],
    ["Terraform & Kubernetes", "#2f8a57"],
    ["AWS KMS keys", "#c4962c"],
    ["AWS ACM certificates", "#3f74bb"],
  ] as const;
  return (
    <motion.ul
      aria-hidden="true"
      className="mt-6 flex flex-wrap gap-2"
      initial="hide"
      whileInView="show"
      viewport={once}
    >
      {sources.map(([s, c], i) => (
        <motion.li
          key={s}
          variants={{ hide: { opacity: 0, y: 10, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1 } }}
          transition={{ type: "spring", stiffness: 320, damping: 22, delay: i * 0.07 }}
          className="flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1.5 text-[13px] font-medium text-ink-2"
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: c }} />
          {s}
        </motion.li>
      ))}
    </motion.ul>
  );
}

/** Risk scores filling up, coloured by band. */
export function RiskBars() {
  const rows = [
    ["DES", 100, "#b3263c"],
    ["RSA-2048", 48, "#d0632a"],
    ["ECDSA P-256", 40, "#d9a91c"],
    ["AES-256-GCM", 3, "#2f8a57"],
  ] as const;
  return (
    <motion.ul aria-hidden="true" className="mt-6 space-y-3" initial="hide" whileInView="show" viewport={once}>
      {rows.map(([name, score, color], i) => (
        <li key={name} className="grid grid-cols-[96px_1fr_28px] items-center gap-3 text-[12.5px]">
          <span className="font-mono text-ink-2">{name}</span>
          <span className="h-2 overflow-hidden rounded-full bg-sunken">
            <motion.span
              className="block h-full origin-left rounded-full"
              style={{ width: `${Math.max(score, 4)}%`, backgroundColor: color }}
              variants={{ hide: { scaleX: 0 }, show: { scaleX: 1 } }}
              transition={{ duration: 0.8, delay: 0.15 + i * 0.12, ease }}
            />
          </span>
          <span className="num text-right font-semibold text-ink">{score}</span>
        </li>
      ))}
    </motion.ul>
  );
}

/** Data lifetime + migration time against the quantum deadline. */
export function MiniTimeline() {
  return (
    <motion.div aria-hidden="true" className="mt-7 pb-2" initial="hide" whileInView="show" viewport={once}>
      {/* The marker is positioned against the bar only, so it never crosses the labels. */}
      <div className="relative pt-6">
        <div className="flex h-6 overflow-hidden rounded-lg bg-sunken">
          <motion.div
            className="h-full origin-left bg-charcoal-3"
            style={{ width: "45%" }}
            variants={{ hide: { scaleX: 0 }, show: { scaleX: 1 } }}
            transition={{ duration: 0.7, ease }}
          />
          <motion.div
            className="h-full origin-left bg-critical"
            style={{ width: "33%" }}
            variants={{ hide: { scaleX: 0 }, show: { scaleX: 1 } }}
            transition={{ duration: 0.6, delay: 0.6, ease }}
          />
        </div>
        <motion.div
          className="absolute top-0 bottom-0 left-[64%] flex flex-col items-center"
          variants={{ hide: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.4, delay: 1.2 }}
        >
          <span className="rounded bg-charcoal px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white">
            Quantum computer
          </span>
          <span className="w-0.5 flex-1 bg-charcoal" />
        </motion.div>
      </div>
      <div className="mt-3 flex justify-between text-[11.5px] text-muted">
        <span>Data kept secret</span>
        <span>+ time to migrate</span>
      </div>
      <motion.p
        className="mt-3 text-[13px] font-semibold text-critical-ink"
        variants={{ hide: { opacity: 0 }, show: { opacity: 1 } }}
        transition={{ delay: 1.5 }}
      >
        Past the deadline: act now.
      </motion.p>
    </motion.div>
  );
}

/** From → to migrations sliding in. */
export function Migrations() {
  const rows = [
    ["RSA-2048", "ML-DSA-65", "FIPS 204"],
    ["X25519", "X25519MLKEM768", "FIPS 203"],
    ["SHA-1", "SHA-256", "FIPS 180-4"],
  ] as const;
  return (
    <motion.ul aria-hidden="true" className="mt-6 space-y-2.5" initial="hide" whileInView="show" viewport={once}>
      {rows.map(([from, to, std], i) => (
        <motion.li
          key={from}
          variants={{ hide: { opacity: 0, x: -14 }, show: { opacity: 1, x: 0 } }}
          transition={{ duration: 0.45, delay: i * 0.15, ease }}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2.5 text-[12.5px]"
        >
          <span className="rounded-md bg-critical-tint px-2 py-0.5 font-mono text-critical-ink">{from}</span>
          <ArrowRight size={13} className="text-faint" />
          <span className="rounded-md bg-safe-tint px-2 py-0.5 font-mono text-safe-ink">{to}</span>
          <span className="ml-auto text-muted">{std}</span>
        </motion.li>
      ))}
    </motion.ul>
  );
}

/** What changed after a push. */
export function PushDiff() {
  return (
    <motion.div
      aria-hidden="true"
      className="mt-6 space-y-2 font-mono text-[12.5px]"
      initial="hide"
      whileInView="show"
      viewport={once}
    >
      {[
        ["+", "MD5 in PaymentProcessor.java", "text-critical-ink bg-critical-tint"],
        ["−", "3DES in legacy/cipher.ts", "text-safe-ink bg-safe-tint line-through"],
        ["=", "11 assets unchanged", "text-muted bg-bg"],
      ].map(([sign, text, cls], i) => (
        <motion.div
          key={text}
          variants={{ hide: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.35, delay: 0.2 + i * 0.18 }}
          className={`flex gap-3 rounded-lg px-3 py-2 ${cls}`}
        >
          <span className="font-semibold">{sign}</span>
          {text}
        </motion.div>
      ))}
    </motion.div>
  );
}

/** A CycloneDX snippet typing itself in. */
export function CbomSnippet() {
  const lines = [
    ['"bomFormat"', '"CycloneDX"'],
    ['"specVersion"', '"1.6"'],
    ['"name"', '"RSA-2048"'],
    ['"primitive"', '"signature"'],
    ['"nistQuantumSecurityLevel"', "0"],
  ];
  return (
    <motion.pre
      aria-hidden="true"
      className="mt-6 overflow-hidden rounded-xl bg-charcoal p-4 font-mono text-[12px] leading-relaxed text-on-dark"
      initial="hide"
      whileInView="show"
      viewport={once}
    >
      {lines.map(([k, v], i) => (
        <motion.div
          key={k}
          variants={{ hide: { opacity: 0 }, show: { opacity: 1 } }}
          transition={{ delay: 0.15 + i * 0.16 }}
        >
          <span className="text-gold-bright">{k}</span>: <span className="text-[#8fc3a0]">{v}</span>
          {i < lines.length - 1 ? "," : ""}
        </motion.div>
      ))}
    </motion.pre>
  );
}
