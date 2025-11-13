// src/app/page.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-slate-950 overflow-hidden">
      {/* BG sama style dengan login/register */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(37,99,235,0.18),transparent_70%),radial-gradient(circle_at_80%_70%,rgba(14,165,233,0.15),transparent_70%)]" />

      <div className="pointer-events-none absolute -bottom-40 right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-sky-500/18 blur-3xl" />

      {/* Konten + footer dalam flex kolom */}
      <div className="relative z-10 flex min-h-[calc(100vh-64px)] flex-col">
        <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="max-w-4xl mx-auto space-y-6"
          >
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-orange-400 drop-shadow-[0_0_25px_rgba(248,163,88,0.35)]">
              Welcome to POLIJE CTF Platform
              <span className="ml-1 inline-block align-middle">🚩</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-200 max-w-2xl mx-auto">
              Practice your{" "}
              <span className="font-semibold text-sky-300">
                cybersecurity skills
              </span>{" "}
              through Jeopardy-style Capture The Flag (CTF) challenges — solve
              chall, collect flags, and climb the leaderboard.
            </p>

            {/* Flag format pill */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-2 text-xs sm:text-sm text-sky-200 border border-sky-500/30 shadow-[0_0_25px_rgba(56,189,248,0.4)]">
                <span className="text-pink-400">🏴‍☠️ Flag format:</span>
                <code className="font-mono text-[0.78rem] sm:text-xs text-sky-100">
                  POLIJE&#123;your_flag_here&#125;
                </code>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-4 flex items-center justify-center gap-4">
              <Link href="/challenges">
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(56,189,248,0.45)]"
                >
                  Start Challenges
                </motion.button>
              </Link>

              <Link href="/rules">
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl border border-slate-600/70 bg-slate-900/60 px-6 py-2.5 text-sm font-semibold text-slate-100 hover:border-sky-500/70 hover:bg-slate-900/90"
                >
                  Rules
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-white/5 py-5 text-center text-xs sm:text-sm text-slate-400 bg-slate-950/70 backdrop-blur-sm">
          <p className="mb-1">
            Built with{" "}
            <span className="font-semibold text-sky-300">Next.js</span>,{" "}
            <span className="font-semibold text-sky-300">TailwindCSS</span>,{" "}
            <span className="font-semibold text-sky-300">Framer Motion</span>,
            and powered by{" "}
            <span className="font-semibold text-sky-300">Supabase</span> &{" "}
            <span className="font-semibold text-sky-300">Vercel</span>.
          </p>
          <p>
            Source code available on{" "}
            <a
              href="https://github.com/khoirulanam-dev/CTF-Polije"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-sky-400/70 hover:text-sky-200"
            >
              GitHub
            </a>
            . ©2025 POLIJE CTF. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
