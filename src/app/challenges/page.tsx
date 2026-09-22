"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ChevronDown, Check, Eye, ArrowRight, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabase";
import {
  getChallenges,
  submitFlag,
  getSolversByChallenge,
} from "@/lib/challenges";
import { getActiveSeason, getPublicSeasons } from "@/lib/seasons";
import { isAdmin } from "@/lib/auth";
import { ChallengeWithSolve, Attachment, Season } from "@/types";
import { isAllowedAttachmentFileUrl, normalizeExternalHttpsUrl } from "@/lib/safe-url";
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

  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [allSeasons, setAllSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [adminPreviewChallenges, setAdminPreviewChallenges] = useState(false);
  const [challengesLoading, setChallengesLoading] = useState(false);

  // Cek admin & URL preview param on mount
  useEffect(() => {
    isAdmin().then((admin) => {
      setIsAdminUser(admin);
      if (admin) {
        supabase
          .from("seasons")
          .select("*")
          .order("number", { ascending: false })
          .then(({ data }) => {
            if (data) setAllSeasons(data as Season[]);
          });

        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const preview = params.get("preview_season") || params.get("season");
          if (preview) {
            setSelectedSeasonId(preview);
          }
        }
      } else {
        // User biasa: ambil season publik (termasuk draft yang Coming Soon)
        getPublicSeasons().then((pubSeasons) => {
          if (pubSeasons) setAllSeasons(pubSeasons);
        });

        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const sParam = params.get("season") || params.get("preview_season");
          if (sParam) {
            setSelectedSeasonId(sParam);
          }
        }
      }
    });
  }, []);

  const isContributorUser = Boolean(
    user?.role === "contributor" || user?.is_contributor
  ) && !isAdminUser;
  const canPreviewDraft = isAdminUser || isContributorUser;

  // ambil challenges
  const fetchChallengesData = useCallback(async () => {
    if (!user) return;
    try {
      const active = await getActiveSeason().catch(() => null);
      if (active) setActiveSeason(active);

      const targetSeasonId = selectedSeasonId ? selectedSeasonId : active?.id;
      const targetSeason = allSeasons.find((s) => s.id === targetSeasonId);

      // JIKA TARGET SEASON ADALAH DRAFT DAN BUKAN MODE PREVIEW (ADMIN / KONTRIBUTOR):
      // Kosongkan list challenges dan jangan fetch apapun!
      if (targetSeason?.status === "draft" && !adminPreviewChallenges) {
        setChallenges([]);
        setChallengesLoading(false);
        return;
      }

      setChallengesLoading(true);
      const isViewingNonActive =
        selectedSeasonId && selectedSeasonId !== active?.id;

      // showAll = true jika admin atau kontributor sedang preview draft season
      const showAll = Boolean(
        canPreviewDraft &&
          isViewingNonActive &&
          targetSeason?.status === "draft" &&
          adminPreviewChallenges
      );

      const challengesData = await getChallenges(
        user.id,
        showAll,
        targetSeasonId
      );
      setChallenges(normalizeChallengesList(challengesData));
    } catch (err) {
      console.error("Failed to fetch challenges:", err);
    } finally {
      setChallengesLoading(false);
    }
  }, [user, isAdminUser, canPreviewDraft, selectedSeasonId, allSeasons, adminPreviewChallenges]);

  useEffect(() => {
    fetchChallengesData();
  }, [fetchChallengesData]);

  const currentViewedSeason = useMemo(() => {
    if (selectedSeasonId) {
      return allSeasons.find((s) => s.id === selectedSeasonId) || activeSeason;
    }
    return activeSeason;
  }, [selectedSeasonId, allSeasons, activeSeason]);

  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  const seasonDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        seasonDropdownRef.current &&
        !seasonDropdownRef.current.contains(event.target as Node)
      ) {
        setSeasonDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  // Jika musim yang dipilih berstatus draft
  const isDraftSeason = Boolean(
    currentViewedSeason && currentViewedSeason.status === "draft"
  );

  // Mode Preview Soal (aktif jika admin atau kontributor mengeklik tombol buka preview soal pada season draft)
  const isPreviewMode = Boolean(
    canPreviewDraft && isDraftSeason && adminPreviewChallenges
  );

  // Mode Coming Soon (aktif untuk SEMUA role termasuk admin secara default saat melihat season draft)
  const isDraftComingSoon = Boolean(
    isDraftSeason && !isPreviewMode
  );

  // Mode Latihan / Practice Mode (melihat season yang sudah diarsipkan)
  const isArchivedView = Boolean(
    currentViewedSeason &&
      currentViewedSeason.status === "archived" &&
      activeSeason &&
      currentViewedSeason.id !== activeSeason.id
  );

  // Musim draft berikutnya (jika admin sedang membuat season baru dan statusnya draft)
  const upcomingDraftSeason = useMemo(() => {
    return allSeasons.find((s) => s.status === "draft") || null;
  }, [allSeasons]);

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

        // Refresh data di background untuk sinkronisasi poin & tetap di season yang sedang dilihat
        fetchChallengesData();
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
    const safeUrl = attachment.type === "file"
      ? (isAllowedAttachmentFileUrl(attachment.url) ? normalizeExternalHttpsUrl(attachment.url) : "")
      : normalizeExternalHttpsUrl(attachment.url);
    if (!safeUrl) {
      toast.error("URL attachment tidak valid atau tidak diizinkan");
      return;
    }

    setDownloading((prev) => ({ ...prev, [attachmentKey]: true }));
    try {
      if (attachment.type === "file") {
        const res = await fetch(safeUrl);
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
        window.open(safeUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error(err);
      window.open(safeUrl, "_blank", "noopener,noreferrer");
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
        className="fixed inset-0 -z-30 pointer-events-none bg-[#eaf5fb] dark:bg-[#102337]"
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-20 pointer-events-none opacity-15 bg-[repeating-linear-gradient(180deg,_rgba(148,163,184,0.12)_0px,_rgba(148,163,184,0.12)_2px,_transparent_2px,_transparent_6px)]"
      />

      {/* Reduced Motion Toggle terpisah di kanan dekat dinding (posisi independen) */}
      <div className="absolute top-5 right-4 sm:right-6 lg:right-8 z-30 hidden sm:block">
        <ReducedMotionToggle />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-5 pb-20">
        {/* header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* KIRI: Title, Season Aktif, & Panduan */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <TitlePage>🚩 challenges</TitlePage>

            {/* Season Badge & Dropdown Switcher */}
            <div className="relative" ref={seasonDropdownRef}>
              {allSeasons.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setSeasonDropdownOpen((prev) => !prev)}
                  className={`rounded-2xl border px-3.5 py-1.5 text-xs sm:text-sm font-medium shadow-xs transition flex items-center gap-2 group cursor-pointer ${
                    isPreviewMode
                      ? "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300"
                      : isDraftComingSoon
                      ? "bg-violet-500/15 hover:bg-violet-500/25 border-violet-500/40 text-violet-300"
                      : isArchivedView
                      ? "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                  }`}
                  title="Klik untuk memilih musim tantangan"
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`${!reducedMotion ? "animate-ping" : ""} absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isPreviewMode
                          ? "bg-amber-400"
                          : isDraftComingSoon
                          ? "bg-violet-400"
                          : isArchivedView
                          ? "bg-slate-400"
                          : "bg-emerald-400"
                      }`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isPreviewMode
                          ? "bg-amber-500"
                          : isDraftComingSoon
                          ? "bg-violet-500"
                          : isArchivedView
                          ? "bg-slate-500"
                          : "bg-emerald-500"
                      }`}
                    ></span>
                  </span>
                  <span>
                    {currentViewedSeason
                      ? currentViewedSeason.name.toLowerCase().startsWith("season")
                        ? currentViewedSeason.name
                        : `Season #${currentViewedSeason.number}: ${currentViewedSeason.name}`
                      : "Season 1"}
                    {isPreviewMode
                      ? " (Preview)"
                      : isDraftComingSoon
                      ? " (Coming Soon)"
                      : isArchivedView
                      ? " (Arsip)"
                      : " (Live)"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 opacity-60 group-hover:opacity-100 ${
                      seasonDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              ) : (
                <Link
                  href="/seasons"
                  className={`rounded-2xl border px-3.5 py-1.5 text-xs sm:text-sm font-medium shadow-xs transition flex items-center gap-1.5 ${
                    isPreviewMode
                      ? "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                  }`}
                  title="Lihat Riwayat & Info Season"
                >
                  <span className="relative flex h-2 w-2">
                    <span
                      className={`${!reducedMotion ? "animate-ping" : ""} absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isPreviewMode ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                    ></span>
                    <span
                      className={`relative inline-flex rounded-full h-2 w-2 ${
                        isPreviewMode ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                    ></span>
                  </span>
                  <span>
                    {currentViewedSeason
                      ? currentViewedSeason.name.toLowerCase().startsWith("season")
                        ? currentViewedSeason.name
                        : `Season #${currentViewedSeason.number}: ${currentViewedSeason.name}`
                      : "Season 1"}{" "}
                    (Live)
                  </span>
                </Link>
              )}

              {/* Custom Season Popover */}
              {seasonDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 w-72 sm:w-80 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                    <span>Pilih Musim</span>
                    {isAdminUser && (
                      <span className="text-[10px] text-amber-400/90 font-mono">👁️ ADMIN</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {allSeasons.map((s) => {
                      const isSelected =
                        (selectedSeasonId && selectedSeasonId === s.id) ||
                        (!selectedSeasonId && s.status === "active");

                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const val = s.id;
                            setChallenges([]);
                            setChallengesLoading(true);
                            setSelectedSeasonId(val === activeSeason?.id ? null : val);
                            setAdminPreviewChallenges(false);
                            setSeasonDropdownOpen(false);
                            if (typeof window !== "undefined") {
                              const url = new URL(window.location.href);
                              if (val && val !== activeSeason?.id) {
                                url.searchParams.set("preview_season", val);
                              } else {
                                url.searchParams.delete("preview_season");
                                url.searchParams.delete("season");
                              }
                              window.history.replaceState({}, "", url.toString());
                            }
                          }}
                          className={`w-full text-left p-2.5 rounded-xl transition flex items-center justify-between gap-2 group cursor-pointer ${
                            isSelected
                              ? "bg-blue-600/20 border border-blue-500/40 text-white"
                              : "hover:bg-slate-800/80 border border-transparent text-slate-300"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                              <span>Season #{s.number}: {s.name}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {s.status === "active" && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Sedang Aktif
                                </span>
                              )}
                              {s.status === "draft" && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                                  {isAdminUser ? "Persiapan (Draft)" : "Coming Soon 🚀"}
                                </span>
                              )}
                              {s.status === "archived" && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                  Diarsipkan (Latihan)
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <Check size={16} className="text-blue-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1.5 mt-1 border-t border-slate-800 flex items-center justify-between text-xs px-2 py-1">
                    <Link
                      href="/seasons"
                      onClick={() => setSeasonDropdownOpen(false)}
                      className="text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
                    >
                      <span>🏆</span> Hall of Fame
                    </Link>
                    {isAdminUser && (
                      <Link
                        href="/admin/seasons"
                        onClick={() => setSeasonDropdownOpen(false)}
                        className="text-blue-400 hover:text-blue-300 font-medium transition flex items-center gap-1"
                      >
                        <span>⚙️</span> Kelola Musim
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* KANAN: Statistik Platform & Reduced Motion dipisah di paling kanan */}
          <div className="flex items-center gap-2 flex-wrap lg:justify-end">
            {!isDraftComingSoon && (
              <>
                <div className="rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 px-3 py-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-xs">
                  Total chall:{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {challengesLoading ? "..." : challenges.length}
                  </span>
                </div>
                <div className="rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 px-3 py-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-xs">
                  Solved:{" "}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {challengesLoading ? "..." : solvedCount}
                  </span>
                </div>
              </>
            )}
            <div className="rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 px-3 py-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-xs flex items-center gap-1.5">
              <span className="text-slate-400">👥</span> Users:{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {totalUsers > 0 ? totalUsers : "-"}
              </span>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/70 px-3 py-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-xs flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className={`${!reducedMotion ? "animate-ping" : ""} absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75`}></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Online:{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {onlineCount}
              </span>
            </div>
          </div>
        </div>

          {/* Fallback Reduced motion toggle khusus layar kecil (mobile) */}
          <div className="sm:hidden flex justify-end">
            <ReducedMotionToggle />
          </div>

        {/* Coming Soon Teaser Banner (Muncul untuk SEMUA role saat melihat season aktif dan ada season draft berikutnya) */}
        {upcomingDraftSeason && !selectedSeasonId && (
          <div className="rounded-2xl p-4 bg-gradient-to-r from-violet-100 via-purple-100 to-indigo-100 dark:from-violet-950/70 dark:via-purple-900/35 dark:to-slate-900/80 border border-violet-300 dark:border-violet-500/35 text-violet-900 dark:text-violet-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-violet-950/20 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-200 dark:bg-violet-500/20 border border-violet-300 dark:border-violet-500/40 text-xl shadow-inner">
                🚀
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-200 dark:bg-violet-500/25 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-500/40">
                    Coming Soon
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {upcomingDraftSeason.name} Sedang Disiapkan!
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Admin sedang merancang tantangan baru untuk musim berikutnya. Seluruh soal &amp; flag baru masih dirahasiakan sampai peluncuran resmi.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedSeasonId(upcomingDraftSeason.id);
                setAdminPreviewChallenges(false);
              }}
              className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-md self-end sm:self-auto shrink-0 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Lihat Detail Musim Baru</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Preview Banner for Admin or Contributor */}
        {isPreviewMode && currentViewedSeason && (
          <div className="rounded-2xl p-4 bg-gradient-to-r from-purple-500/15 via-violet-500/10 to-indigo-500/15 border border-purple-500/40 text-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{isAdminUser ? "👁️" : "✏️"}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {isAdminUser ? "Mode Preview Admin" : "Mode Preview Kontributor"}
                  </span>
                  <span className="text-xs font-semibold text-slate-300">
                    {currentViewedSeason.status === "draft"
                      ? "Status: DRAFT (Persiapan Musim Baru)"
                      : `Status: ${currentViewedSeason.status.toUpperCase()}`}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 mt-1">
                  Menampilkan {challenges.length} soal untuk{" "}
                  <strong className="text-purple-300">{currentViewedSeason.name}</strong>.
                  {isContributorUser
                    ? " Anda hanya dapat membuka dialog soal yang Anda buat sendiri. Soal author lain terkunci."
                    : " Peserta biasa saat ini hanya melihat tampilan Coming Soon."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setAdminPreviewChallenges(false)}
                className="px-3 py-1.5 rounded-xl bg-violet-600/80 hover:bg-violet-600 border border-violet-500/40 text-xs font-semibold text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>🚀</span> Tampilan Coming Soon
              </button>
              {isAdminUser ? (
                <Link
                  href={`/admin?season=${currentViewedSeason.id}`}
                  className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition"
                >
                  Kelola di Admin
                </Link>
              ) : (
                <Link
                  href="/contributor"
                  className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-purple-500/40 text-xs font-medium text-purple-300 transition"
                >
                  Panel Kontributor
                </Link>
              )}
              <button
                onClick={() => {
                  setChallenges([]);
                  setChallengesLoading(true);
                  setSelectedSeasonId(null);
                  setAdminPreviewChallenges(false);
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("preview_season");
                    url.searchParams.delete("season");
                    window.history.replaceState({}, "", url.pathname);
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-sm"
              >
                Kembali ke Season Aktif
              </button>
            </div>
          </div>
        )}

        {/* Mode Latihan / Archived Season Banner */}
        {isArchivedView && currentViewedSeason && (
          <div className="rounded-2xl p-4 bg-gradient-to-r from-slate-800/90 via-indigo-950/40 to-slate-900/90 border border-slate-700/80 text-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📚</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-700/80 text-slate-200 border border-slate-600">
                    Mode Latihan (Arsip)
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    {currentViewedSeason.name} (Telah Berakhir)
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Menampilkan {challenges.length} soal dari musim lampau. Anda tetap dapat mengerjakan soal ini untuk latihan mengasah kemampuan!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <Link
                href={`/seasons?season=${currentViewedSeason.number}`}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition"
              >
                Lihat Hall of Fame
              </Link>
              <button
                onClick={() => {
                  setChallenges([]);
                  setChallengesLoading(true);
                  setSelectedSeasonId(null);
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("preview_season");
                    url.searchParams.delete("season");
                    window.history.replaceState({}, "", url.pathname);
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm"
              >
                Kembali ke Musim Aktif
              </button>
            </div>
          </div>
        )}

        {isDraftComingSoon && currentViewedSeason ? (
          <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-br from-violet-950/40 via-slate-900/90 to-slate-950 border border-violet-500/30 text-center space-y-6 shadow-2xl relative overflow-hidden my-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/40 text-violet-300 text-xs font-bold tracking-wider uppercase">
              <span className={`h-2 w-2 rounded-full bg-violet-400 ${!reducedMotion ? "animate-ping" : ""}`} />
              <span>🚀 SEGERA HADIR / COMING SOON</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {currentViewedSeason.name}
              </h2>
              <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                {currentViewedSeason.description ||
                  "Musim kompetisi baru sedang dalam tahap persiapan matang oleh tim pembuat tantangan. Seluruh soal dan flag masih dirahasiakan sampai kompetisi resmi dibuka!"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-2 text-left">
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400 font-medium">Tantangan Soal</div>
                <div className="text-sm font-bold text-violet-300 flex items-center gap-1.5">
                  <span>🔒</span> Terkunci & Rahasia
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400 font-medium">Live Scoreboard</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>✨</span> Mulai 0 Poin
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400 font-medium">First Blood</div>
                <div className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  <span>🩸</span> Siap Diperebutkan
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setChallenges([]);
                  setChallengesLoading(true);
                  setSelectedSeasonId(null);
                  setAdminPreviewChallenges(false);
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("preview_season");
                    url.searchParams.delete("season");
                    window.history.replaceState({}, "", url.pathname);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 transition flex items-center gap-2 cursor-pointer"
              >
                <span>🚩</span> Kembali ke Musim Aktif
              </button>
              <Link
                href="/seasons"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm transition flex items-center gap-2"
              >
                <span>🏆</span> Lihat Hall of Fame
              </Link>
            </div>

            {isAdminUser && (
              <div className="pt-6 mt-4 border-t border-violet-500/20 max-w-xl mx-auto space-y-3">
                <div className="text-xs text-amber-300 font-medium flex items-center justify-center gap-1.5">
                  <span>👁️</span> <strong>Akses Khusus Admin:</strong> Anda dapat melihat &amp; menguji tantangan draft sebelum musim dibuka.
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAdminPreviewChallenges(true)}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/25 flex items-center gap-2 cursor-pointer"
                  >
                    <Eye size={16} />
                    <span>Buka Preview Soal (Mode Admin)</span>
                  </button>
                  <Link
                    href={`/admin?season=${currentViewedSeason.id}`}
                    className="px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <span>⚙️</span> Kelola di Panel Admin
                  </Link>
                </div>
              </div>
            )}

            {isContributorUser && (
              <div className="pt-6 mt-4 border-t border-purple-500/20 max-w-xl mx-auto space-y-3">
                <div className="text-xs text-purple-300 font-medium flex items-center justify-center gap-1.5">
                  <span>✏️</span> <strong>Akses Kontributor:</strong> Anda dapat melihat pratinjau daftar tantangan di musim ini dan menguji soal buatan Anda.
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAdminPreviewChallenges(true)}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition shadow-lg shadow-purple-600/25 flex items-center gap-2 cursor-pointer"
                  >
                    <Eye size={16} />
                    <span>Buka Preview Soal (Mode Kontributor)</span>
                  </button>
                  <Link
                    href="/contributor"
                    className="px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-purple-500/40 text-purple-300 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <span>➕</span> Tambah Soal di Panel Kontributor
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
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
              {challengesLoading ? (
                <div className="text-center py-24 space-y-3">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
                  <p className="text-xs text-slate-400 font-medium">Memuat tantangan...</p>
                </div>
              ) : filteredChallenges.length === 0 ? (
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
                            {isCompleted && (
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/40">
                                100% COMPLETE
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {solvedCat}
                            </span>{" "}
                            / {totalCat} Solved{" "}
                            <span className="text-blue-600 dark:text-blue-400 font-bold ml-1.5">
                              {percentCat}%
                            </span>
                          </div>
                        </div>

                        {/* Visual Progress Line */}
                        <div className="w-full bg-slate-100 dark:bg-slate-800/70 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentCat}%` }}
                          />
                        </div>
                      </div>

                      {/* grid challenge */}
                      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {grouped[category]?.map((challenge) => {
                          const isOwn = isContributorUser ? Boolean(
                            challenge.created_by === user?.id ||
                            challenge.author === user?.username ||
                            (challenge.description && challenge.description.toLowerCase().includes(`author: ${user?.username?.toLowerCase()}`))
                          ) : false;
                          const isLocked = isContributorUser && !isOwn;

                          return (
                            <ChallengeCard
                              key={challenge.id}
                              challenge={challenge}
                              isLocked={isLocked}
                              isOwnChallenge={isOwn}
                              onClick={() => {
                                if (isLocked) {
                                  toast.error('Sebagai kontributor, Anda hanya dapat melihat detail soal yang Anda buat sendiri.');
                                  return;
                                }
                                setSelectedChallenge(challenge);
                              }}
                            />
                          );
                        })}
                      </div>
                    </section>
                  );
                })
              )}
            </div>
          </>
        )}
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
