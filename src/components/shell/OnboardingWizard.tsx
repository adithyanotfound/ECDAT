"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  CheckCircle,
  Circle,
  GitBranch,
  Scan,
  Shield,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from "lucide-react";

const ONBOARDING_KEY = "ecdat_onboarding_v1";
const REOPEN_EVENT = "ecdat_onboarding_reopen";

interface OnboardingStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; href: string };
  tip: string;
  selector: string | null;
}

const STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    icon: <Sparkles size={24} style={{ color: "#2F5BFF" }} />,
    title: "Welcome to ECDAT Atlas",
    description: "Your command center for discovering cryptographic assets and preparing your codebase for the post-quantum transition.",
    tip: "Click Next to start the quick tour!",
    selector: null,
  },
  {
    id: "dashboard",
    icon: <BarChart3 size={24} style={{ color: "#2F5BFF" }} />,
    title: "The Dashboard",
    description: "Start here to get a bird's-eye view of your enterprise's cryptographic posture, risk breakdown, and overall quantum readiness score.",
    tip: "Scores are calculated using the CRSF (Cryptographic Risk Scoring Framework).",
    selector: "[data-tour='nav-dashboard']",
  },
  {
    id: "scanning",
    icon: <Scan size={24} style={{ color: "#2F5BFF" }} />,
    title: "Connect & Scan",
    description: "Connect your GitHub repositories, set up scan profiles, and trigger automated deep-dives into your code to find hidden cryptographic patterns.",
    tip: "Scans run asynchronously. You can monitor their progress in the Scans section.",
    selector: "[data-tour='nav-group-scanning']",
  },
  {
    id: "assets",
    icon: <Shield size={24} style={{ color: "#2F5BFF" }} />,
    title: "Review Assets & Findings",
    description: "Explore the comprehensive inventory of algorithms and keys discovered during scans. Review actionable remediation advice for insecure cryptography.",
    tip: "Use this section to prioritize what needs fixing first based on risk scores.",
    selector: "[data-tour='nav-group-assets']",
  },
];

export function OnboardingWizard() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  
  // Target element tracking
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // Check initial state
    try {
      const raw = localStorage.getItem(ONBOARDING_KEY);
      if (!raw) {
        setVisible(true);
      } else {
        const data = JSON.parse(raw) as { completed: string[]; dismissed: boolean };
        if (!data.dismissed) setVisible(true);
        setCompleted(new Set(data.completed ?? []));
      }
    } catch {
      setVisible(true);
    }

    // Listen for reopen events
    const handleReopen = () => {
      setVisible(true);
      setStep(0);
    };
    window.addEventListener(REOPEN_EVENT, handleReopen);
    return () => window.removeEventListener(REOPEN_EVENT, handleReopen);
  }, []);

  // Update target bounding rect when step or visibility changes
  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    
    const updateRect = () => {
      if (current.selector) {
        const el = document.querySelector(current.selector);
        if (el) {
          setTargetRect(el.getBoundingClientRect());
        } else {
          setTargetRect(null); // Fallback to centered if element not found
        }
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    
    // Optional: Update on resize to keep tooltip attached
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [step, visible]);

  function save(completedSet: Set<string>, dismissed: boolean) {
    localStorage.setItem(
      ONBOARDING_KEY,
      JSON.stringify({ completed: [...completedSet], dismissed })
    );
  }

  function markCurrentComplete() {
    const next = new Set(completed);
    next.add(STEPS[step].id);
    setCompleted(next);
    save(next, false);
  }

  function handleNext() {
    markCurrentComplete();
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleDismiss();
    }
  }

  function handleDismiss() {
    save(completed, true);
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const allDone = completed.size === STEPS.length;

  // Calculate position
  let style: React.CSSProperties = {};
  let arrowClass = "";

  if (targetRect) {
    // Position to the right of the target (since our targets are mostly sidebar items)
    style = {
      position: "fixed",
      top: `${Math.max(16, targetRect.top + targetRect.height / 2 - 150)}px`, // Roughly center vertically relative to target
      left: `${targetRect.right + 20}px`,
      width: "400px", // Smaller width for tooltip
      zIndex: 100,
    };
    arrowClass = "absolute -left-3 top-1/2 -translate-y-1/2 w-0 h-0 border-y-8 border-y-transparent border-r-[12px] border-r-white";
  } else {
    // Center fallback
    style = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "480px",
      zIndex: 100,
    };
  }

  return (
    <>
      {/* Overlay (only renders full background if no target) */}
      <div 
        className="fixed inset-0 z-40" 
        style={{ 
          backgroundColor: targetRect ? "transparent" : "rgba(26,31,54,0.45)",
          backdropFilter: targetRect ? "none" : "blur(2px)"
        }}
        onClick={handleDismiss}
      />
      
      {/* Tooltip Card */}
      <div
        className="animate-fade-in"
        style={{
          ...style,
          backgroundColor: "#FFFFFF",
          boxShadow: "0 32px 80px rgba(47,91,255,0.15), 0 8px 24px rgba(0,0,0,0.1)",
          border: "1px solid #D8DCE8",
          borderRadius: "16px",
        }}
      >
        {/* Arrow (only if pointing to a target) */}
        {targetRect && (
          <>
            {/* Border arrow */}
            <div className="absolute -left-[13px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[9px] border-y-transparent border-r-[13px]" style={{ borderRightColor: "#D8DCE8" }} />
            {/* Inner fill arrow */}
            <div className={arrowClass} />
          </>
        )}

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid #EEF0F7" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#2F5BFF" }}>
              Getting Started
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#EEF2FF", color: "#2F5BFF" }}
            >
              {step + 1} / {STEPS.length}
            </span>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: "#9AA2BA" }}
            aria-label="Close onboarding"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#EEF2FF", border: "1px solid #C7D4FF" }}
            >
              {current.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold mb-1.5" style={{ color: "#1A1F36" }}>
                {current.title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "#5A6480" }}>
                {current.description}
              </p>

              {current.action && (
                <a
                  href={current.action.href}
                  onClick={markCurrentComplete}
                  className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold"
                  style={{ color: "#2F5BFF", textDecoration: "none" }}
                >
                  {current.action.label}
                  <ChevronRight size={14} />
                </a>
              )}
            </div>
          </div>

          {/* Tip */}
          <div
            className="mt-4 rounded-lg px-3 py-2.5 flex items-start gap-2"
            style={{ backgroundColor: "#F8F9FD", border: "1px solid #EEF0F7" }}
          >
            <p className="text-xs" style={{ color: "#5A6480" }}>
              <strong style={{ color: "#1A1F36" }}>Tip:</strong> {current.tip}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: "1px solid #EEF0F7", backgroundColor: "#F8F9FD", borderBottomLeftRadius: "16px", borderBottomRightRadius: "16px" }}
        >
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
            style={{
              color: step === 0 ? "#D8DCE8" : "#5A6480",
              cursor: step === 0 ? "not-allowed" : "pointer",
            }}
          >
            <ChevronLeft size={14} />
            Prev
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg"
            style={{
              background: "linear-gradient(135deg, #2F5BFF 0%, #4B75FF 100%)",
              color: "#FFFFFF",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(47,91,255,0.25)",
            }}
          >
            {isLast ? (allDone ? "Finish" : "Start") : "Next"}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      
      {/* Target Highlight Overlay (optional, creates a cutout effect) */}
      {targetRect && (
        <div 
          className="fixed pointer-events-none z-50 rounded-lg"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            border: "2px solid #2F5BFF",
            boxShadow: "0 0 0 9999px rgba(26,31,54,0.45)", // Creates the overlay around the cutout
            borderRadius: "6px"
          }}
        />
      )}
    </>
  );
}

/** Small trigger button to re-open the wizard */
export function OnboardingTrigger() {
  function reopen() {
    try {
      const raw = localStorage.getItem(ONBOARDING_KEY);
      const data = raw ? JSON.parse(raw) : {};
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ ...data, dismissed: false }));
      
      // Dispatch custom event instead of reloading
      window.dispatchEvent(new Event(REOPEN_EVENT));
    } catch {
      // Fallback
    }
  }

  return (
    <button
      onClick={reopen}
      className="flex items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
      style={{ color: "#5A6480" }}
      aria-label="Open getting started guide"
    >
      <Sparkles size={14} style={{ color: "#2F5BFF" }} />
      Getting Started
    </button>
  );
}
