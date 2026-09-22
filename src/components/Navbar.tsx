"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ImageWithFallback from "./ImageWithFallback";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { signOut, isAdmin, isContributor } from "@/lib/auth";
import { useNotifications } from "@/contexts/NotificationsContext";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import APP from "@/config";
import { getPublicSeasons } from "@/lib/seasons";
import type { Season } from "@/types";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminStatus, setAdminStatus] = useState(false);
  const [contribStatus, setContribStatus] = useState(false);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);

  useEffect(() => {
    if (user) {
      isAdmin().then(setAdminStatus);
      isContributor().then(setContribStatus);
    } else {
      setAdminStatus(false);
      setContribStatus(false);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const loadActiveSeason = async () => {
      const seasons = await getPublicSeasons();
      if (mounted) {
        setActiveSeason(seasons.find((season) => season.status === "active") || null);
      }
    };

    void loadActiveSeason();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await signOut();
    setUser(null);
    setAdminStatus(false);
    router.push("/login");
  };

  // helper buat active state
  const isActive = (path: string) => pathname === path;

  // Strict role check: admin strictly cannot be contributor
  const isActuallyAdmin = Boolean(user?.is_admin || user?.role === 'admin' || adminStatus);
  const isActuallyContributor = Boolean(
    !isActuallyAdmin && (user?.role === 'contributor' || user?.is_contributor || contribStatus)
  );

  if (loading) return null;

  return (
    <nav
      className={`fixed top-0 left-0 z-50 w-full border-b backdrop-blur-md transition-colors
      ${
        theme === "dark"
          ? "bg-slate-950/65 border-white/5"
          : "bg-white/75 border-slate-200/60"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* LEFT: logo + links */}
        <div className="flex items-center gap-7">
          {/* logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white shadow-[0_6px_18px_rgba(59,130,246,0.45)]">
              <span className="text-base font-bold leading-none">
                {APP.shortName.charAt(0)}
              </span>
            </div>
            <div className="flex items-center gap-2 leading-tight">
              <p
                className={`text-[1.1rem] font-extrabold tracking-wide ${
                  theme === "dark" ? "text-white" : "text-slate-900"
                } group-hover:text-blue-400 transition`}
              >
                {APP.shortName}
              </p>
              {activeSeason && (
                <span
                  title={`${activeSeason.name} sedang aktif`}
                  aria-label={`Season ${activeSeason.number} sedang aktif`}
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide ${
                    theme === "dark"
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : "border-emerald-600/30 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  S{activeSeason.number}
                </span>
              )}
            </div>
          </Link>

          {/* desktop links */}
          <div className="hidden gap-1 md:flex">
            {user && (
              <Link
                href="/challenges"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${
                    isActive("/challenges")
                      ? "bg-slate-900/60 text-white ring-1 ring-blue-400/40"
                      : theme === "dark"
                      ? "text-slate-200 hover:bg-slate-900/30"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
              >
                Challenges
              </Link>
            )}

            {user && (
              <Link
                href="/scoreboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${
                    isActive("/scoreboard")
                      ? "bg-slate-900/60 text-white ring-1 ring-blue-400/40"
                      : theme === "dark"
                      ? "text-slate-200 hover:bg-slate-900/30"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
              >
                Scoreboard
              </Link>
            )}

            <Link
              href="/seasons"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${
                  isActive("/seasons")
                    ? "bg-slate-900/60 text-white ring-1 ring-blue-400/40"
                    : theme === "dark"
                    ? "text-slate-200 hover:bg-slate-900/30"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
            >
              Seasons
            </Link>

            {user && (
              <Link
                href="/teams"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${
                    isActive("/teams")
                      ? "bg-slate-900/60 text-white ring-1 ring-blue-400/40"
                      : theme === "dark"
                      ? "text-slate-200 hover:bg-slate-900/30"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
              >
                Teams
              </Link>
            )}

            {user && (
              <Link
                href="/activity"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${
                    isActive("/activity")
                      ? "bg-slate-900/60 text-white ring-1 ring-blue-400/40"
                      : theme === "dark"
                      ? "text-slate-200 hover:bg-slate-900/30"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
              >
                Activity
              </Link>
            )}

            <Link
              href="/panduan"
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${
                  isActive("/panduan")
                    ? "bg-slate-900/60 text-white ring-1 ring-blue-400/40"
                    : theme === "dark"
                    ? "text-slate-200 hover:bg-slate-900/30"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
            >
              Panduan
            </Link>

            {!user && (
              <Link
                href="/rules"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${
                    isActive("/rules")
                      ? "bg-slate-900/60 text-white ring-1 ring-yellow-400/30"
                      : theme === "dark"
                      ? "text-slate-200 hover:bg-slate-900/30"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
              >
                Rules
              </Link>
            )}

            {isActuallyContributor && user && (
              <Link
                href="/contributor"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${
                    isActive("/contributor")
                      ? "bg-slate-900/60 text-white ring-1 ring-purple-400/40"
                      : theme === "dark"
                      ? "text-slate-200 hover:bg-slate-900/30"
                      : "text-slate-700 hover:bg-purple-50"
                  }`}
              >
                Kontribusi Soal
              </Link>
            )}

            {isActuallyAdmin && user && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${
                    isActive("/admin")
                      ? "bg-slate-900/60 text-white ring-1 ring-blue-400/40"
                      : theme === "dark"
                      ? "text-slate-200 hover:bg-slate-900/30"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
              >
                Admin
              </Link>
            )}
          </div>
        </div>

        {/* RIGHT: auth, notif, theme */}
        <div className="flex items-center gap-3">
          {/* notif */}
          {user && (
            <div className="relative hidden sm:block">
              <button
                className={`flex h-9 w-9 items-center justify-center rounded-full transition
                  ${
                    pathname === "/notification"
                      ? "bg-slate-900/80 ring-1 ring-blue-400/40"
                      : "hover:bg-slate-900/40"
                  }`}
                onClick={() => {
                  if (pathname === "/notification") {
                    if (window.history.length > 1) router.back();
                    else router.push("/");
                  } else {
                    router.push("/notification");
                  }
                }}
                title="Notifications"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
          )}

          {/* theme switch */}
          <AnimatedThemeToggler
            theme={theme}
            onThemeChange={(nextTheme) => {
              if (nextTheme !== theme) toggleTheme();
            }}
            className="hidden h-8 w-8 items-center justify-center rounded-full bg-slate-900/40 text-yellow-300 hover:bg-slate-900/70 sm:flex"
          />

          {/* auth section */}
          <div className="hidden items-center gap-2 sm:flex">
            {user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 rounded-full bg-slate-900/30 px-2 py-1.5 pr-3 text-sm text-slate-100 hover:bg-slate-900/60 transition"
                >
                  <ImageWithFallback
                    src={user.picture}
                    alt={user.username}
                    size={30}
                    className="rounded-full"
                  />
                  <span
                    className="max-w-[120px] truncate"
                    title={user.username}
                  >
                    {user.username}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded-full bg-red-500 px-3 py-1.5 text-sm font-medium text-white shadow-[0_8px_22px_rgba(248,113,113,0.35)] hover:bg-red-400 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition
                    ${
                      isActive("/login")
                        ? "bg-blue-500 text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)]"
                        : "bg-slate-900/30 text-slate-50 hover:bg-slate-900/60"
                    }`}
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition
                    ${
                      isActive("/register")
                        ? "bg-slate-100 text-slate-900"
                        : "border border-slate-700/70 text-slate-100 hover:bg-slate-900/40"
                    }`}
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen((p) => !p)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/40 text-slate-100 hover:bg-slate-900/70 md:hidden"
          >
            {mobileMenuOpen ? (
              <svg
                className="h-5 w-5"
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
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* mobile nav */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden border-t backdrop-blur-lg ${
            theme === "dark"
              ? "bg-slate-950/90 border-slate-800"
              : "bg-white/80 border-slate-200"
          }`}
        >
          <div className="space-y-2 px-4 py-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-700/40 bg-slate-900/20 px-3 py-2">
              <span className="text-sm text-slate-200">Tema</span>
              <AnimatedThemeToggler
                theme={theme}
                onThemeChange={(nextTheme) => {
                  if (nextTheme !== theme) toggleTheme();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/40 text-yellow-300 hover:bg-slate-900/70"
              />
            </div>
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg bg-slate-900/30 px-3 py-2 text-sm text-slate-100"
                >
                  <ImageWithFallback
                    src={user.picture}
                    alt={user.username}
                    size={28}
                    className="rounded-full"
                  />
                  <span className="truncate">{user.username}</span>
                </Link>
                <Link
                  href="/challenges"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Challenges
                </Link>
                <Link
                  href="/scoreboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Scoreboard
                </Link>
                <Link
                  href="/teams"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Teams
                </Link>
                <Link
                  href="/activity"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Activity
                </Link>
                <Link
                  href="/seasons"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Seasons
                </Link>
                <Link
                  href="/rules"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Rules
                </Link>
                <Link
                  href="/panduan"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Panduan
                </Link>
                {isActuallyContributor && (
                  <Link
                    href="/contributor"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-purple-300 hover:bg-slate-900/40 font-medium"
                  >
                    Kontribusi Soal
                  </Link>
                )}
                {isActuallyAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="mt-2 w-full rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-400"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg bg-slate-900/30 px-3 py-2 text-sm font-semibold text-slate-50"
                >
                  Register
                </Link>
                <Link
                  href="/seasons"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Seasons
                </Link>
                <Link
                  href="/rules"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Rules
                </Link>
                <Link
                  href="/panduan"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Panduan
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
