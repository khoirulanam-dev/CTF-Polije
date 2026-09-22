"use client";

import { ChallengeWithSolve } from "@/types";
import { getFirstBloodChallengeIds } from "@/lib/challenges";
import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getUserDetail, getUserLastActive } from "@/lib/users";
import { CategoryProgress, getUserCategoryProgress } from "@/lib/engagement";
import { formatRelativeDate } from "@/lib/utils";
import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";
import { Button } from "@/components/ui/button";
import EditProfileModal from "./custom/EditProfileModal";
import Loader from "@/components/custom/loading";
import BackButton from "./custom/BackButton";
import {
  Github,
  Globe,
  Instagram,
  Linkedin,
  Clock,
  Sparkles,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence } from "@/contexts/PresenceContext";

type UserDetail = {
  id: string;
  username: string;
  rank: number | null;
  score: number;
  picture?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  website_url?: string | null;
  solved_challenges: ChallengeWithSolve[];
  highest_rank?: number | null;
  highest_rank_at?: string | null;
};

type Props = {
  userId: string | null;
  loading: boolean;
  error?: string | null;
  onBack?: () => void;
  isCurrentUser?: boolean;
};

// Badge type
type Badge = {
  label: string;
  color: string;
  icon: string;
};

function getUserBadges(
  rank: number | null,
  firstBloodCount: number,
  solvedCount: number
): Badge[] {
  const badges: Badge[] = [];

  // Rank badge
  if (rank === 1) {
    badges.push({
      label: "Top 1",
      color:
        "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/40 shadow-xs",
      icon: "🥇",
    });
  } else if (rank === 2) {
    badges.push({
      label: "Top 2",
      color:
        "bg-slate-300/20 text-slate-700 dark:text-slate-200 border-slate-400/40 shadow-xs",
      icon: "🥈",
    });
  } else if (rank === 3) {
    badges.push({
      label: "Top 3",
      color:
        "bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-500/40 shadow-xs",
      icon: "🥉",
    });
  } else if (rank && rank <= 10) {
    badges.push({
      label: `Top ${rank}`,
      color:
        "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 shadow-xs",
      icon: "🏅",
    });
  } else if (rank && rank <= 20) {
    badges.push({
      label: `Top ${rank}`,
      color:
        "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 shadow-xs",
      icon: "🏅",
    });
  } else if (rank && rank <= 50) {
    badges.push({
      label: `Top ${rank}`,
      color:
        "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30 shadow-xs",
      icon: "🎖️",
    });
  }

  // First Blood (show highest tier)
  if (firstBloodCount >= 10) {
    badges.push({
      label: "King of First Bloods",
      color:
        "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 shadow-xs",
      icon: "👑",
    });
  } else if (firstBloodCount >= 5) {
    badges.push({
      label: "5+ First Bloods",
      color:
        "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 shadow-xs",
      icon: "🩸",
    });
  } else if (firstBloodCount >= 1) {
    badges.push({
      label: "First Blood",
      color:
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-xs",
      icon: "⚡",
    });
  }

  // Solved challenges count
  if (solvedCount >= 100) {
    badges.push({
      label: "100+ Solves",
      color:
        "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/50 shadow-xs",
      icon: "💯",
    });
  } else if (solvedCount >= 50) {
    badges.push({
      label: "50+ Solves",
      color:
        "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 shadow-xs",
      icon: "🏆",
    });
  } else if (solvedCount >= 25) {
    badges.push({
      label: "25+ Solves",
      color:
        "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-xs",
      icon: "🎯",
    });
  } else if (solvedCount >= 10) {
    badges.push({
      label: "10+ Solves",
      color:
        "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30 shadow-xs",
      icon: "🔥",
    });
  }

  return badges;
}

function normalizeProfileUrl(url?: string | null) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// Category gradient color mapping
const categoryGradients: Record<string, string> = {
  Web: "from-sky-500 to-cyan-400",
  Reverse: "from-purple-500 to-indigo-400",
  Crypto: "from-emerald-500 to-teal-400",
  Forensics: "from-amber-500 to-orange-400",
  Network: "from-blue-500 to-indigo-400",
  Blockchain: "from-yellow-500 to-amber-400",
  "Binary Exploitation": "from-rose-500 to-red-400",
  Misc: "from-pink-500 to-rose-400",
  Intro: "from-teal-500 to-emerald-400",
};

export default function UserProfile({
  userId,
  loading,
  error,
  onBack,
  isCurrentUser = false,
}: Props) {
  const { user: authUser, setUser } = useAuth();
  const { getUserLastSeen } = usePresence();
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [firstBloodIds, setFirstBloodIds] = useState<string[]>([]);
  const [categoryProgress, setCategoryProgress] = useState<CategoryProgress[]>(
    []
  );
  const [loadingDetail, setLoadingDetail] = useState<boolean>(true);
  const [showAllModal, setShowAllModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!userId) return;
      setLoadingDetail(true);
      try {
        const detail = await getUserDetail(userId);
        setUserDetail(detail);

        if (detail) {
          const firstBlood = await getFirstBloodChallengeIds(detail.id);
          const solvedIds = new Set(
            (detail.solved_challenges || []).map((c) => c.id)
          );
          setFirstBloodIds(firstBlood.filter((id) => solvedIds.has(id)));
          setCategoryProgress(await getUserCategoryProgress(detail.id));

          // Fetch true latest platform activity (chat, solve, update)
          const latestSolve =
            detail.solved_challenges?.find((c) => c.solved_at)?.solved_at || null;
          getUserLastActive(detail.id, detail.username, latestSolve).then(
            (activeDate) => {
              if (activeDate) setLastActiveAt(activeDate);
            }
          );
        }
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [userId]);

  const isLoading = loading || loadingDetail;
  const hasError = error || !userDetail;
  const solvedChallenges = userDetail?.solved_challenges || [];

  const latestSolveDate = useMemo(() => {
    if (!userDetail?.solved_challenges || userDetail.solved_challenges.length === 0) {
      return userDetail?.highest_rank_at || null;
    }
    const withDate = userDetail.solved_challenges.filter((c) => c.solved_at);
    if (withDate.length === 0) return userDetail?.highest_rank_at || null;
    return withDate[0].solved_at || null;
  }, [userDetail]);

  const userStatus = getUserLastSeen(
    userDetail?.id,
    userDetail?.username,
    lastActiveAt || latestSolveDate
  );

  // Filtered challenges for modal
  const filteredChallenges = useMemo(() => {
    if (!searchQuery.trim()) return solvedChallenges;
    const q = searchQuery.toLowerCase();
    return solvedChallenges.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.difficulty && c.difficulty.toLowerCase().includes(q))
    );
  }, [solvedChallenges, searchQuery]);

  const socialLinks = userDetail
    ? [
        {
          label: "GitHub",
          href: normalizeProfileUrl(userDetail.github_url),
          Icon: Github,
        },
        {
          label: "LinkedIn",
          href: normalizeProfileUrl(userDetail.linkedin_url),
          Icon: Linkedin,
        },
        {
          label: "Instagram",
          href: normalizeProfileUrl(userDetail.instagram_url),
          Icon: Instagram,
        },
        {
          label: "Website",
          href: normalizeProfileUrl(userDetail.website_url),
          Icon: Globe,
        },
      ].filter((link) => link.href)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101b] text-slate-900 dark:text-slate-100 relative overflow-hidden">
      {/* Subtle Ambient Radial Glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.12),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.08),transparent_70%)] -z-10" />

      <div className="max-w-5xl mx-auto py-8 sm:py-10 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Loading State */}
        {isLoading && <Loader fullscreen color="text-orange-500" />}

        {/* Error State */}
        {!isLoading && hasError && (
          <div className="max-w-md mx-auto py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-3xl text-rose-500 mx-auto mb-4">
              ⚠️
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {error || "User not found"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              {isCurrentUser
                ? "Failed to load your profile."
                : "The user you are looking for doesn't exist or has been removed."}
            </p>
            {onBack && <BackButton onClick={onBack} label="Go Back" />}
          </div>
        )}

        {/* Profile Content */}
        {!isLoading && !hasError && userDetail && (
          <>
            {/* Top Bar with Back Button */}
            <div className="flex items-center justify-between">
              {onBack && <BackButton onClick={onBack} label="Back to Leaderboard" />}
              {isCurrentUser && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Your Public Profile
                </span>
              )}
            </div>

            {/* Profile Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-sm relative overflow-hidden p-6 sm:p-8"
            >
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-70" />

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
                {/* Avatar with Rank Glow */}
                <div className="relative shrink-0">
                  <div className="relative rounded-full">
                    <ImageWithFallback
                      src={userDetail.picture}
                      alt={userDetail.username}
                      size={104}
                      rounded={true}
                      className={`rounded-full ring-4 transition-all duration-300 ${
                        userDetail.rank === 1
                          ? "ring-yellow-400 shadow-[0_0_25px_rgba(234,179,8,0.45)]"
                          : userDetail.rank === 2
                          ? "ring-slate-300 shadow-[0_0_20px_rgba(203,213,225,0.35)]"
                          : userDetail.rank === 3
                          ? "ring-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                          : "ring-slate-200 dark:ring-slate-700/80"
                      }`}
                      fallbackBg="bg-blue-100 dark:bg-slate-800"
                    />
                  </div>
                  {userDetail.rank && userDetail.rank <= 3 && (
                    <span className="absolute -bottom-1 -right-1 text-2xl filter drop-shadow-md select-none">
                      {userDetail.rank === 1
                        ? "🥇"
                        : userDetail.rank === 2
                        ? "🥈"
                        : "🥉"}
                    </span>
                  )}
                  {userStatus.isOnline && (
                    <span
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shadow-xs"
                      title="Online now"
                    />
                  )}
                </div>

                {/* Info and Metadata */}
                <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                        <h1
                          className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate"
                          title={userDetail.username}
                        >
                          {userDetail.username}
                        </h1>
                        {isCurrentUser && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40 uppercase tracking-wide">
                            You
                          </span>
                        )}
                      </div>

                      {/* Score Badge and Online/Last Seen */}
                      <div className="mt-2.5 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-cyan-400 font-mono font-bold text-sm sm:text-base">
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>{userDetail.score.toLocaleString()}</span>
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            pts
                          </span>
                        </div>

                        {userStatus.isOnline ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold shadow-xs">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Online</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 text-xs font-medium shadow-xs">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{userStatus.text}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Edit Profile (if current user) */}
                    {isCurrentUser && (
                      <div className="sm:self-start flex justify-center">
                        <EditProfileModal
                          userId={userDetail.id}
                          currentUsername={userDetail.username}
                          currentPicture={userDetail.picture}
                          currentBio={userDetail.bio}
                          currentGithubUrl={userDetail.github_url}
                          currentLinkedinUrl={userDetail.linkedin_url}
                          currentInstagramUrl={userDetail.instagram_url}
                          currentWebsiteUrl={userDetail.website_url}
                          onUsernameChange={(username) =>
                            setUserDetail({ ...userDetail, username })
                          }
                          onProfileChange={(profile) => {
                            setUserDetail({
                              ...userDetail,
                              username: profile.username,
                              picture:
                                profile.picture ??
                                profile.avatar_url ??
                                userDetail.picture,
                              avatar_url: profile.avatar_url ?? null,
                              bio: profile.bio ?? null,
                              github_url: profile.github_url ?? null,
                              linkedin_url: profile.linkedin_url ?? null,
                              instagram_url: profile.instagram_url ?? null,
                              website_url: profile.website_url ?? null,
                            });
                            if (isCurrentUser && authUser) {
                              setUser({
                                ...authUser,
                                username: profile.username,
                                picture:
                                  profile.picture ??
                                  profile.avatar_url ??
                                  authUser.picture,
                                avatar_url: profile.avatar_url ?? null,
                                bio: profile.bio ?? null,
                                github_url: profile.github_url ?? null,
                                linkedin_url: profile.linkedin_url ?? null,
                                instagram_url: profile.instagram_url ?? null,
                                website_url: profile.website_url ?? null,
                              });
                            }
                          }}
                          triggerButtonClass="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all"
                        />
                      </div>
                    )}
                  </div>

                  {/* Bio */}
                  {userDetail.bio && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                      {userDetail.bio}
                    </p>
                  )}

                  {/* Social Links */}
                  {socialLinks.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      {socialLinks.map(({ label, href, Icon }) => (
                        <a
                          key={label}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white border border-slate-200 dark:border-slate-700/60 transition-all shadow-xs"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{label}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Achievement Badges */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    {getUserBadges(
                      userDetail.rank,
                      firstBloodIds.length,
                      solvedChallenges.length
                    ).map((badge, idx) => (
                      <span
                        key={badge.label + idx}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-transform duration-150 hover:scale-105 ${badge.color}`}
                      >
                        <span className="text-sm leading-none">
                          {badge.icon}
                        </span>
                        <span>{badge.label}</span>
                      </span>
                    ))}

                    {/* Highest Rank Badge */}
                    {userDetail.highest_rank && userDetail.highest_rank <= 3 && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border shadow-xs transition-transform duration-150 hover:scale-105 ${
                          userDetail.highest_rank === 1
                            ? "border-yellow-500/40 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                            : userDetail.highest_rank === 2
                            ? "border-slate-400/40 bg-slate-300/20 text-slate-700 dark:text-slate-200"
                            : "border-amber-500/40 bg-amber-600/15 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        <span className="text-sm leading-none">👑</span>
                        <span>Highest Rank #{userDetail.highest_rank}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 3-Column Metrics Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6"
            >
              {/* Rank Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 p-5 backdrop-blur-md shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Current Rank
                    </p>
                    <p className="mt-1.5 text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
                      {userDetail.rank === 0 ? "0" : `#${userDetail.rank ?? "-"}`}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-2xl shadow-xs">
                    🏆
                  </div>
                </div>
              </div>

              {/* Solved Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 p-5 backdrop-blur-md shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Challenges Solved
                    </p>
                    <p className="mt-1.5 text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
                      {solvedChallenges.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center text-2xl shadow-xs">
                    🎯
                  </div>
                </div>
              </div>

              {/* First Bloods Card */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 p-5 backdrop-blur-md shadow-sm relative overflow-hidden group hover:border-rose-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      First Bloods
                    </p>
                    <p className="mt-1.5 text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white">
                      {firstBloodIds.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center text-2xl shadow-xs">
                    🩸
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Category Progress */}
            {categoryProgress.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 p-6 backdrop-blur-md shadow-sm space-y-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📊</span>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                      Category Progress
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {categoryProgress.length} categories
                  </span>
                </div>

                <div className="space-y-4">
                  {categoryProgress.map((item) => {
                    const percentage = Math.min(
                      Math.round(Number(item.percentage || 0)),
                      100
                    );
                    const gradient =
                      categoryGradients[item.category] ||
                      "from-blue-500 to-cyan-400";
                    const isComplete = percentage === 100;

                    return (
                      <div key={item.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-200">
                              {item.category}
                            </span>
                            {isComplete && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                100%
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                              {item.solved_challenges}/{item.total_challenges}{" "}
                              solves
                            </span>
                            <span className="text-slate-300 dark:text-slate-700">
                              •
                            </span>
                            <span className="font-mono font-semibold text-blue-600 dark:text-cyan-400">
                              {item.solved_points} pts
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px] w-9 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </div>

                        <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/80 p-0.5 overflow-hidden border border-slate-200/60 dark:border-slate-700/40">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className={`h-full rounded-full bg-gradient-to-r ${gradient} ${
                              isComplete
                                ? "shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                                : ""
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Recent Solved Challenges */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/70 p-6 backdrop-blur-md shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚡</span>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    Recent Solved Challenges
                  </h2>
                </div>
                {solvedChallenges.length > 10 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setShowAllModal(true);
                    }}
                    className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Show All ({solvedChallenges.length})
                  </Button>
                )}
              </div>

              {solvedChallenges.length === 0 ? (
                <div className="text-center py-10 text-slate-500 dark:text-slate-400 text-sm">
                  No solved challenges yet
                </div>
              ) : (
                <div className="space-y-2.5">
                  {solvedChallenges.slice(0, 10).map((challenge) => {
                    const isFirstBlood = firstBloodIds.includes(challenge.id);
                    const diff = challenge.difficulty?.toLowerCase();
                    const difficultyColor =
                      diff === "easy"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : diff === "medium"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : diff === "hard"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";

                    return (
                      <div
                        key={challenge.id}
                        className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-800/70 transition-all"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {challenge.title}
                            </h3>
                            {isFirstBlood && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                🩸 First Blood
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {challenge.category}
                            </span>
                            {challenge.difficulty && (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${difficultyColor}`}
                              >
                                {challenge.difficulty}
                              </span>
                            )}
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {challenge.solved_at
                                ? formatRelativeDate(challenge.solved_at)
                                : "-"}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="font-mono font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
                            +{challenge.points}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-0.5">
                            pts
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Modal: Show All Solved Challenges */}
            <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
              <DialogContent className="max-w-2xl w-full p-0 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                        All Solved Challenges
                      </DialogTitle>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {solvedChallenges.length} total solved challenges
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowAllModal(false)}
                      className="rounded-lg h-8 w-8 p-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Search Filter Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search solved challenges..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                {/* Challenges List */}
                <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
                  {filteredChallenges.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
                      {searchQuery
                        ? "No challenges found matching your search."
                        : "No solved challenges yet."}
                    </div>
                  ) : (
                    filteredChallenges.map((challenge) => {
                      const isFirstBlood = firstBloodIds.includes(challenge.id);
                      const diff = challenge.difficulty?.toLowerCase();
                      const difficultyColor =
                        diff === "easy"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : diff === "medium"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                        : diff === "hard"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";

                      return (
                        <div
                          key={challenge.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 transition-all"
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {challenge.title}
                              </span>
                              {isFirstBlood && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                  🩸 First Blood
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                {challenge.category}
                              </span>
                              {challenge.difficulty && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${difficultyColor}`}
                                >
                                  {challenge.difficulty}
                                </span>
                              )}
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {challenge.solved_at
                                  ? formatRelativeDate(challenge.solved_at)
                                  : "-"}
                              </span>
                            </div>
                          </div>

                          <span className="shrink-0 font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                            +{challenge.points} pts
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
}
