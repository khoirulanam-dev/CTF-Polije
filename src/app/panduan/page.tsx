"use client";

import TitlePage from "@/components/custom/TitlePage";
import Footer from "@/components/custom/Footer";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

export default function PanduanPage() {
  const [copied, setCopied] = useState(false);

  const copyFlagFormat = () => {
    navigator.clipboard.writeText("POLIJE{...}");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-[calc(100lvh-60px)] bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Background radial subtle glow */}
      <div
        aria-hidden
        className="fixed inset-0 -z-30 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.12)_0%,_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(79,70,229,0.12)_0%,_transparent_60%)]"
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-20 pointer-events-none opacity-15 bg-[repeating-linear-gradient(180deg,_rgba(148,163,184,0.12)_0px,_rgba(148,163,184,0.12)_2px,_transparent_2px,_transparent_6px)]"
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center space-y-4 mb-10">
          <TitlePage>📖 Panduan Bermain CTF</TitlePage>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
            Panduan lengkap pemula dan peserta platform ctfpolije.dev. Pelajari konsep dasar Capture The Flag, aturan main, strategi, hingga toolset penting.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="/panduan-ctf-polije.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Buka / Unduh PDF Panduan
            </a>

            <Link
              href="/challenges"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 px-4 py-2.5 text-sm font-medium text-slate-200 transition"
            >
              🚩 Menuju Challenges
            </Link>
          </div>
        </div>

        {/* Quick Reference Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm"
          >
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="font-semibold text-slate-100 mb-1">Tujuan Utama</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Analisis sistem, pecahkan teka-teki, dan temukan string rahasia bernama FLAG untuk memperoleh poin di scoreboard.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm"
          >
            <div className="text-2xl mb-2">🔑</div>
            <h3 className="font-semibold text-slate-100 mb-1">Format Flag</h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-2">
              Format flag standar platform POLIJE CTF:
            </p>
            <div
              onClick={copyFlagFormat}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-xs text-blue-400 cursor-pointer hover:bg-slate-700/80 transition"
              title="Klik untuk salin"
            >
              <span>POLIJE&#123;...&#125;</span>
              <span className="text-[10px] text-slate-400">{copied ? "Tersalin!" : "Salin"}</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm"
          >
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="font-semibold text-slate-100 mb-1">Dynamic Scoring</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Poin soal berkurang seiring semakin banyaknya peserta yang berhasil menyelesaikan soal tersebut. Dapatkan First Blood untuk reputasi ekstra!
            </p>
          </motion.div>
        </div>

        {/* Embedded PDF Viewer Section */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md overflow-hidden shadow-2xl">
          <div className="px-5 py-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs sm:text-sm font-semibold text-slate-200">
                Dokumen Resmi Panduan CTF Polije
              </span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/panduan-ctf-polije.pdf"
                download="Panduan-CTF-Polije.pdf"
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium border border-slate-700 transition"
              >
                Unduh PDF
              </a>
              <a
                href="/panduan-ctf-polije.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white font-medium transition"
              >
                Buka Tab Baru ↗
              </a>
            </div>
          </div>

          <div className="relative w-full h-[750px] bg-slate-950">
            <iframe
              src="/panduan-ctf-polije.pdf#toolbar=1"
              className="w-full h-full border-0"
              title="Buku Panduan CTF Polije"
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
