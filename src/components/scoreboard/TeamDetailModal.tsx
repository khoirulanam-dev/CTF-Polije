"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ImageWithFallback from "@/components/ImageWithFallback";
import { formatRelativeDate } from "@/lib/utils";
import Loader from "@/components/custom/loading";
import {
  Users,
  Trophy,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Search,
  Filter,
  Shield,
  Sparkles,
} from "lucide-react";

export type TeamDetailMember = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  role: "owner" | "member";
  joined_at: string;
  score: number;
  solves_count: number;
};

export type TeamDetailSolve = {
  id: string;
  challenge_id: string;
  challenge_title: string;
  category: string;
  points: number;
  solved_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
};

export type TeamDetailData = {
  success: boolean;
  team: {
    id: string;
    name: string;
    invite_code?: string;
    created_at: string;
  };
  members: TeamDetailMember[];
  solves: TeamDetailSolve[];
  total_score: number;
  total_solves: number;
  season_name: string;
  period: string;
};

interface TeamDetailModalProps {
  teamId: string | null;
  teamName?: string;
  rank?: number;
  seasonId?: string;
  period?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Web: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Crypto: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
  Forensics: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Reverse: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Pwn: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  Misc: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  Blockchain: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
};

export default function TeamDetailModal({
  teamId,
  teamName,
  rank,
  seasonId,
  period = "all",
  open,
  onOpenChange,
}: TeamDetailModalProps) {
  const [data, setData] = useState<TeamDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "solves">("members");
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!open || !teamId) {
      setData(null);
      setError(null);
      setSelectedMemberFilter("all");
      setSearchQuery("");
      return;
    }

    let isMounted = true;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams({
          team_id: teamId,
          ...(seasonId ? { season_id: seasonId } : {}),
          period,
        });

        const res = await fetch(`/api/scoreboard/team-detail?${queryParams.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Gagal memuat detail tim");
        }
        const json: TeamDetailData = await res.json();
        if (isMounted) {
          setData(json);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Gagal memuat detail tim");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [open, teamId, seasonId, period]);

  // Filtered Solves
  const filteredSolves = useMemo(() => {
    if (!data?.solves) return [];
    return data.solves.filter((s) => {
      const matchMember =
        selectedMemberFilter === "all" || s.user_id === selectedMemberFilter;
      const matchQuery =
        !searchQuery ||
        s.challenge_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.username.toLowerCase().includes(searchQuery.toLowerCase());
      return matchMember && matchQuery;
    });
  }, [data?.solves, selectedMemberFilter, searchQuery]);

  const displayName = data?.team?.name || teamName || "Detail Tim";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl rounded-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {displayName}
                  </DialogTitle>
                  {rank !== undefined && rank > 0 && (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                        rank === 1
                          ? "bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/40"
                          : rank === 2
                          ? "bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-400/20 dark:text-slate-200 dark:border-slate-400/40"
                          : rank === 3
                          ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-600/20 dark:text-amber-300 dark:border-amber-600/40"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      Rank #{rank}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{data?.season_name || "Scoreboard Tim"}</span>
                  {period !== "all" && (
                    <span className="capitalize font-medium text-blue-600 dark:text-blue-400">
                      • Periode {period}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats Banner */}
          {data && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-800/50 p-2.5 sm:p-3 text-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Total Poin
                </span>
                <p className="text-lg sm:text-xl font-bold font-mono text-blue-600 dark:text-cyan-400 mt-0.5">
                  {data.total_score}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-800/50 p-2.5 sm:p-3 text-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Total Solves
                </span>
                <p className="text-lg sm:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {data.total_solves}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-800/50 p-2.5 sm:p-3 text-center">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Anggota
                </span>
                <p className="text-lg sm:text-xl font-bold font-mono text-slate-800 dark:text-slate-100 mt-0.5">
                  {data.members.length}
                </p>
              </div>
            </div>
          )}

          {/* Tab Switcher */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 -mb-4 mt-4 pt-1">
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`pb-2.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "members"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Anggota Tim</span>
              {data && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {data.members.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("solves")}
              className={`pb-2.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "solves"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span>Daftar Solves</span>
              {data && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {data.solves.length}
                </span>
              )}
            </button>
          </div>
        </DialogHeader>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader fullscreen={false} color="text-blue-500" />
              <p className="text-xs text-slate-400">Memuat rincian tim...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-rose-500 text-sm">
              <p className="font-semibold">Terjadi Kesalahan</p>
              <p className="text-xs mt-1 text-rose-400">{error}</p>
            </div>
          ) : !data ? null : activeTab === "members" ? (
            /* TAB 1: MEMBERS */
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                Kontribusi Poin Anggota
              </div>

              {data.members.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  Belum ada anggota di tim ini.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.members.map((member) => {
                    const percentage =
                      data.total_score > 0
                        ? Math.round((member.score / data.total_score) * 100)
                        : 0;

                    return (
                      <div
                        key={member.user_id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 transition hover:border-slate-300 dark:hover:border-slate-700 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <ImageWithFallback
                              src={member.avatar_url}
                              alt={member.username}
                              size={40}
                              className="rounded-full ring-2 ring-slate-200 dark:ring-slate-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/user/${encodeURIComponent(member.username)}`}
                                  className="font-bold text-sm text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline truncate flex items-center gap-1"
                                  title={`Lihat profil ${member.username}`}
                                >
                                  <span>{member.username}</span>
                                  <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
                                </Link>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    member.role === "owner"
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50"
                                      : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  {member.role === "owner" ? "Leader / Owner" : "Member"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Bergabung {formatRelativeDate(member.joined_at)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-base text-blue-600 dark:text-cyan-400">
                              {member.score}{" "}
                              <span className="text-xs font-normal text-slate-400">pts</span>
                            </div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              {member.solves_count} solve
                              {member.solves_count !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar Kontribusi */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Kontribusi Poin Tim</span>
                            <span className="font-mono font-medium">{percentage}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(percentage, 2)}%` }}
                            />
                          </div>
                        </div>

                        {/* Quick filter button */}
                        {member.solves_count > 0 && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMemberFilter(member.user_id);
                                setActiveTab("solves");
                              }}
                              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              <span>Lihat soal yang di-solve {member.username}</span>
                              <span>→</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: SOLVES */
            <div className="space-y-3">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Member:</span>
                  </div>
                  <select
                    value={selectedMemberFilter}
                    onChange={(e) => setSelectedMemberFilter(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">Semua Anggota ({data.solves.length})</option>
                    {data.members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.username} ({m.solves_count})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari challenge / kategori..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Solves List */}
              {filteredSolves.length === 0 ? (
                <div className="text-center py-12 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-xs sm:text-sm">
                  {searchQuery || selectedMemberFilter !== "all"
                    ? "Tidak ada solve yang cocok dengan filter."
                    : "Belum ada challenge yang di-solve oleh tim ini pada periode/season yang dipilih."}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-800/40">
                  {filteredSolves.map((solve) => {
                    const catClass =
                      CATEGORY_COLORS[solve.category] ||
                      "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400";

                    return (
                      <div
                        key={solve.id}
                        className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/70 transition"
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                {solve.challenge_title}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${catClass}`}
                              >
                                {solve.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                              <span>Di-solve oleh:</span>
                              <Link
                                href={`/user/${encodeURIComponent(solve.username)}`}
                                className="font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <ImageWithFallback
                                  src={solve.avatar_url}
                                  alt={solve.username}
                                  size={16}
                                  className="rounded-full inline"
                                />
                                <span>{solve.username}</span>
                              </Link>
                              <span className="text-slate-300 dark:text-slate-600">•</span>
                              <span title={new Date(solve.solved_at).toLocaleString()}>
                                {formatRelativeDate(solve.solved_at)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0 pl-11 sm:pl-0">
                          <span className="inline-flex items-center font-mono font-bold text-xs sm:text-sm px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-cyan-300 border border-blue-200 dark:border-blue-700/50">
                            +{solve.points} pts
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
