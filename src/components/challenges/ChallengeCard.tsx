import { ChallengeWithSolve } from "@/types";
import React from "react";
import APP from "@/config";

interface ChallengeCardProps {
  challenge: ChallengeWithSolve & {
    has_first_blood?: boolean;
    is_new?: boolean;
  };
  onClick: () => void;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, onClick }) => {
  const isRecentlyCreated = challenge.is_new;
  const noFirstBlood = !challenge.has_first_blood;

  let ribbonLabel: string | null = null;
  if (noFirstBlood) ribbonLabel = "🩸 FIRST BLOOD";
  else if (isRecentlyCreated) ribbonLabel = "NEW";

  // Difficulty color mapping
  const rawDiff = (challenge.difficulty || "").toString().trim();
  const normalizedDiff =
    rawDiff === "imposible"
      ? "Impossible"
      : rawDiff.charAt(0).toUpperCase() + rawDiff.slice(1).toLowerCase();
  const colorName = (APP as any).difficultyStyles?.[normalizedDiff];
  const colorMap: Record<string, { dot: string; glow: string }> = {
    cyan: { dot: "bg-cyan-400", glow: "shadow-[0_0_8px_rgba(6,182,212,0.8)]" },
    green: { dot: "bg-emerald-400", glow: "shadow-[0_0_8px_rgba(16,185,129,0.8)]" },
    yellow: { dot: "bg-amber-400", glow: "shadow-[0_0_8px_rgba(251,191,36,0.8)]" },
    red: { dot: "bg-rose-500", glow: "shadow-[0_0_8px_rgba(244,63,94,0.8)]" },
    purple: { dot: "bg-purple-400", glow: "shadow-[0_0_8px_rgba(192,132,252,0.8)]" },
  };
  const diffStyle = colorMap[colorName] || {
    dot: "bg-slate-400",
    glow: "shadow-[0_0_8px_rgba(148,163,184,0.6)]",
  };

  const isSolved = challenge.is_solved;

  return (
    <div
      key={challenge.id}
      onClick={onClick}
      className={`group relative cursor-pointer select-none rounded-xl p-4 sm:p-5 transition-all duration-150 ease-out hover:-translate-y-1 shadow-sm hover:shadow-md ${
        isSolved
          ? "bg-emerald-50/70 dark:bg-[#131b26] border-2 border-emerald-500/60 hover:border-emerald-500 hover:bg-emerald-50/90 dark:hover:border-emerald-400 dark:hover:bg-[#131b26]"
          : "bg-white dark:bg-[#131b26] border border-slate-200 dark:border-[#263347] hover:border-blue-400 dark:hover:border-[#3f5373] hover:bg-slate-50/80 dark:hover:bg-[#172130]"
      }`}
    >
      {/* Top row: Difficulty indicator & Solved status badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#0c121a] border border-slate-200 dark:border-[#263347] text-xs text-slate-700 dark:text-slate-300 font-medium"
          title={`Difficulty: ${normalizedDiff}`}
        >
          <span className={`block w-2.5 h-2.5 rounded-full ${diffStyle.dot}`} />
          <span className="capitalize">{normalizedDiff}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {ribbonLabel && !isSolved && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                noFirstBlood
                  ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40"
                  : "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40"
              }`}
            >
              {ribbonLabel}
            </span>
          )}

          {isSolved && (
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/50 flex items-center gap-1">
              <span>✓</span> Solved
            </span>
          )}
        </div>
      </div>

      {/* Challenge Title */}
      <div className="py-2.5 text-center">
        <h3
          className={`text-sm font-bold tracking-wide truncate transition-colors ${
            isSolved
              ? "text-slate-900 dark:text-emerald-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-300"
              : "text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400"
          }`}
          title={challenge.title}
        >
          {challenge.title}
        </h3>
      </div>

      {/* Points & Solves info */}
      <div className="mt-3 flex items-center justify-center gap-2.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-[#0c121a] border border-amber-200 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 font-mono text-xs font-bold shadow-xs">
          <span>🪙</span>
          <span>{challenge.points} pts</span>
        </div>

        {typeof challenge.total_solves === "number" && (
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {challenge.total_solves} {challenge.total_solves === 1 ? "solve" : "solves"}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ChallengeCard);
