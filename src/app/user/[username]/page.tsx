"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getUserByUsername } from "@/lib/users";
import UserProfile from "@/components/UserProfile";
import { useAuth } from "@/contexts/AuthContext";
import Loader from "@/components/custom/loading";

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if trailing ? in URL (e.g. /user/siapa%20ya?)
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.location.search === "?" &&
      window.location.hash === ""
    ) {
      // Remove trailing ? and reload
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const username = decodeURIComponent(params.username as string);

      try {
        const userData = await getUserByUsername(username);

        if (!userData) {
          setError("User not found");
          setLoading(false);
          return;
        }

        setUserId(userData.id);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user:", err);
        setError("Failed to load user profile");
        setLoading(false);
      }
    };

    fetchData();
  }, [user, params]);

  // Tunggu authContext
  if (authLoading) return <Loader fullscreen color="text-orange-500" />;

  // Redirect if not logged in
  if (!user) {
    router.push("/login");
    return null;
  }

  // If still loading
  if (loading) {
    return <Loader fullscreen color="text-orange-500" />;
  }

  // If error / user not found
  if (error) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-slate-50 dark:bg-[#0b101b] px-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-8 text-center backdrop-blur-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-2xl text-rose-500">
            ⚠️
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            User Not Found
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {error || "The user you are looking for does not exist or has been removed."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => router.push("/scoreboard")}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition border border-slate-200 dark:border-slate-700"
            >
              Scoreboard
            </button>
            <button
              onClick={() => router.push("/challenges")}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition shadow-sm"
            >
              Challenges
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <UserProfile
      userId={userId}
      loading={loading}
      error={error}
      onBack={() => router.back()}
      isCurrentUser={userId === user?.id}
    />
  );
}
