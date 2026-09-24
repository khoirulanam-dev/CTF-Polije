"use client";

import React, { useEffect, useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useMusic, formatTime } from "@/contexts/MusicContext";
import { Music, Disc3 } from "lucide-react";

export const FloatingMusicButton: React.FC = () => {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const {
    isPlaying,
    sourceType,
    currentTrack,
    currentTime,
    duration,
    openDialog,
    togglePlay,
  } = useMusic();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Penyesuaian posisi agar stabil, konsisten di seluruh halaman, dan tidak memicu layout thrashing saat pindah rute
  const positionClass = pathname?.startsWith("/admin")
    ? "top-20 left-3 sm:left-4 2xl:left-[max(1rem,calc(50vw-43.75rem))]"
    : "top-20 left-3 sm:left-4 xl:left-[max(1.25rem,calc(50vw-39.75rem))]";

  // Hanya tampilkan jika komponen sudah ter-mount di client dan user sudah login
  if (!mounted || loading || !user) return null;

  return (
    <div
      className={`fixed ${positionClass} z-40 flex items-center gap-1.5 group select-none`}
    >
      {/* Tombol Utama Floating Music Icon (Tema Cyber Ungu/Biru) */}
      <button
        type="button"
        onClick={openDialog}
        className={`relative flex items-center justify-center w-11 h-11 rounded-2xl border transition-all duration-300 shadow-lg cursor-pointer backdrop-blur-md ${
          isPlaying
            ? "bg-slate-900/90 dark:bg-slate-900/90 border-blue-500/60 text-blue-400 shadow-blue-500/25 shadow-md scale-105"
            : "bg-white/85 dark:bg-slate-900/85 border-slate-300 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:border-blue-500/50 hover:text-blue-400 hover:scale-105"
        }`}
        title={
          isPlaying
            ? `Musik Aktif: ${currentTrack?.title || "Playing"} (Klik untuk konfigurasi)`
            : "Buka Pemutar Musik CTF"
        }
        aria-label="Floating Music Player"
      >
        {isPlaying ? (
          <div className="flex items-center justify-center">
            {/* Animasi Disc berputar halus saat musik aktif */}
            <Disc3 className="w-5 h-5 animate-spin" style={{ animationDuration: "3s" }} />

            {/* Mini Equalizer Bar Animation di pojok tombol */}
            <span className="absolute -bottom-1 -right-1 flex items-end gap-0.5 h-3 px-1 py-0.5 bg-slate-950 rounded-full border border-blue-500/40">
              <span className="w-0.5 h-2 bg-blue-400 animate-pulse" />
              <span
                className="w-0.5 h-2.5 bg-cyan-400 animate-pulse"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-0.5 h-1.5 bg-emerald-400 animate-pulse"
                style={{ animationDelay: "300ms" }}
              />
            </span>
          </div>
        ) : (
          <Music className="w-5 h-5 transition-transform group-hover:rotate-12" />
        )}
      </button>

      {/* Mini Quick-Play/Pause toggle dan live timer yang muncul saat hover jika ada lagu */}
      {currentTrack && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5">
          {sourceType !== "spotify" && sourceType !== "apple" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-8 h-8 rounded-xl bg-slate-900/90 dark:bg-slate-900/90 border border-slate-700/80 text-xs text-white flex items-center justify-center shadow hover:border-blue-500/50 hover:text-blue-400 active:scale-95 cursor-pointer"
              title={isPlaying ? "Jeda (Pause)" : "Lanjutkan Putar"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
          )}

          {/* Mini live time / platform pill */}
          <div
            onClick={openDialog}
            className="px-2.5 py-1 rounded-xl bg-slate-900/90 dark:bg-slate-900/90 border border-slate-700/80 text-[10px] font-mono font-semibold shadow cursor-pointer hover:border-blue-500/50 flex items-center gap-1.5 transition"
            title="Klik untuk membuka pemutar musik"
          >
            {sourceType === "spotify" ? (
              <span className="text-[#1DB954] font-sans font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse" />
                Spotify
              </span>
            ) : sourceType === "apple" ? (
              <span className="text-[#FA2D48] font-sans font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FA2D48] animate-pulse" />
                Apple Music
              </span>
            ) : (
              <>
                {isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                <span className="text-blue-300">{formatTime(currentTime)}</span>
                {duration > 0 && (
                  <span className="text-gray-400 font-normal">/ {formatTime(duration)}</span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
