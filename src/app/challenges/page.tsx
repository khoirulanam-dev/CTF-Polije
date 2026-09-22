"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

import { supabase } from "@/lib/supabase";
import {
  getChallenges,
  submitFlag,
  getSolversByChallenge,
} from "@/lib/challenges";
import { ChallengeWithSolve, Attachment } from "@/types";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import Loader from "@/components/custom/loading";
import TitlePage from "@/components/custom/TitlePage";
import { Solver } from "@/components/challenges/SolversList";
import ChallengeFilterBar from "@/components/challenges/ChallengeFilterBar";
import APP from "@/config";
import { useAuth } from "@/contexts/AuthContext";
import { useReducedMotion } from "@/contexts/ReducedMotionContext";
import { usePresence } from "@/contexts/PresenceContext";
import ReducedMotionToggle from "@/components/ReducedMotionToggle";

// Helper untuk normalisasi field hint
function normalizeChallengesList(challengesData: any[]): ChallengeWithSolve[] {
  return challengesData.map((challenge: any) => {
    let hints: string[] = [];
    const raw = challenge.hint;
    if (Array.isArray(raw)) {
      hints = raw.filter((h: any) => typeof h === "string");
    } else if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          hints = parsed.filter((h: any) => typeof h === "string");
        } else if (typeof parsed === "string") {
          hints = [parsed];
        } else if (parsed === null) {
          hints = [];
        }
      } catch {
        if (raw.trim() !== "") hints = [raw];
      }
    } else if (raw && typeof raw === "object") {
      // skip
    } else if (raw) {
      hints = [String(raw)];
    }
    return { ...challenge, hint: hints };
  });
}

// Code-split heavy dialog & chat widget (only loaded on-demand)
const ChallengeDetailDialog = dynamic(
  () => import("@/components/challenges/ChallengeDetailDialog"),
  { ssr: false }
);
const LiveChatWidget = dynamic(
  () => import("@/components/livechat/LiveChatWidget"),
  { ssr: false }
);

export default function ChallengesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { reducedMotion } = useReducedMotion();
  const { onlineCount, totalUsers } = usePresence();

  const [challengeTab, setChallengeTab] = useState<"challenge" | "solvers">(
    "challenge"
  );
  const [solvers, setSolvers] = useState<Solver[]>([]);
  const [challenges, setChallenges] = useState<ChallengeWithSolve[]>([]);
  const [flagInputs, setFlagInputs] = useState<{ [key: string]: string }>({});
  const [flagFeedback, setFlagFeedback] = useState<{
    [key: string]: { success: boolean; message: string } | null;
  }>({});
  const [submitting, setSubmitting] = useState<{ [key: string]: boolean }>({});
  const [showHintModal, setShowHintModal] = useState<{
    challenge: ChallengeWithSolve | null;
    hintIdx?: number;
  }>({ challenge: null });
  const [downloading, setDownloading] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [selectedChallenge, setSelectedChallenge] =
    useState<ChallengeWithSolve | null>(null);
  const [filters, setFilters] = useState({
    status: "all",
    category: "all",
    difficulty: "all",
    search: "",
  });

  // redirect kalau belum login
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // ambil challenges
  const fetchChallengesData = useCallback(async () => {
    if (!user) return;
    try {
      const challengesData = await getChallenges(user.id);
      setChallenges(normalizeChallengesList(challengesData));
    } catch (err) {
      console.error("Failed to fetch challenges:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchChallengesData();
  }, [fetchChallengesData]);

  // Real-time: sinkronisasi status solve khusus user ini tanpa beban berat
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-challenge-solves-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "solves",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Hanya query jika ada solve baru milik user ini
          fetchChallengesData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchChallengesData]);

  // kalau detail kebuka → ambil solvers
  useEffect(() => {
    if (selectedChallenge) {
      getSolversByChallenge(selectedChallenge.id)
        .then(setSolvers)
        .catch(() => setSolvers([]));
    }
  }, [selectedChallenge]);

  const handleTabChange = async (
    tab: "challenge" | "solvers",
    challengeId: string
  ) => {
    setChallengeTab(tab);
    if (tab === "solvers") {
      try {
        const data = await getSolversByChallenge(challengeId);
        setSolvers(data);
      } catch {
        setSolvers([]);
      }
    }
  };

  const handleFlagSubmit = async (challengeId: string) => {
    if (!user || !flagInputs[challengeId]?.trim()) return;

    setSubmitting((prev) => ({ ...prev, [challengeId]: true }));
    setFlagFeedback((prev) => ({ ...prev, [challengeId]: null }));

    try {
      const result = await submitFlag(
        challengeId,
        flagInputs[challengeId].trim()
      );

      setFlagFeedback((prev) => ({
        ...prev,
        [challengeId]: { success: result.success, message: result.message },
      }));

      if (result.success) {
        // Optimistic UI update: langsung tandai solve di state
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === challengeId
              ? {
                  ...c,
                  is_solved: true,
                  total_solves: (c.total_solves || 0) + 1,
                  has_first_blood: true,
                }
              : c
          )
        );

        const audio = new Audio("/sounds/succes.wav");
        audio.volume = 0.3;
        audio.play().catch(() => {});

        // confetti dimatikan kalau reducedMotion = true
        if (!reducedMotion) {
          import("canvas-confetti").then((confetti) => {
            const duration = 800;
            const end = Date.now() + duration;

            const frame = () => {
              confetti.default({
                particleCount: 3,
                startVelocity: 20,
                spread: 360,
                ticks: 80,
                gravity: 0.8,
                scalar: 0.8,
                colors: ["#00e0ff", "#ffffff", "#ff7b00"],
                origin: { x: Math.random(), y: Math.random() - 0.2 },
              });
              if (Date.now() < end) requestAnimationFrame(frame);
            };

            frame();
          });
        }

        setFlagInputs((prev) => ({ ...prev, [challengeId]: "" }));

        // Refresh data di background untuk sinkronisasi poin
        getChallenges(user.id).then((freshData) => {
          if (freshData && freshData.length > 0) {
            setChallenges(freshData);
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.error(err);
      setFlagFeedback((prev) => ({
        ...prev,
        [challengeId]: { success: false, message: "Failed to submit flag" },
      }));
    } finally {
      setSubmitting((prev) => ({ ...prev, [challengeId]: false }));
    }
  };

  const handleFlagInputChange = useCallback(
    (challengeId: string, value: string) => {
      setFlagInputs((prev) => ({ ...prev, [challengeId]: value }));
    },
    []
  );

  // filter challenge dengan memoization
  const filteredChallenges = useMemo(() => {
    const k = filters.search.toLowerCase().trim();
    return challenges.filter((challenge) => {
      if (filters.status === "solved" && !challenge.is_solved) return false;
      if (filters.status === "unsolved" && challenge.is_solved) return false;
      if (filters.category !== "all" && challenge.category !== filters.category)
        return false;
      if (
        filters.difficulty !== "all" &&
        challenge.difficulty !== filters.difficulty
      )
        return false;
      if (k) {
        const titleMatch = challenge.title.toLowerCase().includes(k);
        const descMatch = (challenge.description || "")
          .toLowerCase()
          .includes(k);
        if (!titleMatch && !descMatch) return false;
      }
      return true;
    });
  }, [challenges, filters]);

  // urutan kategori dengan memoization
  const categories = useMemo(() => {
    const preferredOrder = APP.challengeCategories || [];
    const allCategories = Array.from(
      new Set(challenges.map((c) => c.category))
    ).filter(Boolean);

    const matchedCategorySet = new Set<string>();
    return [
      ...preferredOrder.flatMap((p) => {
        const pLower = p.toLowerCase();
        const found = allCategories.find((c) => {
          const cLower = c.toLowerCase();
          return cLower.includes(pLower) || pLower.includes(cLower);
        });
        if (found && !matchedCategorySet.has(found)) {
          matchedCategorySet.add(found);
          return found;
        }
        return [] as string[];
      }),
      ...allCategories.filter((c) => !matchedCategorySet.has(c)).sort(),
    ];
  }, [challenges]);

  const difficulties = useMemo(() => {
    return Array.from(
      new Set(challenges.map((c) => c.difficulty))
    ).sort();
  }, [challenges]);

  // kelompokkan per kategori dengan memoization
  const { grouped, orderedKeys } = useMemo(() => {
    const preferredOrder = APP.challengeCategories || [];
    const grp = filteredChallenges.reduce((acc, challenge) => {
      if (!acc[challenge.category]) acc[challenge.category] = [];
      acc[challenge.category].push(challenge);
      return acc;
    }, {} as { [key: string]: ChallengeWithSolve[] });

    const groupKeys = Object.keys(grp);
    const matchedKeySet = new Set<string>();
    const ordKeys = [
      ...preferredOrder.flatMap((p) => {
        const pLower = p.toLowerCase();
        const found = groupKeys.find((k) => {
          const kLower = k.toLowerCase();
          return kLower.includes(pLower) || pLower.includes(kLower);
        });
        if (found && !matchedKeySet.has(found)) {
          matchedKeySet.add(found);
          return found;
        }
        return [] as string[];
      }),
      ...groupKeys.filter((k) => !matchedKeySet.has(k)).sort(),
    ];

    return { grouped: grp, orderedKeys: ordKeys };
  }, [filteredChallenges]);

  const downloadFile = async (
    attachment: Attachment,
    attachmentKey: string
  ) => {
    setDownloading((prev) => ({ ...prev, [attachmentKey]: true }));
    try {
      if (attachment.type === "file") {
        const res = await fetch(attachment.url);
        if (!res.ok) throw new Error("Failed to fetch file");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = attachment.name || "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        window.open(attachment.url, "_blank");
      }
    } catch (err) {
      console.error(err);
      window.open(attachment.url, "_blank");
    } finally {
      setDownloading((prev) => ({ ...prev, [attachmentKey]: false }));
    }
  };

  const solvedCount = useMemo(
    () => challenges.filter((c) => c.is_solved).length,
    [challenges]
  );

  if (loading) return <Loader fullscreen color="text-orange-500" />;
  if (!user) return null;

  return (
    <>
      <div className="relative min-h-screen pt-5 overflow-hidden">
      {/* Background halus berbasis CSS (GPU-accelerated, zero JS main-thread load) */}
      <div
        aria-hidden
        className="fixed inset-0 -z-30 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,_rgba(14,165,233,0.14)_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(79,70,229,0.14)_0%,_transparent_55%)]"
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-20 pointer-events-none opacity-15 bg-[repeating-linear-gradient(180deg,_rgba(148,163,184,0.12)_0px,_rgba(148,163,184,0.12)_2px,_transparent_2px,_transparent_6px)]"
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5 pb-20">
        {/* header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <TitlePage>🚩 challenges</TitlePage>

          <div className="flex gap-2.5 items-center flex-wrap">
            <ReducedMotionToggle />
            <div className="rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 px-3.5 py-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-xs">
              Total chall:{" "}
              <span className="font-bold text-slate-900 dark:text-white">{challenges.length}</span>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 px-3.5 py-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-xs">
              Solved:{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{solvedCount}</span>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 px-3.5 py-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-xs flex items-center gap-1.5">
              <span className="text-slate-400">👥</span> Users:{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {totalUsers > 0 ? totalUsers : "-"}
              </span>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 px-3.5 py-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-xs flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Online:{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {onlineCount}
              </span>
            </div>
          </div>
        </div>

        {/* filter bar */}
        <ChallengeFilterBar
          filters={filters}
          categories={categories}
          difficulties={difficulties}
          onFilterChange={setFilters}
          onClear={() =>
            setFilters({
              status: "all",
              category: "all",
              difficulty: "all",
              search: "",
            })
          }
          showStatusFilter={true}
        />

        {/* daftar challenge */}
        <div className="space-y-6">
          {filteredChallenges.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900/50">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-slate-900 dark:text-slate-100 text-lg font-semibold">
                {challenges.length === 0
                  ? "No challenges available"
                  : "No challenges match your filters"}
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {challenges.length === 0
                  ? "Check back later for new challenges"
                  : "Try adjusting your filter"}
              </p>
            </div>
          ) : (
            orderedKeys.map((category) => {
              const allCatChalls = challenges.filter(
                (c) => c.category === category
              );
              const totalCat = allCatChalls.length;
              const solvedCat = allCatChalls.filter((c) => c.is_solved).length;
              const percentCat =
                totalCat > 0 ? Math.round((solvedCat / totalCat) * 100) : 0;
              const isCompleted = totalCat > 0 && solvedCat === totalCat;

              return (
                <section key={category} className="space-y-3.5">
                  {/* Category Card Header & Progress Bar */}
                  <div className="rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 p-3.5 sm:p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-1.5 h-6 bg-gradient-to-b from-blue-500 via-cyan-400 to-blue-600 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                        <h2 className="text-[1.2rem] sm:text-[1.35rem] font-extrabold tracking-wider uppercase text-slate-900 dark:text-white">
                          {category}
                        </h2>
                        <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2.5 py-[2px] rounded-md border border-sky-200 dark:border-sky-600/40">
                          {grouped[category]?.length || 0} Challenges
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs font-semibold">
                        {isCompleted ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40 flex items-center gap-1 shadow-xs">
                            <span>✨</span> 100% Mastered
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700/60 font-mono">
                            {solvedCat} / {totalCat} Solved
                          </span>
                        )}
                        <span className="text-sky-600 dark:text-cyan-400 font-mono text-sm font-bold min-w-[36px] text-right">
                          {percentCat}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar Track */}
                    <div className="w-full bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/90 rounded-full h-2 overflow-hidden relative p-[1px]">
                      <div
                        className={`h-full transition-all duration-700 ease-out rounded-full ${
                          isCompleted
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                            : "bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-400 shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                        }`}
                        style={{ width: `${percentCat}%` }}
                      />
                    </div>
                  </div>

                  {/* grid challenge */}
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {grouped[category]?.map((challenge) => (
                      <ChallengeCard
                        key={challenge.id}
                        challenge={challenge}
                        onClick={() => setSelectedChallenge(challenge)}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>

      {/* dialog detail (code-split & dynamically loaded) */}
      {user && selectedChallenge && (
        <ChallengeDetailDialog
          open={!!selectedChallenge}
          challenge={selectedChallenge}
          solvers={solvers}
          challengeTab={challengeTab}
          setChallengeTab={(tab) => {
            if (tab === "solvers" && selectedChallenge) {
              handleTabChange(tab, selectedChallenge.id);
            } else {
              setChallengeTab(tab);
            }
          }}
          onClose={() => {
            setSelectedChallenge(null);
            setChallengeTab("challenge");
          }}
          flagInputs={flagInputs}
          handleFlagInputChange={handleFlagInputChange}
          handleFlagSubmit={handleFlagSubmit}
          submitting={submitting}
          flagFeedback={flagFeedback}
          downloading={downloading}
          downloadFile={downloadFile}
          showHintModal={showHintModal}
          setShowHintModal={setShowHintModal}
        />
      )}
      </div>
      <LiveChatWidget />
    </>
  );
}
