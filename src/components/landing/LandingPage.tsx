"use client";

/**
 * The public landing page. Light on purpose: React Bits text effects and a
 * few motion animations, CSS for everything ambient, real product
 * screenshots as WebP (only the hero image loads eagerly), and every
 * animation respects "reduce motion".
 */
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import {
  ArrowRight,
  Check,
  Clock,
  EyeOff,
  FileBadge2,
  GitPullRequestArrow,
  KeyRound,
  Lock,
  Plus,
  ScanSearch,
  ShieldCheck,
  Timer,
  Trash2,
  Webhook,
  Wrench,
} from "lucide-react";
import BlurText from "@/components/reactbits/BlurText";
import CountUp from "@/components/reactbits/CountUp";
import Magnet from "@/components/reactbits/Magnet";
import ShinyText from "@/components/reactbits/ShinyText";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { BrandMark, BrandName } from "@/components/shell/BrandMark";
import { LatticeField } from "@/components/effects/LatticeField";
import { RotatingPill } from "./RotatingPill";
import { CbomSnippet, MiniTimeline, Migrations, PushDiff, RiskBars, SourceChips } from "./visuals";

const NAV = [
  ["Why now", "#why"],
  ["Features", "#features"],
  ["How it works", "#how"],
  ["Security", "#security"],
  ["FAQ", "#faq"],
] as const;

const FINDS = [
  "RSA-2048 signatures",
  "ECDSA P-256",
  "SHA-1 and MD5",
  "3DES and RC4",
  "TLS 1.0 and 1.1",
  "RSA-1024 keys",
  "Expiring certificates",
  "Private keys in code",
  "JWT alg=none",
  "AWS KMS keys",
  "ACM certificates",
  "Weak SSH ciphers",
];

const SCREENS = [
  {
    key: "dashboard",
    label: "Dashboard",
    src: "/landing/dashboard.webp",
    caption: "One verdict on quantum readiness, then the numbers behind it.",
  },
  {
    key: "inventory",
    label: "Crypto inventory",
    src: "/landing/inventory.webp",
    caption: "Open any algorithm, key or certificate: what it's for, why it matters, what to do.",
  },
  {
    key: "vulnerabilities",
    label: "Vulnerabilities",
    src: "/landing/vulnerabilities.webp",
    caption: "Specific problems, most severe first, each pointing to the file it's in.",
  },
  {
    key: "recommendations",
    label: "Recommendations",
    src: "/landing/recommendations.webp",
    caption: "From → to, with the NIST standard and how much work it is.",
  },
  {
    key: "scans",
    label: "Live scans",
    src: "/landing/scans.webp",
    caption: "Follow a scan as it runs, then see exactly what changed since the last one.",
  },
] as const;

const FAQ = [
  [
    "What does ECDAT Atlas actually look at?",
    "Source code, dependency manifests, certificate and key files, server config (TLS and SSH), infrastructure-as-code, and, if you connect AWS, your KMS keys and ACM certificates. It records what cryptography is used and where, not your data.",
  ],
  [
    "Do I need to install anything to try it?",
    "No. Public GitHub repositories can be added by name. Private repositories and scans on every push need the ECDAT Atlas GitHub App, which only asks for read access.",
  ],
  [
    "Is my code stored?",
    "No. Each scan downloads the code to a temporary folder, reads it, and deletes the folder when the scan ends, including when a scan fails. Only the findings are kept.",
  ],
  [
    "What does it recommend moving to?",
    "The NIST post-quantum standards: ML-KEM (FIPS 203) for key exchange, ML-DSA (FIPS 204) and SLH-DSA (FIPS 205) for signatures, plus modern classical replacements like AES-256-GCM and SHA-256 where an algorithm is already weak.",
  ],
  [
    "Why worry now if quantum computers are years away?",
    "Two reasons. Attackers can record encrypted traffic today and decrypt it later. And replacing cryptography across a large system takes years. If your data must stay secret longer than you have left, you're already late.",
  ],
  [
    "What's a CBOM, and why would I need one?",
    "A Cryptography Bill of Materials: a standard list (CycloneDX 1.6) of every cryptographic component in a system. Auditors and regulators increasingly ask for one, and ECDAT Atlas produces it after every scan.",
  ],
] as const;

export function LandingPage({ signedIn }: { signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const heroShot = useRef<HTMLDivElement>(null);

  const { scrollY, scrollYProgress } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12));
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 });

  // The product shot starts tilted back and settles flat as it scrolls into view.
  const { scrollYProgress: shotProgress } = useScroll({ target: heroShot, offset: ["start end", "start 0.25"] });
  const rotateX = useTransform(shotProgress, [0, 1], [16, 0]);
  const scale = useTransform(shotProgress, [0, 1], [0.94, 1]);

  const primary = signedIn
    ? { href: "/dashboard", label: "Open the dashboard" }
    : { href: "/login", label: "Sign in with GitHub" };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh overflow-x-hidden bg-bg text-ink">
        {/* ── Navigation ─────────────────────────────────────────── */}
        <header
          className={clsx(
            "fixed inset-x-0 top-0 z-50 transition-all duration-300",
            scrolled ? "border-b border-line bg-bg/80 backdrop-blur-md" : "border-b border-transparent",
          )}
        >
          <nav
            aria-label="Main"
            className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-6 lg:px-10"
          >
            <a href="#top" className="flex items-center gap-2.5">
              <BrandMark size={34} />
              <BrandName />
            </a>
            <div className="hidden items-center gap-8 text-sm text-ink-2 md:flex">
              {NAV.map(([label, href]) => (
                <a key={href} href={href} className="transition-colors hover:text-ink">
                  {label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {!signedIn && (
                <Link
                  href="/login"
                  className="hidden rounded-xl px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:text-ink sm:block"
                >
                  Sign in
                </Link>
              )}
              <Link
                href={primary.href}
                className="inline-flex items-center gap-1.5 rounded-xl bg-charcoal px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-charcoal-2"
              >
                {primary.label} <ArrowRight size={15} />
              </Link>
            </div>
          </nav>
          <motion.div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-[-1px] h-0.5 origin-left bg-gold"
            style={{ scaleX: progress, opacity: scrolled ? 1 : 0 }}
          />
        </header>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section id="top" className="relative overflow-hidden pt-36 pb-10 sm:pt-44">
          <HeroBackdrop />
          <div className="relative mx-auto max-w-5xl px-6 text-center">
            <motion.a
              href="#features"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/80 py-1.5 pr-3.5 pl-1.5 text-[13px] shadow-card backdrop-blur"
            >
              <span className="rounded-full bg-charcoal px-2.5 py-0.5 text-xs font-semibold text-gold-bright">New</span>
              <ShinyText
                text="A CycloneDX 1.6 CBOM after every scan"
                color="#3b3f46"
                shineColor="#c4962c"
                speed={3}
                delay={1.5}
                className="font-medium"
              />
              <ArrowRight size={14} className="text-muted" />
            </motion.a>

            <h1 className="mt-8 text-[clamp(2.4rem,6vw,4.6rem)] leading-[1.04] font-semibold tracking-[-0.035em]">
              <BlurText
                text="Find the cryptography"
                delay={90}
                animateBy="words"
                direction="bottom"
                className="justify-center"
              />
              <span className="mt-2 block">
                <RotatingPill
                  texts={[
                    "quantum computers will break.",
                    "hiding in your code.",
                    "your auditors will ask about.",
                    "to replace first.",
                  ]}
                />
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mx-auto mt-8 max-w-2xl text-[17px] leading-relaxed text-ink-2 sm:text-lg"
            >
              ECDAT Atlas scans your GitHub repositories and AWS accounts for every algorithm, key and certificate,
              shows which ones a quantum computer could break, and tells you what to move to first.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-10 flex flex-wrap items-center justify-center gap-3"
            >
              <Magnet padding={60} magnetStrength={6}>
                <Link
                  href={primary.href}
                  className="inline-flex items-center gap-2 rounded-2xl bg-charcoal px-6 py-3.5 text-[15px] font-semibold text-white shadow-pop transition-colors hover:bg-charcoal-2"
                >
                  {primary.label} <ArrowRight size={17} />
                </Link>
              </Magnet>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-2xl border border-line-strong bg-surface/80 px-6 py-3.5 text-[15px] font-semibold text-ink backdrop-blur transition-colors hover:bg-surface"
              >
                See how it works
              </a>
            </motion.div>
            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-muted"
            >
              {["Public repos: nothing to install", "Read-only access", "Rescans on every push"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check size={14} className="text-gold-ink" /> {t}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* Product shot */}
          <div className="relative mx-auto mt-16 max-w-6xl px-6 [perspective:1600px] sm:mt-20">
            <motion.div ref={heroShot} style={{ rotateX, scale }} className="relative origin-top">
              <BrowserFrame path="dashboard">
                {/* eslint-disable-next-line @next/next/no-img-element -- static WebP, already sized */}
                <img
                  src="/landing/dashboard.webp"
                  alt="ECDAT Atlas dashboard: quantum readiness 5 out of 10, with high-risk assets and where the risk sits"
                  width={2880}
                  height={1800}
                  fetchPriority="high"
                  decoding="async"
                  className="block h-auto w-full"
                />
                <span aria-hidden="true" className="scan-sweep" />
              </BrowserFrame>
              <Callout className="top-[30%] -left-3 hidden lg:flex" delay={0.2} tone="var(--color-critical)">
                2 assets: act now
              </Callout>
              <Callout className="top-[55%] -right-3 hidden lg:flex" delay={0.45} tone="var(--color-safe)" float>
                3DES → AES-256-GCM
              </Callout>
              <Callout className="bottom-[12%] left-[8%] hidden md:flex" delay={0.7} tone="var(--color-gold)">
                CBOM ready to download
              </Callout>
            </motion.div>
          </div>
        </section>

        {/* ── What it finds (marquee) ───────────────────────────────── */}
        <section className="py-14" aria-label="What ECDAT Atlas finds">
          <p className="text-center text-[13px] font-medium tracking-wide text-muted uppercase">
            What it finds, in minutes
          </p>
          <div className="marquee-pause relative mt-7 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
            <ul className="animate-marquee flex w-max gap-3">
              {[...FINDS, ...FINDS].map((s, i) => (
                <li
                  key={`${s}-${i}`}
                  aria-hidden={i >= FINDS.length}
                  className="flex items-center gap-2.5 rounded-full border border-line bg-surface px-5 py-2.5 font-mono text-[13px] whitespace-nowrap text-ink-2"
                >
                  <span className="size-1.5 rounded-full bg-gold" /> {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Why now ─────────────────────────────────────────────── */}
        <Section id="why" eyebrow="Why now" title="Today's encryption has an expiry date.">
          A large enough quantum computer will break the RSA and elliptic-curve cryptography almost everything uses. It
          isn&apos;t here yet, but two things make it a problem today.
          <div className="mt-14 grid gap-5 text-left lg:grid-cols-3">
            {[
              {
                icon: <Clock size={19} />,
                title: "Harvest now, decrypt later",
                body: "Encrypted traffic recorded today can be read the day a quantum computer exists. Secrets that must last years are already exposed.",
              },
              {
                icon: <Timer size={19} />,
                title: "Migrations take years",
                body: "Cryptography is spread through code, libraries, certificates and cloud keys. Finding it all by hand is the slow part.",
              },
              {
                icon: <ShieldCheck size={19} />,
                title: "The replacements are ready",
                body: "NIST published the first post-quantum standards in 2024: ML-KEM, ML-DSA and SLH-DSA. The question now is where to use them.",
              },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 0.08}>
                <div className="h-full rounded-3xl border border-line bg-surface p-7 shadow-card">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-gold-soft text-gold-ink">
                    {c.icon}
                  </span>
                  <p className="mt-5 text-[17px] font-semibold">{c.title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ── Features ───────────────────────────────────────────── */}
        <Section id="features" eyebrow="What it does" title="From “what do we even use?” to a plan, in one place.">
          Six detector families look through everything a system is made of, then each finding is scored, timed and
          paired with a replacement.
          <div className="mt-14 grid gap-5 text-left md:grid-cols-2 lg:grid-cols-3">
            <Feature
              className="lg:col-span-2"
              icon={<ScanSearch size={19} />}
              title="Finds it everywhere"
              body="Code, dependencies, certificates, server config, secrets, infrastructure-as-code and AWS. Every hit points to the exact file."
            >
              <SourceChips />
            </Feature>
            <Feature
              icon={<KeyRound size={19} />}
              title="Scores the risk"
              body="A 0 to 100 risk score from how weak the algorithm is, how widely it's used and how important the repository is."
            >
              <RiskBars />
            </Feature>
            <Feature
              icon={<Timer size={19} />}
              title="Knows when to act"
              body="Mosca's rule compares how long your data must stay secret with the time left before quantum computers arrive."
            >
              <MiniTimeline />
            </Feature>
            <Feature
              className="lg:col-span-2"
              icon={<Wrench size={19} />}
              title="Tells you what to move to"
              body="Each weak algorithm comes with a replacement, the NIST standard behind it and roughly how much work the change is."
            >
              <Migrations />
            </Feature>
            <Feature
              className="lg:col-span-2"
              icon={<GitPullRequestArrow size={19} />}
              title="Watches every push"
              body="Through the GitHub App, every push is scanned and compared with the last scan, so new weak crypto is caught the day it lands."
            >
              <PushDiff />
            </Feature>
            <Feature
              icon={<FileBadge2 size={19} />}
              title="Speaks auditor"
              body="A standard CycloneDX 1.6 CBOM after every scan, as JSON for tools or PDF for people."
            >
              <CbomSnippet />
            </Feature>
          </div>
        </Section>

        {/* ── How it works ───────────────────────────────────────── */}
        <Section id="how" eyebrow="How it works" title="Four steps, and the first scan takes minutes.">
          <HowItWorks />
        </Section>

        {/* ── By the numbers (dark band) ───────────────────────────── */}
        <section className="relative overflow-hidden bg-charcoal py-24 text-white sm:py-28">
          <LatticeField
            tone="dark"
            spacing={64}
            packets={6}
            className="[mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
          />
          <div
            aria-hidden="true"
            className="animate-drift pointer-events-none absolute -top-40 left-[70%] size-[560px] rounded-full bg-[radial-gradient(closest-side,rgb(217_174_74/0.16),transparent)]"
          />
          <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-[0.16em] text-gold-bright uppercase">Under the hood</p>
              <h2 className="mt-4 text-[clamp(2rem,4vw,3rem)] leading-tight font-semibold tracking-tight">
                Built on standards, not guesswork.
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-on-dark-muted">
                Detection rules you can read, scores you can trace, and output in the formats auditors already use.
              </p>
            </div>
            <dl className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                value={<CountUp to={6} duration={1.2} />}
                label="Detector families: code, manifests, certificates, keys, protocols, secrets"
              />
              <Stat value={<CountUp to={50} duration={1.6} />} label="Detection rules, each tied to a file and line" />
              <Stat
                value={<CountUp to={3} duration={1.2} />}
                label="NIST post-quantum standards mapped: FIPS 203, 204 and 205"
              />
              <Stat
                value={
                  <>
                    <CountUp to={1.6} duration={1.4} />
                  </>
                }
                label="CycloneDX version of every CBOM it produces"
              />
            </dl>
          </div>
        </section>

        {/* ── Product tour ───────────────────────────────────────── */}
        <Section id="product" eyebrow="The product" title="Built to be read, not decoded.">
          Every screen starts with one plain answer. Open anything to go a layer deeper, all the way down to the file
          and line.
          <ProductTour />
        </Section>

        {/* ── Security ───────────────────────────────────────────── */}
        <Section id="security" eyebrow="Security" title="A security tool that behaves like one.">
          <div className="mt-14 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-4">
            {[
              [
                EyeOff,
                "Read-only by design",
                "The GitHub App only asks to read code. AWS needs a read-only IAM user. Nothing in your systems is changed.",
              ],
              [
                Trash2,
                "Code isn't kept",
                "Each scan works in a temporary folder that's deleted when it ends, even if the scan fails.",
              ],
              [
                Lock,
                "Keys encrypted at rest",
                "AWS secret keys are sealed with AES-256-GCM before they're stored, and never shown again.",
              ],
              [
                Webhook,
                "Verified webhooks",
                "Push events are accepted only with a valid GitHub signature, rate-limited and de-duplicated.",
              ],
            ].map(([Icon, title, body], i) => {
              const I = Icon as typeof Lock;
              return (
                <Reveal key={title as string} delay={i * 0.06}>
                  <div className="h-full rounded-3xl border border-line bg-surface p-7 shadow-card">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-gold-soft">
                      <I size={19} className="text-gold-ink" />
                    </span>
                    <p className="mt-5 text-[17px] font-semibold">{title as string}</p>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body as string}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Section>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <Section id="faq" eyebrow="FAQ" title="Questions people ask first.">
          <Faq />
        </Section>

        {/* ── Final call to action ─────────────────────────────────── */}
        <section className="px-6 pb-24 lg:px-10">
          <Reveal>
            <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-charcoal px-8 py-20 text-center text-white sm:px-16">
              <LatticeField
                tone="dark"
                spacing={52}
                packets={5}
                className="[mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]"
              />
              <Rings className="animate-orbit absolute top-1/2 left-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 text-gold-bright opacity-40" />
              <div className="relative">
                <h2 className="mx-auto max-w-3xl text-[clamp(2rem,4.5vw,3.25rem)] leading-tight font-semibold tracking-tight">
                  Find out how ready you are, before someone else does.
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-[17px] text-on-dark-muted">
                  Sign in with GitHub, add a repository, and see your first results in a minute or two.
                </p>
                <div className="mt-10 flex flex-wrap justify-center gap-3">
                  <Link
                    href={primary.href}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gold px-6 py-3.5 text-[15px] font-semibold text-charcoal transition-colors hover:bg-gold-bright"
                  >
                    {primary.label} <ArrowRight size={17} />
                  </Link>
                  <a
                    href="#features"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    See what it finds
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between lg:px-10">
            <div className="flex items-center gap-2.5">
              <BrandMark size={26} />
              <BrandName />
              <span>· Enterprise Cryptographic Discovery &amp; Analysis Tool</span>
            </div>
            <p>CycloneDX 1.6 · NIST FIPS 203, 204, 205</p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

/* ─────────────────────────────────────────────────────────── helpers */

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  const [lead, ...rest] = Array.isArray(children) ? children : [children];
  const hasLead = typeof lead === "string" || (Array.isArray(lead) && lead.every((l) => typeof l === "string"));
  return (
    <section id={id} className="scroll-mt-20 px-6 py-24 text-center sm:py-28 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Reveal blur>
          <p className="text-sm font-semibold tracking-[0.16em] text-gold-ink uppercase">{eyebrow}</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-[clamp(2rem,4vw,3rem)] leading-tight font-semibold tracking-tight">
            {title}
          </h2>
          {hasLead && <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2">{lead}</p>}
        </Reveal>
        {hasLead ? rest : children}
      </div>
    </section>
  );
}

/** Fade and rise into view once, when scrolled to. */
function Reveal({ children, delay = 0, blur = false }: { children: ReactNode; delay?: number; blur?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, ...(blur && { filter: "blur(10px)" }) }}
      whileInView={{ opacity: 1, y: 0, ...(blur && { filter: "blur(0px)" }) }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0, 0, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

function Feature({
  icon,
  title,
  body,
  className,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Reveal>
        <SpotlightCard className="h-full p-7 transition-shadow duration-300 hover:shadow-pop">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gold-soft text-gold-ink">
            {icon}
          </span>
          <p className="mt-5 text-[17px] font-semibold">{title}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
          {children}
        </SpotlightCard>
      </Reveal>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    [
      "Connect",
      "Add a public repository by name, install the GitHub App for private ones, or connect a read-only AWS account.",
    ],
    [
      "Scan",
      "Six detector families read code, manifests, certificates, config and cloud keys. Most scans finish in under a minute.",
    ],
    [
      "Understand",
      "Every asset gets a risk score, a quantum-safe verdict and a timeline. Start from one answer and open anything for more.",
    ],
    [
      "Fix",
      "Follow the recommendations, quick wins first, and hand auditors the CBOM. Every push shows whether things got better.",
    ],
  ];
  return (
    <ol className="relative mt-16 grid gap-10 text-left md:grid-cols-4 md:gap-6">
      <motion.span
        aria-hidden="true"
        className="absolute top-6 right-[12%] left-[12%] hidden h-px origin-left bg-gradient-to-r from-gold/0 via-gold to-gold/0 md:block"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.2, ease: [0.2, 0, 0, 1] }}
      />
      {steps.map(([title, body], i) => (
        <Reveal key={title} delay={0.15 + i * 0.12}>
          <li className="relative">
            <span className="relative flex size-12 items-center justify-center rounded-2xl bg-charcoal text-[15px] font-semibold text-gold-bright shadow-pop">
              {i + 1}
            </span>
            <p className="mt-5 text-lg font-semibold">{title}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}

function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="bg-charcoal p-8 sm:p-10">
      <dd className="num text-5xl font-semibold tracking-tight text-white">{value}</dd>
      <dt className="mt-3 text-[15px] leading-relaxed text-on-dark-muted">{label}</dt>
    </div>
  );
}

function BrowserFrame({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-[0_40px_100px_-30px_rgb(31_33_38/0.38)] sm:rounded-3xl">
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-4 py-3">
        <span className="size-3 rounded-full bg-line-strong" />
        <span className="size-3 rounded-full bg-line-strong" />
        <span className="size-3 rounded-full bg-line-strong" />
        <span className="mx-auto hidden rounded-lg bg-surface px-10 py-1 text-xs text-muted sm:block">
          ecdat-atlas.app/{path}
        </span>
      </div>
      {children}
    </div>
  );
}

function Callout({
  children,
  className,
  delay,
  tone,
  float = false,
}: {
  children: ReactNode;
  className?: string;
  delay: number;
  tone: string;
  float?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.4 + delay, ease: [0.2, 0, 0, 1] }}
      className={clsx("absolute z-10", className)}
    >
      <div
        className={clsx(
          "flex items-center gap-2.5 rounded-2xl border border-line bg-surface/95 px-4 py-3 text-[13px] font-medium shadow-pop backdrop-blur",
          float && "animate-float",
        )}
      >
        <span className="size-2.5 rounded-full" style={{ background: tone }} />
        {children}
      </div>
    </motion.div>
  );
}

function ProductTour() {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { margin: "-20% 0px" });
  const reduced = useReducedMotion();
  // Autoplay: the bar under the active tab fills over six seconds, then the next screen opens.
  const playing = inView && !hovered;
  const screen = SCREENS[active] ?? SCREENS[0];
  const next = () => setActive((i) => (i + 1) % SCREENS.length);

  return (
    <div ref={box} className="mt-12" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
      <div
        role="tablist"
        aria-label="Product screens"
        className="mx-auto flex max-w-fit flex-wrap justify-center gap-1 rounded-2xl border border-line bg-surface-2/70 p-1.5"
      >
        {SCREENS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={clsx(
              "relative overflow-hidden rounded-xl px-4 py-2 text-sm font-medium transition-colors",
              active === i ? "text-white" : "text-ink-2 hover:text-ink",
            )}
          >
            {active === i && (
              <motion.span
                layoutId="tour-tab"
                className="absolute inset-0 rounded-xl bg-charcoal shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            <span className="relative">{s.label}</span>
            {active === i && !reduced && (
              <span
                key={`progress-${i}`}
                aria-hidden="true"
                className="animate-tour-progress absolute inset-x-2 bottom-1 h-0.5 rounded-full bg-gold-bright"
                style={{ animationPlayState: playing ? "running" : "paused" }}
                onAnimationEnd={next}
              />
            )}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={screen.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="mx-auto mt-6 max-w-xl text-[15px] text-ink-2"
        >
          {screen.caption}
        </motion.p>
      </AnimatePresence>
      <div className="mx-auto mt-10 max-w-6xl">
        <BrowserFrame path={screen.key}>
          <div className="relative aspect-[16/10] overflow-hidden bg-surface">
            <AnimatePresence initial={false}>
              <motion.img
                key={screen.key}
                src={screen.src}
                alt={`ECDAT Atlas ${screen.label.toLowerCase()} screen`}
                width={2880}
                height={1800}
                loading="lazy"
                decoding="async"
                initial={{ opacity: 0, scale: 1.04, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: [0.2, 0, 0, 1] }}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            </AnimatePresence>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto mt-12 max-w-3xl divide-y divide-line rounded-3xl border border-line bg-surface text-left shadow-card">
      {FAQ.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <div key={q} className="px-7">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-6 py-5 text-left text-[16px] font-semibold"
            >
              {q}
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className={clsx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isOpen ? "border-charcoal bg-charcoal text-gold-bright" : "border-line-strong text-muted",
                )}
              >
                <Plus size={15} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 text-[15px] leading-relaxed text-ink-2">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/** Soft dot grid, a warm glow and slow orbit rings behind the hero. */
function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <LatticeField
        tone="light"
        className="[mask-image:radial-gradient(ellipse_75%_65%_at_50%_32%,black_30%,transparent)]"
      />
      <div className="animate-drift absolute top-[-10%] left-1/2 h-[520px] w-[900px] rounded-full bg-[radial-gradient(closest-side,rgb(196_150_44/0.22),transparent)] blur-2xl" />
      <Rings className="animate-orbit absolute top-[-380px] left-1/2 size-[1100px] -translate-x-1/2 text-gold opacity-50" />
    </div>
  );
}

function Rings({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1000 1000" fill="none" aria-hidden="true">
      {[180, 280, 380, 480].map((r, i) => (
        <circle
          key={r}
          cx="500"
          cy="500"
          r={r}
          stroke="currentColor"
          strokeOpacity={0.28 - i * 0.05}
          strokeDasharray={i % 2 ? "5 9" : undefined}
        />
      ))}
      <ellipse cx="500" cy="500" rx="180" ry="480" stroke="currentColor" strokeOpacity={0.14} />
      <circle cx="500" cy="220" r="7" fill="currentColor" fillOpacity="0.55" />
      <circle cx="820" cy="610" r="6" fill="currentColor" fillOpacity="0.4" />
      <circle cx="240" cy="700" r="5" fill="currentColor" fillOpacity="0.35" />
    </svg>
  );
}
