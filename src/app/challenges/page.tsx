"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import {
  getChallenges,
  submitFlag,
  getSolversByChallenge,
} from "@/lib/challenges";
import { ChallengeWithSolve, Attachment } from "@/types";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import ChallengeDetailDialog from "@/components/challenges/ChallengeDetailDialog";
import Loader from "@/components/custom/loading";
import TitlePage from "@/components/custom/TitlePage";
import { Solver } from "@/components/challenges/SolversList";
import ChallengeFilterBar from "@/components/challenges/ChallengeFilterBar";
import APP from "@/config";
import { useAuth } from "@/contexts/AuthContext";
import { useReducedMotion } from "@/contexts/ReducedMotionContext";
import ReducedMotionToggle from "@/components/ReducedMotionToggle";

export default function ChallengesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { reducedMotion } = useReducedMotion();

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
  useEffect(() => {
    const fetchChallenges = async () => {
      if (!user) return;
      const challengesData = await getChallenges(user.id);

      // normalisasi field hint
      const normalized = challengesData.map((challenge: any) => {
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

      setChallenges(normalized);
    };

    fetchChallenges();
  }, [user]);

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

      // refresh list sesudah submit
      const challengesData = await getChallenges(user.id);
      setChallenges(challengesData);

      setFlagFeedback((prev) => ({
        ...prev,
        [challengeId]: { success: result.success, message: result.message },
      }));

      if (result.success) {
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

  const handleFlagInputChange = (challengeId: string, value: string) => {
    setFlagInputs((prev) => ({ ...prev, [challengeId]: value }));
  };

  // filter challenge
  const filteredChallenges = challenges.filter((challenge) => {
    if (filters.status === "solved" && !challenge.is_solved) return false;
    if (filters.status === "unsolved" && challenge.is_solved) return false;
    if (filters.category !== "all" && challenge.category !== filters.category)
      return false;
    if (
      filters.difficulty !== "all" &&
      challenge.difficulty !== filters.difficulty
    )
      return false;
    if (filters.search) {
      const k = filters.search.toLowerCase();
      const titleMatch = challenge.title.toLowerCase().includes(k);
      const descMatch = challenge.description.toLowerCase().includes(k);
      if (!titleMatch && !descMatch) return false;
    }
    return true;
  });

  // urutan kategori
  const preferredOrder = APP.challengeCategories || [];
  const allCategories = Array.from(
    new Set(challenges.map((c) => c.category))
  ).filter(Boolean);

  const matchedCategorySet = new Set<string>();
  const categories = [
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

  const difficulties = Array.from(
    new Set(challenges.map((c) => c.difficulty))
  ).sort();

  // kelompokkan per kategori
  const grouped = filteredChallenges.reduce((acc, challenge) => {
    if (!acc[challenge.category]) acc[challenge.category] = [];
    acc[challenge.category].push(challenge);
    return acc;
  }, {} as { [key: string]: ChallengeWithSolve[] });

  const groupKeys = Object.keys(grouped);
  const matchedKeySet = new Set<string>();
  const orderedKeys = [
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

  // buat partikel deterministik biar ga mismatch
  const particles = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, i) => ({
        top: `${(i * 37) % 100}%`,
        left: `${(i * 19) % 100}%`,
        size: (i % 3) + 2,
        duration: 4 + (i % 5),
      })),
    []
  );

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

  if (loading) return <Loader fullscreen color="text-orange-500" />;
  if (!user) return null;

  // wrapper untuk section & card (kalau reducedMotion → pakai div biasa)
  const Section: any = reducedMotion ? "div" : motion.div;
  const CardWrapper: any = reducedMotion ? "div" : motion.div;

  return (
    <div className="relative min-h-screen pt-5 overflow-hidden">
      {/* background dinamis dimatikan kalau reducedMotion */}
      {!reducedMotion && (
        <>
          {/* 1) gradient dinamis */}
          <motion.div
            aria-hidden
            className="fixed inset-0 -z-30 bg-[radial-gradient(ellipse_at_top_left,_#0ea5e9_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_#4f46e5_0%,_transparent_55%)] blur-3xl"
            animate={{
              backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* 2) glow stream */}
          <motion.div
            aria-hidden
            className="fixed inset-0 -z-20 opacity-20 bg-[repeating-linear-gradient(180deg,_rgba(148,163,184,0.12)_0px,_rgba(148,163,184,0.12)_2px,_transparent_2px,_transparent_6px)]"
            animate={{
              backgroundPositionY: ["0%", "100%"],
            }}
            transition={{
              duration: 13,
              repeat: Infinity,
              ease: "linear",
            }}
          />

          {/* 3) partikel */}
          <motion.div
            aria-hidden
            className="fixed inset-0 -z-10 pointer-events-none"
            animate={{
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {particles.map((p, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-cyan-200/40"
                style={{
                  top: p.top,
                  left: p.left,
                  width: p.size,
                  height: p.size,
                }}
                animate={{
                  y: [0, -8, 0],
                  opacity: [0.2, 1, 0.2],
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.13,
                }}
              />
            ))}
          </motion.div>
        </>
      )}

      {/* style scrollbar */}
      <style jsx global>{`
        /* webkit scroll */
        ::-webkit-scrollbar {
          width: 9px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(2, 6, 23, 0.2);
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #38bdf8 0%, #0f172a 80%);
          border-radius: 9999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #0ea5e9 0%, #1d4ed8 100%);
        }
      `}</style>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5 pb-20">
        {/* header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <TitlePage>🚩 challenges</TitlePage>

          <div className="flex gap-3 items-center">
            <ReducedMotionToggle />
            <div className="rounded-2xl bg-slate-900/40 border border-slate-700/70 px-4 py-2 text-sm text-slate-100">
              Total chall:{" "}
              <span className="font-semibold">{challenges.length}</span>
            </div>
            <div className="rounded-2xl bg-slate-900/40 border border-slate-700/70 px-4 py-2 text-sm text-slate-100">
              Solved:{" "}
              <span className="font-semibold">
                {challenges.filter((c) => c.is_solved).length}
              </span>
            </div>
          </div>
        </div>

        {/* filter bar */}
        <div className="rounded-2xl bg-slate-950/50 border border-slate-800/70 backdrop-blur-sm shadow-[0_10px_40px_rgba(15,23,42,0.25)]">
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
        </div>

        {/* daftar challenge */}
        <div className="space-y-6">
          {filteredChallenges.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/50">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-slate-100 text-lg font-semibold">
                {challenges.length === 0
                  ? "No challenges available"
                  : "No challenges match your filters"}
              </p>
              <p className="text-slate-400 text-sm">
                {challenges.length === 0
                  ? "Check back later for new challenges"
                  : "Try adjusting your filter"}
              </p>
            </div>
          ) : (
            orderedKeys.map((category, idx) => (
              <Section
                key={category}
                {...(!reducedMotion
                  ? {
                      initial: { opacity: 0, y: 16 },
                      animate: { opacity: 1, y: 0 },
                      transition: { duration: 0.35, delay: idx * 0.04 },
                    }
                  : {})}
                className="space-y-3"
              >
                {/* judul kategori */}
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-gradient-to-b from-blue-400 via-cyan-300 to-blue-600 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                  <h2 className="text-[1.35rem] font-extrabold tracking-wider uppercase text-white drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]">
                    {category}
                  </h2>
                  <span className="ml-2 text-xs font-semibold text-sky-400 bg-sky-500/10 px-2 py-[1px] rounded-md border border-sky-600/40">
                    {grouped[category].length} Challenges
                  </span>
                </div>

                {/* grid challenge */}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {grouped[category].map((challenge) => (
                    <CardWrapper
                      key={challenge.id}
                      {...(!reducedMotion
                        ? {
                            whileHover: { y: -5, scale: 1.02 },
                            transition: {
                              type: "spring",
                              stiffness: 240,
                              damping: 18,
                            },
                          }
                        : {})}
                    >
                      <ChallengeCard
                        challenge={challenge}
                        onClick={() => setSelectedChallenge(challenge)}
                      />
                    </CardWrapper>
                  ))}
                </div>
              </Section>
            ))
          )}
        </div>
      </div>

      {/* dialog detail */}
      {user && (
        <ChallengeDetailDialog
          open={!!selectedChallenge}
          challenge={selectedChallenge}
          solvers={solvers}
          challengeTab={challengeTab}
          setChallengeTab={(tab, challengeId) => {
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
  );
}
