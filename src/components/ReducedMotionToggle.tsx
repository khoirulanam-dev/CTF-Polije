// src/components/ReducedMotionToggle.tsx
"use client";

import { useReducedMotion } from "@/contexts/ReducedMotionContext";

export default function ReducedMotionToggle() {
  const { reducedMotion, toggleReducedMotion } = useReducedMotion();

  return (
    <button
      type="button"
      onClick={toggleReducedMotion}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700/70 px-3.5 py-2 text-xs md:text-sm bg-white dark:bg-slate-900/40 text-slate-800 dark:text-slate-100 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors font-medium"
    >
      <span
        className={`h-2 w-2 rounded-full ${
          reducedMotion ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-slate-400 dark:bg-slate-600"
        }`}
      />
      {reducedMotion ? "Reduced motion: ON" : "Reduced motion: OFF"}
    </button>
  );
}
