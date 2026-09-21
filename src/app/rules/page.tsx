"use client";

import TitlePage from "@/components/custom/TitlePage";
import Footer from "@/components/custom/Footer";
import { motion } from "framer-motion";
import APP from "@/config";
import { RulesMarkdownRenderer } from "@/components/MarkdownRenderer";
import Link from "next/link";

const RULES = [
  {
    title: "Fokus ke Challenge",
    description:
      "Mainkan challenge untuk mencari flag. Fokus pada permainan — jangan ganggu atau eksploitasi layanan lain.",
  },
  {
    title: "Kolaborasi & Bantuan",
    description:
      "Boleh kerja sama, pakai AI, atau tanya admin/author. Tapi **jangan pernah** membagikan flag ke publik.",
  },
  {
    title: "Point",
    description:
      "Poin tergantung tingkat kesulitan. Sistem dynamic (turun tiap solve) dan static (tetap). Baby: 200–50–5, Easy: 300–100–10, Medium: 500–300–20, Hard: 750–500–50, Impossible: 1000–3000 (tetap).",
  },
  {
    title: "Writeup",
    description:
      "Boleh dipublikasikan **30 hari setelah rilis** dan jika sudah disolve **≥10 orang**. Semua flag wajib **{REDACTED}**.",
  },
  {
    title: "Akun",
    description:
      "Gunakan satu akun per peserta. Dilarang membuat akun ganda untuk keuntungan apa pun.",
  },
  {
    title: "Etika & Privasi",
    description:
      "Hormati peserta lain. Dilarang mengambil atau menyebarkan data pribadi.",
  },
  {
    title: "Larangan Serangan",
    description:
      "Jangan serang host, platform, atau lakukan bruteforce pada layanan apa pun.",
  },
  {
    title: "Pelaporan Bug",
    description: "Laporkan bug atau celah keamanan ke admin secepatnya.",
  },
];

export default function RulesPage() {
  return (
    <div className="flex flex-col min-h-[calc(100lvh-60px)] bg-slate-950 relative overflow-hidden">
      {/* Background halus berbasis CSS (GPU-accelerated, zero JS main-thread load) */}
      <div
        aria-hidden
        className="fixed inset-0 -z-30 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.12)_0%,_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(79,70,229,0.12)_0%,_transparent_60%)]"
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-20 pointer-events-none opacity-15 bg-[repeating-linear-gradient(180deg,_rgba(148,163,184,0.12)_0px,_rgba(148,163,184,0.12)_2px,_transparent_2px,_transparent_6px)]"
      />

      <section className="flex flex-col items-center justify-start pt-8 md:pt-12 flex-1 text-center px-4 relative z-10">
        <TitlePage className="mb-2">
          🚩 Platform Rules
        </TitlePage>

        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="text-sm md:text-base text-slate-300 max-w-2xl md:max-w-3xl mb-8"
        >
          Mohon baca dan patuhi aturan berikut sebelum mengikuti challenge di{" "}
          <span className="text-sky-400 font-semibold">{APP.fullName}</span>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="mb-8 flex flex-col items-center justify-center gap-3 w-full"
        >
          <div className="w-full max-w-3xl space-y-3 text-left">
            {RULES.map((rule, idx) => (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.008, y: -1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="group flex gap-3.5 items-start bg-slate-900/60 border border-slate-800/80 rounded-xl
                          px-4 py-3.5 shadow-sm text-sm md:text-base
                          hover:shadow-lg hover:border-sky-500/50 hover:bg-slate-900/90
                          backdrop-blur-sm transition-all duration-200 ease-out"
              >
                <div className="flex-shrink-0 mt-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-orange-400
                                group-hover:scale-125 transition-transform duration-200"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-orange-400 group-hover:text-orange-300 transition-colors">
                    {rule.title}
                  </div>
                  <div className="text-slate-300 text-xs md:text-sm leading-relaxed mt-1">
                    <RulesMarkdownRenderer content={rule.description} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <p className="text-slate-950 select-none text-[10px] pointer-events-none">
          UE9MSUpFe1lvdV9IYXZlX0FjY2VwdGVkX0FsbF9SdWxlc19BbmRfRXRoaWNzfQ==
        </p>

        <div className="w-full max-w-3xl mt-4 mb-8 flex justify-center">
          <Link
            href="/challenges"
            className="rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 px-6 py-2.5 text-white font-bold text-sm shadow-[0_4px_25px_rgba(6,182,212,0.4)] hover:shadow-[0_4px_30px_rgba(6,182,212,0.6)] border border-cyan-200/30 hover:scale-105 active:scale-95 transition-all"
          >
            Start Challenges 🚩
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
