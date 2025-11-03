"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ImageWithFallback from "./ImageWithFallback";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { signOut, isAdmin } from "@/lib/auth";
import { useNotifications } from "@/contexts/NotificationsContext";
import APP from "@/config";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, loading } = useAuth();
  const { unreadCount } = useNotifications();
  const { theme, toggleTheme } = useTheme();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminStatus, setAdminStatus] = useState(false);

  useEffect(() => {
    if (user) {
      isAdmin().then(setAdminStatus);
    } else {
      setAdminStatus(false);
    }
  }, [user]);

  const handleLogout = async () => {
    setMobileMenuOpen(false);
    await signOut();
    setUser(null);
    setAdminStatus(false);
    router.push("/login");
  };

  // helper buat active state
  const isActive = (path: string) => pathname === path;

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
            <div className="leading-tight">
              <p
                className={`text-[1.1rem] font-extrabold tracking-wide ${
                  theme === "dark" ? "text-white" : "text-slate-900"
                } group-hover:text-blue-400 transition`}
              >
                {APP.shortName}
              </p>
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

            {adminStatus && user && (
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

          {/* theme switch */}
          <button
            onClick={toggleTheme}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/40 text-yellow-300 hover:bg-slate-900/70 transition"
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>

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
                  href="/rules"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Rules
                </Link>
                {adminStatus && (
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
                  href="/rules"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/40"
                >
                  Rules
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
