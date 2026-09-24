"use client";

import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useMusic,
  MUSIC_PRESETS,
  formatTime,
} from "@/contexts/MusicContext";
import {
  Music,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Link as LinkIcon,
  Upload,
  Radio,
  Sparkles,
} from "lucide-react";

export const MusicConfigDialog: React.FC = () => {
  const {
    dialogOpen,
    closeDialog,
    isPlaying,
    volume,
    isMuted,
    sourceType,
    currentTrack,
    currentTime,
    duration,
    seek,
    togglePlay,
    stop,
    setVolume,
    toggleMute,
    loadUrl,
    loadLocalFile,
    loadPreset,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<"url" | "upload" | "presets">("url");
  const [urlInput, setUrlInput] = useState("");
  const [loadingMedia, setLoadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setLoadingMedia(true);
    const success = await loadUrl(urlInput.trim());
    setLoadingMedia(false);
    if (success) {
      setUrlInput("");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingMedia(true);
    await loadLocalFile(file);
    setLoadingMedia(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
      <DialogContent
        className="w-[95vw] sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-[#181830] dark:bg-gray-900 border border-[#35355e] dark:border-gray-700 p-4 sm:p-6 text-white shadow-2xl [&_button.absolute.right-4.top-4]:text-white [&_button.absolute.right-4.top-4]:z-10 font-sans"
        style={{ boxShadow: "0 10px 40px rgba(0, 0, 0, 0.7)" }}
      >
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-blue-400 dark:text-blue-300">
            <span className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Music className="w-4 h-4" />
            </span>
            Cyber Music Player
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400 mt-1 leading-relaxed">
            Putar musik YouTube, Spotify, radio coding, atau file audio MP3 lokal untuk menemani pengerjaan challenge.
          </DialogDescription>
        </DialogHeader>

        {/* NOW PLAYING CARD */}
        {sourceType === "spotify" && currentTrack?.embedUrl ? (
          /* DEDICATED SPOTIFY PLAYER CARD */
          <div className="mt-2 p-3 sm:p-4 rounded-xl bg-[#121226] border border-[#1DB954]/40 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse" />
                  Spotify Player
                </span>
                <span className="text-[11px] text-gray-400 hidden sm:inline">
                  Kontrol musik langsung dari widget Spotify
                </span>
              </div>
              <button
                type="button"
                onClick={stop}
                className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                title="Tutup Spotify"
              >
                <Square className="w-3 h-3" />
                <span>Tutup</span>
              </button>
            </div>

            <div className="rounded-xl overflow-hidden shadow-inner border border-[#35355e]/60 bg-black/60">
              <iframe
                src={currentTrack.embedUrl}
                width="100%"
                height="152"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="w-full block rounded-xl"
                title="Spotify Embed"
              />
            </div>
          </div>
        ) : sourceType === "apple" && currentTrack?.embedUrl ? (
          /* DEDICATED APPLE MUSIC PLAYER CARD */
          <div className="mt-2 p-3 sm:p-4 rounded-xl bg-[#121226] border border-[#FA2D48]/40 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#FA2D48]/20 text-[#FA2D48] border border-[#FA2D48]/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FA2D48] animate-pulse" />
                  Apple Music
                </span>
                <span className="text-[11px] text-gray-400 hidden sm:inline">
                  Kontrol musik di widget Apple Music
                </span>
              </div>
              <button
                type="button"
                onClick={stop}
                className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                title="Tutup Apple Music"
              >
                <Square className="w-3 h-3" />
                <span>Tutup</span>
              </button>
            </div>

            <div className="rounded-xl overflow-hidden shadow-inner border border-[#35355e]/60 bg-black/60">
              <iframe
                src={currentTrack.embedUrl}
                width="100%"
                height="152"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="w-full block rounded-xl"
                title="Apple Music Embed"
              />
            </div>
          </div>
        ) : (
          /* STANDARD AUDIO / YOUTUBE / LOCAL / STREAM CARD */
          <div className="mt-2 p-3.5 sm:p-4 rounded-xl bg-[#20203f] dark:bg-gray-800/90 border border-[#35355e] dark:border-gray-700 space-y-3">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {sourceType === "youtube"
                      ? "YouTube"
                      : sourceType === "local"
                      ? "File Lokal"
                      : sourceType === "stream"
                      ? "Radio Stream"
                      : "Tidak Aktif"}
                  </span>
                  {isPlaying && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Memutar
                    </span>
                  )}
                </div>
                <h4 className="text-sm sm:text-base font-bold text-white mt-1.5 line-clamp-2 leading-snug break-words">
                  {currentTrack ? currentTrack.title : "Belum ada musik diputar"}
                </h4>
                {currentTrack?.artist && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{currentTrack.artist}</p>
                )}
              </div>

              {/* Play/Pause & Stop Controls */}
              {currentTrack && (
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pt-1 sm:pt-0">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold flex items-center justify-center transition shadow-md shadow-blue-500/25 cursor-pointer active:scale-95"
                    title={isPlaying ? "Jeda" : "Putar"}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={stop}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-700/80 hover:bg-red-500/30 hover:text-red-300 text-gray-300 border border-gray-600/60 flex items-center justify-center transition cursor-pointer active:scale-95"
                    title="Berhenti"
                  >
                    <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Live Progress Bar & Duration Counter */}
            {currentTrack && (
              <div className="space-y-1.5 pt-2 border-t border-[#35355e]/50">
                <div className="relative flex items-center group">
                  <input
                    type="range"
                    min={0}
                    max={duration > 0 ? Math.floor(duration) : 100}
                    value={duration > 0 ? Math.min(Math.floor(currentTime), Math.floor(duration)) : 0}
                    disabled={duration <= 0}
                    onChange={(e) => seek(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-gray-700/80 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    title={duration > 0 ? `Waktu: ${formatTime(currentTime)} / ${formatTime(duration)}` : "Live Stream"}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-mono select-none px-0.5">
                  <div className="flex items-center gap-1.5 text-blue-300 font-semibold">
                    {isPlaying && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    )}
                    <span>{formatTime(currentTime)}</span>
                  </div>

                  {duration > 0 && (
                    <span className="text-gray-400 font-medium">
                      {formatTime(duration)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Volume Control */}
            <div className="flex items-center gap-2.5 sm:gap-3 pt-2 border-t border-[#35355e]/60">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 text-gray-400 hover:text-white transition cursor-pointer shrink-0"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const newVol = parseInt(e.target.value, 10);
                  setVolume(newVol);
                  if (newVol > 0 && isMuted) {
                    toggleMute();
                  }
                }}
                className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                title={`Volume: ${isMuted ? 0 : volume}%`}
              />
              <span className="text-[11px] sm:text-xs font-mono font-semibold text-blue-300 w-11 text-right shrink-0">
                {isMuted ? "0%" : `${volume}%`}
              </span>
            </div>
          </div>
        )}

        {/* RESPONSIVE TABS */}
        <div className="mt-3">
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#121226] rounded-xl border border-[#35355e]">
            <button
              type="button"
              onClick={() => setActiveTab("url")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "url"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">URL Link</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "upload"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">File Lokal</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("presets")}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === "presets"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Preset</span>
            </button>
          </div>
        </div>

        {/* TAB 1: INPUT URL */}
        {activeTab === "url" && (
          <form onSubmit={handleUrlSubmit} className="mt-3 space-y-2">
            <label className="block text-xs font-medium text-gray-300">
              Link YouTube, Spotify, atau Apple Music:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... atau Spotify"
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-[#121226] border border-[#35355e] text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/40"
              />
              <button
                type="submit"
                disabled={loadingMedia || !urlInput.trim()}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white transition disabled:opacity-50 cursor-pointer shrink-0 shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {loadingMedia ? "Memuat..." : "Putar Musik"}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Mendukung link video/live stream YouTube dan lagu/album Spotify.
            </p>
          </form>
        )}

        {/* TAB 2: UPLOAD FILE LOKAL */}
        {activeTab === "upload" && (
          <div className="mt-3 space-y-2 text-center">
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac"
              onChange={handleFileChange}
              className="hidden"
              id="music-file-upload-input"
            />
            <label
              htmlFor="music-file-upload-input"
              className="block p-5 sm:p-6 rounded-2xl border-2 border-dashed border-[#35355e] hover:border-blue-400 bg-[#121226]/80 hover:bg-[#121226] transition cursor-pointer"
            >
              <div className="w-11 h-11 mx-auto rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-white">Klik untuk memilih file audio dari komputer</p>
              <p className="text-[11px] text-gray-400 mt-1">Mendukung MP3, WAV, OGG, M4A, FLAC (Maks 50MB, diputar lokal gratis)</p>
            </label>
          </div>
        )}

        {/* TAB 3: PRESETS (1-KLIK) */}
        {activeTab === "presets" && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-gray-400">Pilih radio coding/hacking bebas royalti untuk fokus belajar:</p>
            <div className="space-y-2 max-h-48 sm:max-h-60 overflow-y-auto pr-1">
              {MUSIC_PRESETS.map((preset) => {
                const isCurrent =
                  (Boolean(currentTrack?.url) && currentTrack?.url === preset.url) ||
                  (Boolean(preset.youtubeId) && currentTrack?.youtubeId === preset.youtubeId);
                return (
                  <div
                    key={preset.id}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition ${
                      isCurrent
                        ? "bg-indigo-950/40 border-indigo-500/60 shadow-sm"
                        : "bg-[#121226] border-[#35355e] hover:border-gray-500"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold shrink-0">
                          {preset.badge}
                        </span>
                        <h5 className="text-xs font-bold text-white truncate">{preset.name}</h5>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">{preset.author}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => loadPreset(preset.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        isCurrent && isPlaying
                          ? "bg-emerald-500 text-slate-950 shadow"
                          : "bg-blue-500/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30"
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                          Aktif
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          Putar
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
