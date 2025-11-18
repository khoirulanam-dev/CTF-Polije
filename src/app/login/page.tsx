"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import Loader from "@/components/custom/loading";
import GoogleLoginButton from "@/components/GoogleLoginButton";
import { useReducedMotion } from "@/contexts/ReducedMotionContext";
import ReducedMotionToggle from "@/components/ReducedMotionToggle";

export default function LoginPage() {
  const router = useRouter();
  const { setUser, user, loading: authLoading } = useAuth();
  const { reducedMotion } = useReducedMotion();

  const [formData, setFormData] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && user) {
      router.push("/challenges");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { user, error } = await signIn(
        formData.identifier,
        formData.password
      );
      if (error) {
        setError(error);
      } else if (user) {
        setUser(user);
        router.push("/challenges");
      }
    } catch {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (authLoading) {
    return <Loader fullscreen color="text-orange-500" />;
  }

  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-slate-950/95">
      {/* background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-10">
        {/* toggle reduced motion */}
        <div className="absolute top-4 right-4 z-20">
          <ReducedMotionToggle />
        </div>

        {/* === WRAPPER DENGAN CAHAYA MUTER === */}
        <div className="relative w-full max-w-md">
          {/* cincin muter (dimatikan kalau reducedMotion) */}
          {!reducedMotion && (
            <div className="pointer-events-none absolute -inset-[2px] rounded-[32px] bg-[conic-gradient(from_0deg,_rgba(59,130,246,0.0)_0deg,_rgba(59,130,246,0.6)_120deg,_rgba(14,165,233,0.0)_240deg,_rgba(59,130,246,0.0)_360deg)] opacity-80 animate-spin-slow blur-[3px]" />
          )}

          {/* card asli */}
          <motion.div
            {...(!reducedMotion
              ? {
                  initial: { opacity: 0, y: 22 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.45, ease: "easeOut" },
                }
              : {})}
            className="relative rounded-[30px] border border-white/5 bg-slate-900/70 p-8 shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur-md"
          >
            <h2 className="text-center text-3xl font-extrabold text-white">
              Sign in to CTFS
            </h2>
            <p className="mt-2 text-center text-sm text-slate-300">
              Or{" "}
              <Link
                href="/register"
                className="font-medium text-blue-200 hover:text-white"
              >
                create a new account
              </Link>
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    required
                    placeholder="Username or Email"
                    className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-10 py-2.5 text-sm text-white outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
                    value={formData.identifier}
                    onChange={handleChange}
                  />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">
                    {/* user icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M10 10a4 4 0 100-8 4 4 0 000 8z" />
                      <path
                        fillRule="evenodd"
                        d="M.458 16.042A10 10 0 0110 10c4.478 0 8.268 2.943 9.542 7.042A1 1 0 0118.59 19H1.41a1 1 0 01-.952-1.258z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="Password"
                    className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-10 py-2.5 text-sm text-white outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">
                    {/* lock icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 8V6a5 5 0 1110 0v2h1a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1h1zm2-2a3 3 0 016 0v2H7V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30">
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs text-slate-300 hover:text-white"
                >
                  Forgot password?
                </Link>
              </div>

              <motion.button
                {...(!reducedMotion
                  ? {
                      whileHover: { scale: 1.01 },
                      whileTap: { scale: 0.997 },
                    }
                  : {})}
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-sky-400 py-2.5 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(56,189,248,0.3)] transition disabled:opacity-60"
              >
                <span className="relative z-10">
                  {loading ? "Processing..." : "Sign In"}
                </span>
                <span className="pointer-events-none absolute inset-0 bg-white/0 transition group-hover:bg-white/5" />
              </motion.button>

              <GoogleLoginButton />
            </form>
          </motion.div>

          {/* animasi css khusus di sini */}
          <style jsx>{`
            @keyframes spin-slow {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }
            .animate-spin-slow {
              animation: spin-slow 7s linear infinite;
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
