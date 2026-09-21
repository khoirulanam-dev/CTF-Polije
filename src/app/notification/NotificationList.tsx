"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getCombinedNotifications } from "@/lib/challenges";
import { AppNotification } from "@/types";
import Link from "next/link";
import Loader from "@/components/custom/loading";
import { formatRelativeDate } from "@/lib/utils";

export default function NotificationList() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const notifs = await getCombinedNotifications(100);
        if (mounted) {
          setNotifications(notifs);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <Loader fullscreen color="text-orange-500" />;

  if (notifications.length === 0)
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="border rounded-2xl px-6 py-10 shadow-sm bg-white dark:bg-slate-900 dark:border-slate-800 flex flex-col items-center justify-center text-center text-sm text-gray-600 dark:text-gray-300"
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 border border-blue-500/20 mb-3 text-2xl">
          🔔
        </div>
        <p className="font-semibold text-gray-800 dark:text-gray-100 text-base">Belum Ada Notifikasi</p>
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Anda sudah melihat semua update terbaru!</p>
      </motion.div>
    );

  return (
    <ul className="space-y-3">
      {notifications.map((notif, idx) => {
        const isFeature = notif.notif_type === "feature_update";
        const isSystem = notif.notif_type === "system_update";
        const isNewChall = notif.notif_type === "new_challenge";
        const isFirstBlood = notif.notif_type === "first_blood";

        return (
          <motion.li
            key={notif.id || idx}
            className={`border rounded-2xl p-4 shadow-sm transition-all duration-200 ${
              isFeature
                ? "bg-cyan-50/70 border-cyan-200 hover:bg-cyan-50 hover:border-cyan-300 dark:bg-cyan-950/20 dark:border-cyan-500/30 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-950/30"
                : isNewChall
                ? "bg-amber-50/70 border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:bg-slate-900/60 dark:border-slate-800 dark:hover:border-amber-500/40 dark:hover:bg-slate-900/80"
                : isFirstBlood
                ? "bg-rose-50/70 border-rose-200 hover:bg-rose-50 hover:border-rose-300 dark:bg-slate-900/60 dark:border-slate-800 dark:hover:border-red-500/40 dark:hover:bg-slate-900/80"
                : "bg-purple-50/70 border-purple-200 hover:bg-purple-50 hover:border-purple-300 dark:bg-purple-950/20 dark:border-purple-500/30 dark:hover:border-purple-500/50 dark:hover:bg-purple-950/30"
            }`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(idx * 0.03, 0.4) }}
          >
            <div className="flex items-start gap-3.5">
              {/* Icon badge */}
              <span
                className={`flex items-center justify-center shrink-0 w-10 h-10 rounded-xl text-lg ${
                  isFeature
                    ? "bg-cyan-100/80 border border-cyan-300 text-cyan-600 dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-400 dark:shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                    : isNewChall
                    ? "bg-amber-100/80 border border-amber-300 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400"
                    : isFirstBlood
                    ? "bg-rose-100/80 border border-rose-300 text-rose-600 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400"
                    : "bg-purple-100/80 border border-purple-300 text-purple-600 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-400"
                }`}
              >
                {isFeature ? "✨" : isNewChall ? "🚩" : isFirstBlood ? "🩸" : "🚀"}
              </span>

              {/* Content body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border tracking-wide ${
                      isFeature
                        ? "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40"
                        : isNewChall
                        ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40"
                        : isFirstBlood
                        ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40"
                        : "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40"
                    }`}
                  >
                    {notif.badge || (isFeature ? "FITUR BARU" : isNewChall ? "SOAL BARU" : "FIRST BLOOD")}
                  </span>

                  {notif.category && (
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/60">
                      [{notif.category}]
                    </span>
                  )}

                  <span className="text-xs text-gray-500 dark:text-slate-400 ml-auto whitespace-nowrap">
                    {notif.created_at ? formatRelativeDate(notif.created_at) : ""}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide mt-1">
                  {notif.title}
                </h3>

                {/* Description or details */}
                {notif.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {notif.description}
                  </p>
                )}

                {/* Action Link if available */}
                {notif.link && (
                  <div className="mt-2.5">
                    <Link
                      href={notif.link}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors"
                    >
                      <span>Buka Halaman</span>
                      <span>→</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
