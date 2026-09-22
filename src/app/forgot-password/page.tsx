"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { sendPasswordReset } from "@/lib/auth";
import TurnstileWidget from "@/components/TurnstileWidget";
import { useReducedMotion } from "@/contexts/ReducedMotionContext";
import ReducedMotionToggle from "@/components/ReducedMotionToggle";

export default function ForgotPasswordPage() {
  const { reducedMotion } = useReducedMotion();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!captchaToken) {
      setError("Silakan selesaikan CAPTCHA terlebih dahulu.");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await sendPasswordReset(email, captchaToken);
      if (resetError) {
        setError(resetError);
      } else {
        setSuccess("Password reset email sent! Please check your inbox.");
      }
    } catch {
      setError("Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-[calc(100vh-64px)] bg-slate-950/95 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-10">
        <div className="absolute right-4 top-4 z-20">
          <ReducedMotionToggle />
        </div>

        <div className="relative w-full max-w-md">
          {!reducedMotion && (
            <div className="pointer-events-none absolute -inset-[2px] rounded-[32px] bg-[conic-gradient(from_0deg,_rgba(59,130,246,0.0)_0deg,_rgba(59,130,246,0.6)_120deg,_rgba(14,165,233,0.0)_240deg,_rgba(59,130,246,0.0)_360deg)] opacity-80 animate-spin-slow blur-[3px]" />
          )}

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
            <h1 className="text-center text-3xl font-extrabold text-white">
              Forgot Password
            </h1>
            <p className="mt-2 text-center text-sm text-slate-300">
              Enter your email to receive a password reset link.
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="Email address"
                className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />

              <TurnstileWidget
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken("")}
                onError={() => setCaptchaToken("")}
              />

              {error && (
                <div className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/30">
                  {success}
                </div>
              )}

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
                  {loading ? "Processing..." : "Send Reset Email"}
                </span>
                <span className="pointer-events-none absolute inset-0 bg-white/0 transition group-hover:bg-white/5" />
              </motion.button>
            </form>

            <div className="mt-5 text-center">
              <Link
                href="/login"
                className="text-sm text-blue-200 hover:text-white"
              >
                Back to Login
              </Link>
            </div>
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
    </main>
  );
}
