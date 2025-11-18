// src/components/ReducedMotionToggle.tsx
"use client";

import { useReducedMotion } from "@/contexts/ReducedMotionContext";

export default function ReducedMotionToggle() {
  const { reducedMotion, toggleReducedMotion } = useReducedMotion();

  return (
    <button
      type="button"
      onClick={toggleReducedMotion}
      className="inline-flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-xs md:text-sm bg-white/80 dark:bg-gray-900/80 backdrop-blur hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <span
        className={`h-2 w-2 rounded-full ${
          reducedMotion ? "bg-emerald-500" : "bg-gray-400"
        }`}
      />
      {reducedMotion ? "Reduced motion: ON" : "Reduced motion: OFF"}
    </button>
  );
}
