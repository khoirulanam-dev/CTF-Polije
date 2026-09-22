"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { isValidUsername } from "@/lib/utils";
import { validatePassword } from "@/lib/password";
import { useAuth } from "@/contexts/AuthContext";
import { useReducedMotion } from "@/contexts/ReducedMotionContext";
import Loader from "@/components/custom/loading";
import ReducedMotionToggle from "@/components/ReducedMotionToggle";
import TurnstileWidget from "@/components/TurnstileWidget";
import PasswordRequirements from "@/components/PasswordRequirements";

export default function ContributorRegisterPage() {
  const router = useRouter();
  const { setUser, user, loading: authLoading } = useAuth();
  const { reducedMotion } = useReducedMotion();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");

  useEffect(() => {
    if (!authLoading && user) router.replace("/contributor");
  }, [authLoading, router, user]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const passwordIsValid = !validatePassword(form.password);
  const confirmationIsValid = !validatePassword(form.confirmPassword);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const usernameError = isValidUsername(form.username);
    if (usernameError) return setError(usernameError);
    if (form.password !== form.confirmPassword)
      return setError("Password tidak sama.");

    const passwordError = validatePassword(form.password);
    if (passwordError) return setError(passwordError);
    if (!captchaToken)
      return setError("Silakan selesaikan CAPTCHA terlebih dahulu.");

    setSubmitting(true);
    try {
      const response = await fetch("/api/register/contributor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
          turnstile_token: captchaToken,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message || "Registrasi contributor gagal.");

      const result = await signIn(form.email.trim(), form.password);
      if (result.error || !result.user) {
        router.push("/login");
        return;
      }

      setUser(result.user);
      router.push("/contributor");
    } catch (submissionError: any) {
      setError(submissionError?.message || "Registrasi contributor gagal.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return <Loader fullscreen color="text-orange-500" />;

  return (
    <main className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden bg-slate-950/95 px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_55%)]" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute right-4 top-4 z-20">
        <ReducedMotionToggle />
      </div>
      <div className="relative w-full max-w-md">
        {!reducedMotion && (
          <div className="pointer-events-none absolute -inset-[2px] rounded-[32px] bg-[conic-gradient(from_0deg,_rgba(59,130,246,0.0)_0deg,_rgba(59,130,246,0.6)_120deg,_rgba(14,165,233,0.0)_240deg,_rgba(59,130,246,0.0)_360deg)] opacity-80 animate-spin-slow blur-[3px]" />
        )}

        <section className="relative rounded-[30px] border border-white/5 bg-slate-900/70 p-8 shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
              Contributor
            </p>
            <h1 className="mt-2 text-3xl font-extrabold">Daftar Contributor</h1>
            <p className="mt-2 text-sm text-slate-300">
              Buat akun contributor untuk kontribusi membuat soal CTF.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              required
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
              placeholder="Username"
              autoComplete="username"
              className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
            />
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
            />
            <input
              required
              type="password"
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              placeholder="Password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
            />

            {!passwordIsValid && (
              <PasswordRequirements password={form.password} />
            )}

            <input
              required
              type="password"
              value={form.confirmPassword}
              onChange={(event) =>
                updateField("confirmPassword", event.target.value)
              }
              placeholder="Konfirmasi password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3 text-sm outline-none focus:border-blue-400/80 focus:ring-2 focus:ring-blue-400/40"
            />

            {form.confirmPassword && (
              <p
                aria-live="polite"
                className={
                  form.password === form.confirmPassword
                    ? "text-xs text-emerald-300"
                    : "text-xs text-red-300"
                }
              >
                {form.password === form.confirmPassword
                  ? "✓ Password cocok"
                  : "✕ Password belum sama"}
              </p>
            )}

            {passwordIsValid && !confirmationIsValid && (
              <PasswordRequirements password={form.confirmPassword} />
            )}

            <TurnstileWidget
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken("")}
              onError={() => setCaptchaToken("")}
            />

            {error && (
              <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-sky-400 py-3 text-sm font-bold shadow-[0_10px_25px_rgba(56,189,248,0.3)] transition hover:from-blue-400 hover:to-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Mendaftarkan..." : "Daftar sebagai Contributor"}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-2 text-sm text-slate-400">
            <Link href="/login" className="text-blue-200 hover:text-white">
              Sudah punya akun? Login
            </Link>
            <Link href="/register" className="hover:text-white">
              Daftar akun peserta biasa
            </Link>
          </div>
        </section>

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
    </main>
  );
}
