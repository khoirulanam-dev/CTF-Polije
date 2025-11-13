// src/app/register/page.tsx
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth";
import { isValidUsername } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import Loader from "@/components/custom/loading";
import GoogleLoginButton from "@/components/GoogleLoginButton";

const EXPECTED_TOKEN = "Hacker_Polije_2025"; // hanya untuk UX, tetap ada cek di server

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, user, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    teamToken: "",
  });
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

    const usernameError = isValidUsername(formData.username);
    if (usernameError) {
      setError(usernameError);
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    // 🔑 simple client-side check (biar user ga salah ketik)
    if (formData.teamToken.trim() !== EXPECTED_TOKEN) {
      setError("Invalid team token");
      setLoading(false);
      return;
    }

    try {
      const { user, error } = await signUp(
        formData.email,
        formData.password,
        formData.username,
        formData.teamToken.trim()
      );

      if (error) {
        setError(error);
      } else if (user) {
        setUser(user);
        router.push("/challenges");
      }
    } catch {
      setError("Registration failed");
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
      {/* background halus */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />

      <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-10">
        <div className="relative w-full max-w-md">
          {/* CAHAYA MUTER */}
          <div className="pointer-events-none absolute -inset-[2px] rounded-[32px] bg-[conic-gradient(from_0deg,_rgba(56,189,248,0.0)_0deg,_rgba(56,189,248,0.6)_120deg,_rgba(37,99,235,0.0)_240deg,_rgba(56,189,248,0.0)_360deg)] opacity-80 animate-spin-slow blur-[3px]" />

          {/* CARD UTAMA */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative rounded-[30px] border border-white/5 bg-slate-900/70 p-8 shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur-md"
          >
            <h2 className="text-center text-3xl font-extrabold text-white">
              Register for CTFS
            </h2>
            <p className="mt-2 text-center text-sm text-slate-300">
              Or{" "}
              <Link
                href="/login"
                className="font-medium text-blue-200 hover:text-white"
              >
                sign in with an existing account
              </Link>
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-3">
                {/* username */}
                <div className="relative">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    placeholder="Username"
                    className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-10 py-2.5 text-sm text-white outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
                    value={formData.username}
                    onChange={handleChange}
                  />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">
                    {/* icon user */}
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

                {/* email */}
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Email address"
                    className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-10 py-2.5 text-sm text-white outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
                    value={formData.email}
                    onChange={handleChange}
                  />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">
                    {/* icon mail */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M4.5 6.75A2.25 2.25 0 016.75 4.5h10.5A2.25 2.25 0 0119.5 6.75v10.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25V6.75zm2.33-.75a.75.75 0 00-.494 1.316l5.25 4.725a.75.75 0 00.988 0l5.25-4.725A.75.75 0 0016.92 6H6.83z" />
                    </svg>
                  </span>
                </div>

                {/* password */}
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Password"
                    className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-10 py-2.5 text-sm text-white outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
                    value={formData.password}
                    onChange={handleChange}
                  />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">
                    {/* icon lock */}
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

                {/* confirm password */}
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Confirm Password"
                    className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-10 py-2.5 text-sm text-white outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">
                    {/* icon check */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 1.5a5.25 5.25 0 00-5.25 5.25V9A2.25 2.25 0 004.5 11.25v6A2.25 2.25 0 006.75 19.5h10.5A2.25 2.25 0 0019.5 17.25v-6A2.25 2.25 0 0017.25 9V6.75A5.25 5.25 0 0012 1.5zM9 9V6.75a3 3 0 116 0V9H9z" />
                    </svg>
                  </span>
                </div>

                {/* 🔑 Team Token */}
                <div className="relative">
                  <input
                    id="teamToken"
                    name="teamToken"
                    type="text"
                    required
                    placeholder="Team token"
                    className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-10 py-2.5 text-sm text-white outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
                    value={formData.teamToken}
                    onChange={handleChange}
                  />
                  <span className="pointer-events-none absolute left-3 top-2.5 text-slate-500">
                    {/* icon key */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M18 8a6 6 0 11-11.473 2.09L2 14.586V18h3.414l1.879-1.879A6 6 0 0118 8z" />
                    </svg>
                  </span>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30">
                  {error}
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.997 }}
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-sky-400 py-2.5 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(56,189,248,0.3)] transition disabled:opacity-60"
              >
                <span className="relative z-10">
                  {loading ? "Processing..." : "Register"}
                </span>
                <span className="pointer-events-none absolute inset-0 bg-white/0 transition group-hover:bg-white/5" />
              </motion.button>

              <GoogleLoginButton />
            </form>
          </motion.div>

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
