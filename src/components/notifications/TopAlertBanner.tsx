"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useNotifications } from "@/contexts/NotificationsContext";

const DURATION_MS = 5000;

export default function TopAlertBanner() {
  const { activeAlert, dismissAlert } = useNotifications();
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);

  useEffect(() => {
    if (!activeAlert) {
      setProgress(100);
      elapsedRef.current = 0;
      return;
    }

    startTimeRef.current = Date.now();
    elapsedRef.current = 0;
    setProgress(100);

    const interval = setInterval(() => {
      if (isPaused) {
        startTimeRef.current = Date.now() - elapsedRef.current;
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      elapsedRef.current = elapsed;
      const remaining = Math.max(0, DURATION_MS - elapsed);
      const pct = (remaining / DURATION_MS) * 100;

      setProgress(pct);

      if (remaining <= 0) {
        clearInterval(interval);
        dismissAlert();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [activeAlert, isPaused, dismissAlert]);

  if (!activeAlert) return null;

  const badgeText = activeAlert.badge || (
    activeAlert.notif_type === "feature_update"
      ? "✨ FITUR BARU"
      : activeAlert.notif_type === "new_challenge"
      ? "🚩 SOAL BARU"
      : "🚀 UPDATE"
  );

  const badgeColor =
    activeAlert.notif_type === "feature_update"
      ? "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40"
      : activeAlert.notif_type === "new_challenge"
      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40"
      : "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40";

  const progressColor =
    activeAlert.notif_type === "feature_update"
      ? "from-cyan-500 via-blue-500 to-teal-400"
      : activeAlert.notif_type === "new_challenge"
      ? "from-amber-500 via-orange-500 to-yellow-400"
      : "from-purple-500 via-pink-500 to-indigo-400";

  return (
    <AnimatePresence>
      <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-3 sm:px-4 pointer-events-none">
        <motion.div
          key={activeAlert.id}
          initial={{ opacity: 0, y: -25, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-cyan-500/40 backdrop-blur-xl shadow-xl dark:shadow-[0_12px_40px_rgba(0,0,0,0.7)]"
        >
        <div className="p-3.5 sm:p-4 flex items-start gap-3">
          {/* Pulsing Icon */}
          <div className="shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-cyan-500/10 border border-blue-200 dark:border-cyan-500/30 text-lg shadow-xs">
            {activeAlert.notif_type === "feature_update"
              ? "✨"
              : activeAlert.notif_type === "new_challenge"
              ? "🚩"
              : "📢"}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border tracking-wide ${badgeColor}`}
              >
                {badgeText}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {Math.ceil((progress / 100) * 5)}s
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide truncate drop-shadow-sm">
              {activeAlert.title}
            </h4>

            {activeAlert.description && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                {activeAlert.description}
              </p>
            )}

            {/* Actions */}
            <div className="mt-2.5 flex items-center gap-3">
              <Link
                href={activeAlert.link || "/notification"}
                onClick={() => dismissAlert()}
                className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-cyan-400 dark:hover:text-cyan-300 underline underline-offset-2 flex items-center gap-1 transition-colors"
              >
                <span>Lihat Detail</span>
                <span>→</span>
              </Link>
              <Link
                href="/notification"
                onClick={() => dismissAlert()}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                Buka Notifikasi
              </Link>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => dismissAlert()}
            aria-label="Tutup Alert"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800/60 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 5-Second Countdown Progress Bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-900/80 h-1 relative overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${progressColor} shadow-[0_0_8px_rgba(6,182,212,0.8)] transition-[width] duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
