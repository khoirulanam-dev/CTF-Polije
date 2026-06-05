"use client";

import { ChallengeWithSolve } from "@/types";
import { getFirstBloodChallengeIds } from "@/lib/challenges";
import { useEffect, useState, Fragment } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getUserDetail } from "@/lib/users";
import { CategoryProgress, getUserCategoryProgress } from "@/lib/engagement";
import { formatRelativeDate } from "@/lib/utils";
import { motion } from "framer-motion";
import ImageWithFallback from "./ImageWithFallback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EditProfileModal from "./custom/EditProfileModal";
import Loader from "@/components/custom/loading";
import BackButton from "./custom/BackButton";
import { Github, Globe, Instagram, Linkedin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
  // Rank (push, don't return early)
  if (rank === 1) {
    badges.push({
      label: "Top 1",
      color: "bg-yellow-400 text-yellow-900 border-yellow-500",
      icon: "🥇",
    });
  } else if (rank && rank <= 2) {
    badges.push({
      label: "Top 2",
      color: "bg-yellow-300 text-yellow-900 border-yellow-400",
      icon: "🥈",
    });
  } else if (rank && rank <= 3) {
    badges.push({
      label: "Top 3",
      color: "bg-yellow-300 text-yellow-900 border-yellow-400",
      icon: "🥉",
    });
  } else if (rank && rank <= 4) {
    badges.push({
      label: "Top 4",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 5) {
    badges.push({
      label: "Top 5",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 6) {
    badges.push({
      label: "Top 6",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 7) {
    badges.push({
      label: "Top 7",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 8) {
    badges.push({
      label: "Top 8",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 9) {
    badges.push({
      label: "Top 9",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 10) {
    badges.push({
      label: "Top 10",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 11) {
    badges.push({
      label: "Top 11",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 12) {
    badges.push({
      label: "Top 12",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 13) {
    badges.push({
      label: "Top 13",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 14) {
    badges.push({
      label: "Top 14",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 15) {
    badges.push({
      label: "Top 15",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 16) {
    badges.push({
      label: "Top 16",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 17) {
    badges.push({
      label: "Top 17",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 18) {
    badges.push({
      label: "Top 18",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 19) {
    badges.push({
      label: "Top 19",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 20) {
    badges.push({
      label: "Top 20",
      color: "bg-yellow-200 text-yellow-900 border-yellow-300",
      icon: "🏅",
    });
  } else if (rank && rank <= 25) {
    badges.push({
      label: "Top 25",
      color: "bg-yellow-100 text-yellow-900 border-yellow-200",
      icon: "🏅",
    });
  } else if (rank && rank <= 50) {
    badges.push({
      label: "Top 50",
      color: "bg-yellow-50 text-yellow-900 border-yellow-100",
      icon: "🎖️",
    });
  }

  // First Blood (show only the highest tier)
  if (firstBloodCount >= 10) {
    badges.push({
      label: "King of First Bloods",
      color: "bg-pink-200 text-pink-900 border-pink-400",
      icon: "👑",
    });
  } else if (firstBloodCount >= 5) {
    badges.push({
      label: "5+ First Bloods",
      color: "bg-red-200 text-red-800 border-red-400",
      icon: "🩸",
    });
  } else if (firstBloodCount >= 1) {
    badges.push({
      label: "First Blood",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: "⚡",
    });
  }

  // Solved
  if (solvedCount >= 100)
    badges.push({
      label: "100+ Solves",
      color: "bg-green-700 text-white border-green-800",
      icon: "💯",
    });
  else if (solvedCount >= 50)
    badges.push({
      label: "50+ Solves",
      color: "bg-green-600 text-white border-green-700",
      icon: "🏆",
    });
  else if (solvedCount >= 25)
    badges.push({
      label: "25+ Solves",
      color: "bg-green-500 text-white border-green-600",
      icon: "🎯",
    });
  else if (solvedCount >= 10)
    badges.push({
      label: "10+ Solves",
      color: "bg-green-400 text-white border-green-500",
      icon: "🔥",
    });

  return badges;
}

function normalizeProfileUrl(url?: string | null) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function UserProfile({
  userId,
  loading,
  error,
  onBack,
  isCurrentUser = false,
}: Props) {
  const { user: authUser, setUser } = useAuth();
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [firstBloodIds, setFirstBloodIds] = useState<string[]>([]);
  const [categoryProgress, setCategoryProgress] = useState<CategoryProgress[]>([]);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(true);
  const [showAllModal, setShowAllModal] = useState(false);
  // Modal state removed, handled in EditProfileModal

  useEffect(() => {
    const fetchDetail = async () => {
      if (!userId) return;
      setLoadingDetail(true);
      try {
        const detail = await getUserDetail(userId);
        setUserDetail(detail);

        if (detail) {
          const firstBlood = await getFirstBloodChallengeIds(detail.id);
          // Filter: hanya id yang juga ada di solved_challenges
          const solvedIds = new Set(
            (detail.solved_challenges || []).map((c) => c.id)
          );
          setFirstBloodIds(firstBlood.filter((id) => solvedIds.has(id)));

          setCategoryProgress(await getUserCategoryProgress(detail.id));
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

  // Username truncation handled by Tailwind utility classes below

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Kondisi: Loader */}
        {isLoading && <Loader fullscreen color="text-orange-500" />}

        {/* Kondisi: Error */}
        {!isLoading && hasError && (
          <div className="max-w-4xl mx-auto py-16 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-red-400 dark:text-red-300">
                ❌
              </span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {error || "User not found"}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {isCurrentUser
                ? "Failed to load your profile."
                : "The user you are looking for doesn’t exist or has been removed."}
            </p>
            {onBack && <BackButton onClick={onBack} label="Go Back" />}
          </div>
        )}

        {/* Kondisi: Data */}
        {!isLoading && !hasError && userDetail && (
          <>
            {/* Back Button */}
            {onBack && (
              <BackButton onClick={onBack} label="Go Back" className="mb-4" />
            )}

            {/* Profile Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="bg-white dark:bg-gray-800">
                <CardContent className="flex flex-col gap-5 py-6 sm:flex-row sm:items-center sm:space-x-6 sm:gap-0">
                  <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center overflow-hidden">
                    <ImageWithFallback
                      src={userDetail.picture}
                      alt={userDetail.username}
                      size={80}
                      className="rounded-full border border-gray-200 dark:border-gray-700"
                      fallbackBg="bg-blue-100 dark:bg-blue-900"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1
                      className="text-2xl font-bold text-gray-900 dark:text-white truncate whitespace-nowrap max-w-[160px] sm:max-w-xs block"
                      title={userDetail.username}
                    >
                      {userDetail.username}
                    </h1>
                    <p className="text-lg text-gray-500 dark:text-gray-300 mt-1">
                      Score:{" "}
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        {userDetail.score}
                      </span>
                    </p>
                    {userDetail.bio && (
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                        {userDetail.bio}
                      </p>
                    )}
                    {socialLinks.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {socialLinks.map(({ label, href, Icon }) => (
                          <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-300"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {label}
                          </a>
                        ))}
                      </div>
                    )}
                    {/* BADGES */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getUserBadges(
                        userDetail.rank,
                        firstBloodIds.length,
                        solvedChallenges.length
                      ).map((badge, idx) => (
                        <span
                          key={badge.label + idx}
                          className={`inline-flex items-center border border-gray-300 dark:border-gray-600 px-1.5 py-0.5 rounded-md text-xs font-medium shadow-sm ${badge.color} transition-all duration-150 hover:scale-105`}
                          style={{ lineHeight: "1.2", minWidth: 0 }}
                        >
                          <span
                            className="mr-1 text-base"
                            style={{ fontSize: "1em" }}
                          >
                            {badge.icon}
                          </span>
                          <span className="truncate max-w-[100px]">
                            {badge.label}
                          </span>
                        </span>
                      ))}

                      {/* 👑 Badge tambahan: Pernah #1 */}
                      {/* 👑 Badge tambahan: Pernah Top 1–3 */}
                      {userDetail.highest_rank &&
                        userDetail.highest_rank <= 3 && (
                          <span
                            className={`inline-flex items-center border px-1.5 py-0.5 rounded-md text-xs font-semibold shadow-sm hover:scale-105 transition-all duration-150
                            ${
                              userDetail.highest_rank === 1
                                ? "border-yellow-400 bg-yellow-100 text-yellow-900"
                                : userDetail.highest_rank === 2
                                ? "border-gray-400 bg-gray-100 text-gray-900"
                                : "border-orange-400 bg-orange-100 text-orange-900"
                            }`}
                          >
                            <span
                              className="mr-1 text-base"
                              style={{ fontSize: "1em" }}
                            >
                              👑
                            </span>
                            <span className="truncate max-w-[100px]">
                              Highest Rank {userDetail.highest_rank}
                            </span>
                          </span>
                        )}
                    </div>
                  </div>
                  {isCurrentUser && userDetail && (
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
                      onProfileChange={(profile) =>
                        {
                        setUserDetail({
                          ...userDetail,
                          username: profile.username,
                          picture: profile.picture ?? profile.avatar_url ?? userDetail.picture,
                          avatar_url: profile.avatar_url ?? null,
                          bio: profile.bio ?? null,
                          github_url: profile.github_url ?? null,
                          linkedin_url: profile.linkedin_url ?? null,
                          instagram_url: profile.instagram_url ?? null,
                          website_url: profile.website_url ?? null,
                        })
                        if (isCurrentUser && authUser) {
                          setUser({
                            ...authUser,
                            username: profile.username,
                            picture: profile.picture ?? profile.avatar_url ?? authUser.picture,
                            avatar_url: profile.avatar_url ?? null,
                            bio: profile.bio ?? null,
                            github_url: profile.github_url ?? null,
                            linkedin_url: profile.linkedin_url ?? null,
                            instagram_url: profile.instagram_url ?? null,
                            website_url: profile.website_url ?? null,
                          })
                        }
                      }
                      }
                      triggerButtonClass="bg-blue-600 dark:bg-blue-500 text-white font-semibold hover:bg-blue-700 dark:hover:bg-blue-400 border-none shadow"
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Stats Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">
                    Rank
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                    🏅
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {userDetail.rank === 0 ? "0" : `#${userDetail.rank}`}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">
                    Solved
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                    ✓
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {solvedChallenges.length}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">
                    First Bloods
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                    🩸
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {firstBloodIds.length}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Category Progress */}
            {categoryProgress.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Card className="bg-white dark:bg-gray-800">
                  <CardHeader>
                    <CardTitle className="text-gray-900 dark:text-white">
                      Category Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {categoryProgress.map((item) => (
                      <div key={item.category}>
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.category}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-300">
                            {item.solved_challenges}/{item.total_challenges} · {item.solved_points} pts
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(Number(item.percentage || 0), 100)}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-2 rounded-full bg-blue-600 dark:bg-blue-400"
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Recent Solved Challenges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <Card className="bg-white dark:bg-gray-800">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-gray-900 dark:text-white">
                    Recent Solved Challenges
                  </CardTitle>
                  {solvedChallenges.length > 10 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAllModal(true)}
                    >
                      Show All
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {solvedChallenges.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No solved challenges yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {solvedChallenges.slice(0, 10).map((challenge) => (
                        <motion.div
                          key={challenge.id}
                          whileHover={{ scale: 1.02 }}
                          className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded-lg"
                        >
                          <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                              {challenge.title}
                              {firstBloodIds.includes(challenge.id) && (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                                  First Blood
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-300">
                              {challenge.category} • {challenge.difficulty} •{" "}
                              {challenge.solved_at
                                ? formatRelativeDate(challenge.solved_at)
                                : "-"}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-green-600 dark:text-green-300">
                            +{challenge.points}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Modal Show All Solved Challenges (Compact Clean Version) */}
            <Dialog open={showAllModal} onOpenChange={setShowAllModal}>
              <DialogContent className="max-w-3xl w-full p-0 border-0 shadow-2xl bg-white dark:bg-gray-900 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                  <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
                    All Solved Challenges
                  </DialogTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAllModal(false)}
                    className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                  >
                    ✕
                  </Button>
                </div>

                {/* Body */}
                <div className="p-0">
                  {solvedChallenges.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      No solved challenges yet
                    </div>
                  ) : (
                    <div className="overflow-y-auto max-h-[70vh] divide-y divide-gray-200 dark:divide-gray-700 scroll-hidden">
                      {solvedChallenges.map((challenge) => (
                        <div
                          key={challenge.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3"
                        >
                          {/* Left */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {challenge.title}
                              </span>
                              {firstBloodIds.includes(challenge.id) && (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                                  🩸 First Blood
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {challenge.category} • {challenge.difficulty} •{" "}
                              {challenge.solved_at
                                ? formatRelativeDate(challenge.solved_at)
                                : "-"}
                            </p>
                          </div>

                          {/* Right */}
                          <span className="text-sm font-semibold text-green-600 dark:text-green-300 whitespace-nowrap">
                            +{challenge.points}
                          </span>
                        </div>
                      ))}
                    </div>
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
