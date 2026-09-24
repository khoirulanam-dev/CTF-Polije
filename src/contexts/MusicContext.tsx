"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { parseMediaUrl, validateLocalAudioFile } from "@/lib/music-security";
import toast from "react-hot-toast";

export interface PresetTrack {
  id: string;
  name: string;
  author: string;
  type: 'stream' | 'youtube';
  url?: string;
  youtubeId?: string;
  badge: string;
  duration?: number;
  isLive?: boolean;
}

export const MUSIC_PRESETS: PresetTrack[] = [
  {
    id: "dj-tiktok-motong",
    name: "DJ TIKTOK TERBARU 2026 🎵 DJ AKU ANAK KAMPUNG",
    author: "DJ AMOYCAN RMX",
    type: "youtube",
    youtubeId: "ZsijEIkhAcc",
    url: "https://www.youtube.com/watch?v=ZsijEIkhAcc",
    badge: "DJ TikTok",
    duration: 6074,
    isLive: false,
  },
  {
    id: "silvy-kumalasari-jawa",
    name: "FULL ALBUM SILVY KUMALASARI 2026 - LAGU JAWA",
    author: "MW MUSIC CHANNEL",
    type: "youtube",
    youtubeId: "28c3NX8-uuA",
    url: "https://www.youtube.com/watch?v=28c3NX8-uuA",
    badge: "Lagu Jawa",
    duration: 8902,
    isLive: false,
  },
  {
    id: "santai-viral-tiktok",
    name: "Lagu Santai Viral Tiktok 2026 — Top Indo Song",
    author: "Jogjis Band",
    type: "youtube",
    youtubeId: "vb_-EffUOcI",
    url: "https://www.youtube.com/watch?v=vb_-EffUOcI",
    badge: "Pop Indo",
    duration: 5957,
    isLive: false,
  },
  {
    id: "code-fi",
    name: "Code-fi / Beats to Code & Relax",
    author: "The AMP Channel (1 Jam)",
    type: "youtube",
    youtubeId: "f02mOEt11OQ",
    url: "https://www.youtube.com/watch?v=f02mOEt11OQ",
    badge: "Focus 1 Jam",
    duration: 3619,
    isLive: false,
  },
  {
    id: "alpha-waves",
    name: "Alpha Waves Focus Concentration",
    author: "Yellow Brick Cinema (3 Jam)",
    type: "youtube",
    youtubeId: "WPni755-Krg",
    url: "https://www.youtube.com/watch?v=WPni755-Krg",
    badge: "Focus 3 Jam",
    duration: 10797,
    isLive: false,
  },
  {
    id: "synthwave",
    name: "Synthwave / Cyberpunk Radio",
    author: "Lofi Girl (Synthwave Beats)",
    type: "youtube",
    youtubeId: "4xDzrJKXOOY",
    url: "https://www.youtube.com/watch?v=4xDzrJKXOOY",
    badge: "Live Radio",
    isLive: true,
  },
  {
    id: "lofi",
    name: "Lofi Coding & Study Beats",
    author: "Lofi Girl Radio",
    type: "youtube",
    youtubeId: "jfKfPfyJRdk",
    url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    badge: "Live Radio",
    isLive: true,
  },
  {
    id: "ambient",
    name: "Dark Ambient Cyber Space",
    author: "Cryo Chamber Radio",
    type: "youtube",
    youtubeId: "S_MOd40tx54",
    url: "https://www.youtube.com/watch?v=S_MOd40tx54",
    badge: "Live Radio",
    isLive: true,
  },
  {
    id: "chillhop",
    name: "Chillhop Cafe Beats",
    author: "Chillhop Music Radio",
    type: "youtube",
    youtubeId: "5yx6BWlEVcY",
    url: "https://www.youtube.com/watch?v=5yx6BWlEVcY",
    badge: "Live Radio",
    isLive: true,
  },
];

export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "00:00";
  const totalSecs = Math.floor(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) {
    return `${hrs}:${remMins < 10 ? "0" : ""}${remMins}:${secs < 10 ? "0" : ""}${secs}`;
  }
  return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

interface MusicContextType {
  isPlaying: boolean;
  volume: number; // 0 - 100
  isMuted: boolean;
  sourceType: "none" | "local" | "stream" | "youtube" | "spotify" | "apple";
  currentTrack: {
    title: string;
    artist?: string;
    url?: string;
    embedUrl?: string;
    youtubeId?: string;
  } | null;
  currentTime: number;
  duration: number;
  seek: (seconds: number) => void;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  dialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  loadUrl: (inputUrl: string) => Promise<boolean>;
  loadLocalFile: (file: File) => Promise<boolean>;
  loadPreset: (presetId: string) => void;
  setPlayerPlaying: (playing: boolean) => void;
  youTubePlayerRef: React.MutableRefObject<any>;
}

const MusicContext = createContext<MusicContextType | null>(null);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // 1. Baca sesi musik terakhir dari localStorage (jika ada sebelum refresh F5)
  const savedStateRef = useRef<{
    sourceType?: "none" | "local" | "stream" | "youtube" | "spotify" | "apple";
    currentTrack?: {
      title: string;
      artist?: string;
      url?: string;
      embedUrl?: string;
      youtubeId?: string;
    } | null;
    currentTime?: number;
    duration?: number;
    wasPlaying?: boolean;
  } | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(70);
  const [isMuted, setIsMuted] = useState(false);
  const [sourceType, setSourceType] = useState<
    "none" | "local" | "stream" | "youtube" | "spotify" | "apple"
  >("none");
  const [currentTrack, setCurrentTrack] = useState<{
    title: string;
    artist?: string;
    url?: string;
    embedUrl?: string;
    youtubeId?: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Pulihkan sesi musik dari localStorage setelah komponen ter-mount di client (mencegah error hydration)
  const isHydratedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedVol = localStorage.getItem("polije_music_volume");
      if (savedVol) {
        const v = parseInt(savedVol, 10);
        if (!isNaN(v) && v >= 0 && v <= 100) setVolumeState(v);
      }

      const raw = localStorage.getItem("polije_music_state");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.sourceType && saved.sourceType !== "local") {
          savedStateRef.current = saved;
          setSourceType(saved.sourceType);
          setCurrentTrack(saved.currentTrack);
          if (typeof saved.currentTime === "number" && saved.currentTime > 0) {
            setCurrentTime(saved.currentTime);
          }
          if (typeof saved.duration === "number" && saved.duration > 0) {
            setDuration(saved.duration);
          }
          if (saved.wasPlaying) {
            setIsPlaying(true);
          }
        }
      }
    } catch {}
    isHydratedRef.current = true;
  }, []);

  // Audio HTML5 ref for local files & direct streams
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const youTubePlayerRef = useRef<any>(null);

  const setPlayerPlaying = useCallback((p: boolean) => {
    setIsPlaying(p);
  }, []);

  // Smooth live timer ticker when playing (real-time live progress counter)
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentTime((prev) => {
        if (duration > 0) {
          return prev < duration ? prev + 1 : prev;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying, duration]);

  // Ref status realtime untuk listener beforeunload tanpa re-attach listener tiap detik
  const latestStateRef = useRef({
    sourceType,
    currentTrack,
    currentTime,
    duration,
    isPlaying,
  });

  useEffect(() => {
    latestStateRef.current = {
      sourceType,
      currentTrack,
      currentTime,
      duration,
      isPlaying,
    };
  }, [sourceType, currentTrack, currentTime, duration, isPlaying]);

  // Simpan state sesi pemutar musik ke localStorage saat lagu/sourceType/duration/isPlaying berganti
  useEffect(() => {
    if (typeof window === "undefined" || !isHydratedRef.current) return;

    if (!currentTrack || sourceType === "none" || sourceType === "local") {
      localStorage.removeItem("polije_music_state");
      return;
    }

    const stateToSave = {
      sourceType,
      currentTrack,
      currentTime: Math.floor(latestStateRef.current.currentTime),
      duration: Math.floor(duration),
      wasPlaying: isPlaying,
    };

    localStorage.setItem("polije_music_state", JSON.stringify(stateToSave));
  }, [currentTrack, sourceType, duration, isPlaying]);

  // Pasang listener beforeunload SEKALI SAJA di mount agar tidak ada overhead add/remove tiap detik
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeUnload = () => {
      const s = latestStateRef.current;
      if (s.currentTrack && s.sourceType !== "none" && s.sourceType !== "local") {
        const stateToSave = {
          sourceType: s.sourceType,
          currentTrack: s.currentTrack,
          currentTime: Math.floor(s.currentTime),
          duration: Math.floor(s.duration),
          wasPlaying: s.isPlaying,
        };
        localStorage.setItem("polije_music_state", JSON.stringify(stateToSave));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Seek position
  const seek = useCallback(
    (seconds: number) => {
      const safeTime = Math.max(0, seconds);
      setCurrentTime(safeTime);
      if (sourceType === "local" || sourceType === "stream") {
        if (audioRef.current) {
          audioRef.current.currentTime = safeTime;
        }
      } else if (sourceType === "youtube") {
        if (
          youTubePlayerRef.current &&
          typeof youTubePlayerRef.current.seekTo === "function"
        ) {
          youTubePlayerRef.current.seekTo(safeTime);
        }
      }
    },
    [sourceType]
  );

  // Inisialisasi Audio Element sekali saja & pasang event listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = isMuted ? 0 : volume / 100;

    const handleTimeUpdate = () => {
      if (typeof audio.currentTime === "number" && isFinite(audio.currentTime)) {
        setCurrentTime(Math.floor(audio.currentTime));
      }
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(Math.floor(audio.duration));
      }
    };

    const handleMetadata = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(Math.floor(audio.duration));
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleMetadata);
    audio.addEventListener("durationchange", handleMetadata);

    audio.onended = () => {
      setIsPlaying(false);
    };

    audio.onerror = () => {
      if (
        audio.hasAttribute("src") &&
        audio.src &&
        audio.src !== "about:blank" &&
        audio.src !== window.location.href &&
        !audio.src.endsWith(window.location.pathname)
      ) {
        console.warn("Audio element error:", audio.src);
        setIsPlaying(false);
      }
    };

    audioRef.current = audio;

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleMetadata);
      audio.removeEventListener("durationchange", handleMetadata);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
    };
  }, []);

  // Update volume audio HTML5 dan YouTube player
  const setVolume = useCallback(
    (vol: number) => {
      const safeVol = Math.max(0, Math.min(100, Math.round(vol)));
      setVolumeState(safeVol);
      if (safeVol > 0 && isMuted) {
        setIsMuted(false);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("polije_music_volume", safeVol.toString());
      }

      if (audioRef.current) {
        audioRef.current.volume = isMuted ? 0 : safeVol / 100;
      }

      if (
        youTubePlayerRef.current &&
        typeof youTubePlayerRef.current.setVolume === "function"
      ) {
        try {
          youTubePlayerRef.current.setVolume(isMuted ? 0 : safeVol);
        } catch {}
      }
    },
    [isMuted]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      if (audioRef.current) {
        audioRef.current.volume = nextMuted ? 0 : volume / 100;
      }
      if (youTubePlayerRef.current) {
        try {
          if (nextMuted) {
            youTubePlayerRef.current.mute?.();
          } else {
            youTubePlayerRef.current.unMute?.();
            youTubePlayerRef.current.setVolume?.(volume === 0 ? 75 : volume);
          }
        } catch {}
      }
      return nextMuted;
    });
  }, [volume]);

  const play = useCallback(() => {
    if (volume === 0) {
      setVolume(75);
    }
    if (isMuted) {
      setIsMuted(false);
    }

    if (sourceType === "local" || sourceType === "stream") {
      if (
        audioRef.current &&
        audioRef.current.hasAttribute("src") &&
        audioRef.current.src &&
        audioRef.current.src !== "about:blank" &&
        audioRef.current.src !== window.location.href &&
        !audioRef.current.src.endsWith(window.location.pathname)
      ) {
        audioRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn("Audio play prevented:", err);
            setIsPlaying(false);
          });
      } else {
        setIsPlaying(false);
      }
    } else if (sourceType === "youtube") {
      if (
        youTubePlayerRef.current &&
        typeof youTubePlayerRef.current.playVideo === "function"
      ) {
        try {
          youTubePlayerRef.current.playVideo();
          setIsPlaying(true);
        } catch {}
      } else {
        setIsPlaying(true);
      }
    } else if (sourceType === "spotify" || sourceType === "apple") {
      setIsPlaying(true);
    }
  }, [sourceType, volume, isMuted, setVolume]);

  const pause = useCallback(() => {
    if (sourceType === "local" || sourceType === "stream") {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    } else if (sourceType === "youtube") {
      if (
        youTubePlayerRef.current &&
        typeof youTubePlayerRef.current.pauseVideo === "function"
      ) {
        try {
          youTubePlayerRef.current.pauseVideo();
          setIsPlaying(false);
        } catch {}
      }
    } else if (sourceType === "spotify" || sourceType === "apple") {
      setIsPlaying(false);
    }
  }, [sourceType]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Auto-resume pada interaksi pertama jika sebelumnya sedang memutar sebelum reload F5
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!savedStateRef.current?.wasPlaying || !currentTrack) return;

    const resumeOnInteraction = () => {
      play();
    };

    window.addEventListener("pointerdown", resumeOnInteraction, { once: true });
    window.addEventListener("keydown", resumeOnInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", resumeOnInteraction);
      window.removeEventListener("keydown", resumeOnInteraction);
    };
  }, [currentTrack, play]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
    }
    if (activeBlobUrlRef.current) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
    if (
      youTubePlayerRef.current &&
      typeof youTubePlayerRef.current.stopVideo === "function"
    ) {
      try {
        youTubePlayerRef.current.stopVideo();
      } catch {}
    }
    setIsPlaying(false);
    setSourceType("none");
    setCurrentTrack(null);
    setCurrentTime(0);
    setDuration(0);
    if (typeof window !== "undefined") {
      localStorage.removeItem("polije_music_state");
    }
  }, []);

  // 1. Memuat file lokal (MP3/WAV/OGG)
  const loadLocalFile = useCallback(
    async (file: File): Promise<boolean> => {
      const validation = validateLocalAudioFile(file);
      if (!validation.valid) {
        toast.error(validation.error || "File audio tidak valid.");
        return false;
      }

      // Reset durasi dan waktu lagu sebelumnya
      setCurrentTime(0);
      setDuration(0);

      try {
        if (volume === 0) {
          setVolume(75);
        }
        if (isMuted) {
          setIsMuted(false);
        }

        // Hentikan YouTube player jika sedang jalan
        if (youTubePlayerRef.current?.stopVideo) {
          try {
            youTubePlayerRef.current.stopVideo();
          } catch {}
        }

        // Revoke URL sebelumnya jika ada
        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        }

        const blobUrl = URL.createObjectURL(file);
        activeBlobUrlRef.current = blobUrl;

        if (audioRef.current) {
          audioRef.current.src = blobUrl;
          audioRef.current.volume = isMuted ? 0 : volume / 100;
          audioRef.current.load();
          await audioRef.current.play();
        }

        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setCurrentTrack({
          title: cleanName,
          artist: "File Lokal",
          url: blobUrl,
        });
        setSourceType("local");
        setIsPlaying(true);

        toast.success(`Memutar: ${cleanName}`);
        return true;
      } catch (err: any) {
        console.error("Error playing local file:", err);
        toast.error("Gagal memutar file audio lokal.");
        return false;
      }
    },
    [volume, isMuted]
  );

  // 2. Memuat dari URL (YouTube, Spotify, Apple Music, Direct Audio)
  const loadUrl = useCallback(
    async (inputUrl: string): Promise<boolean> => {
      const parsed = parseMediaUrl(inputUrl);
      if (parsed.type === "invalid") {
        toast.error(parsed.error || "URL tidak valid.");
        return false;
      }

      // Reset waktu & durasi lagu baru seketika
      setCurrentTime(0);
      setDuration(0);

      // Hentikan audio HTML5 sebelumnya
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }

      if (parsed.type === "youtube") {
        if (volume === 0) {
          setVolume(75);
        }
        if (isMuted) {
          setIsMuted(false);
        }

        setCurrentTrack({
          title: "Memuat judul YouTube...",
          artist: "YouTube",
          youtubeId: parsed.id,
          url: parsed.cleanUrl,
        });
        setSourceType("youtube");
        setIsPlaying(true);

        if (
          youTubePlayerRef.current &&
          typeof youTubePlayerRef.current.loadVideoById === "function"
        ) {
          try {
            youTubePlayerRef.current.loadVideoById({
              videoId: parsed.id,
              startSeconds: 0,
            });
            youTubePlayerRef.current.setVolume(isMuted ? 0 : (volume === 0 ? 75 : volume));
            youTubePlayerRef.current.playVideo();
          } catch {}
        }

        // Ambil judul asli video dan channel YouTube dari server
        const targetUrl = parsed.cleanUrl || inputUrl;
        fetch(`/api/music/info?url=${encodeURIComponent(targetUrl)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data?.title) {
              setCurrentTrack((prev) =>
                prev && prev.youtubeId === parsed.id
                  ? {
                      ...prev,
                      title: data.title,
                      artist: data.author || "YouTube",
                    }
                  : prev
              );
              if (typeof data.duration === "number" && data.duration > 0) {
                setDuration(data.duration);
              }
              toast.success(`Memutar: ${data.title}`);
            }
          })
          .catch(() => {
            setCurrentTrack((prev) =>
              prev && prev.youtubeId === parsed.id
                ? {
                    ...prev,
                    title: `YouTube Video (${parsed.id})`,
                  }
                : prev
            );
          });

        return true;
      }

      if (parsed.type === "spotify") {
        // Stop YouTube
        if (youTubePlayerRef.current?.stopVideo) {
          try {
            youTubePlayerRef.current.stopVideo();
          } catch {}
        }
        setCurrentTrack({
          title: "Spotify Player",
          artist: "Spotify",
          embedUrl: parsed.embedUrl,
          url: parsed.cleanUrl,
        });
        setSourceType("spotify");
        setIsPlaying(true);

        const targetSpotifyUrl = parsed.cleanUrl || inputUrl;
        fetch(`/api/music/info?url=${encodeURIComponent(targetSpotifyUrl)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data?.title) {
              setCurrentTrack((prev) =>
                prev && prev.url === parsed.cleanUrl
                  ? {
                      ...prev,
                      title: data.title,
                      artist: data.author || "Spotify",
                    }
                  : prev
              );
            }
          })
          .catch(() => {});

        toast.success("Widget Spotify siap diputar di dialog!");
        return true;
      }

      if (parsed.type === "apple") {
        if (youTubePlayerRef.current?.stopVideo) {
          try {
            youTubePlayerRef.current.stopVideo();
          } catch {}
        }
        setCurrentTrack({
          title: "Apple Music",
          artist: "Apple Music",
          embedUrl: parsed.embedUrl,
          url: parsed.cleanUrl,
        });
        setSourceType("apple");
        setIsPlaying(true);
        toast.success("Widget Apple Music siap diputar di dialog!");
        return true;
      }

      if (parsed.type === "direct_audio") {
        if (youTubePlayerRef.current?.stopVideo) {
          try {
            youTubePlayerRef.current.stopVideo();
          } catch {}
        }
        try {
          if (audioRef.current && parsed.cleanUrl) {
            audioRef.current.src = parsed.cleanUrl;
            audioRef.current.volume = isMuted ? 0 : volume / 100;
            audioRef.current.load();
            await audioRef.current.play();
          }
          setCurrentTrack({
            title: "Web Audio Stream",
            artist: "Live Stream",
            url: parsed.cleanUrl,
          });
          setSourceType("stream");
          setIsPlaying(true);
          toast.success("Memutar live audio stream!");
          return true;
        } catch {
          toast.error("Gagal memutar direct audio stream.");
          return false;
        }
      }

      return false;
    },
    [volume, isMuted]
  );

  // 3. Memuat Preset
  const loadPreset = useCallback(
    (presetId: string) => {
      const preset = MUSIC_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;

      // Reset waktu & durasi
      setCurrentTime(0);
      setDuration(0);

      // Unbind HTML5 audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }

      if (volume === 0) {
        setVolume(75);
      }
      if (isMuted) {
        setIsMuted(false);
      }

      // 1. Jika preset bertipe YouTube
      if (preset.type === "youtube" && preset.youtubeId) {
        if (preset.duration && preset.duration > 0) {
          setDuration(preset.duration);
        }

        setCurrentTrack({
          title: preset.name,
          artist: preset.author,
          youtubeId: preset.youtubeId,
          url: preset.url || `https://www.youtube.com/watch?v=${preset.youtubeId}`,
        });
        setSourceType("youtube");
        setIsPlaying(true);

        if (
          youTubePlayerRef.current &&
          typeof youTubePlayerRef.current.loadVideoById === "function"
        ) {
          try {
            youTubePlayerRef.current.loadVideoById({
              videoId: preset.youtubeId,
              startSeconds: 0,
            });
            youTubePlayerRef.current.setVolume(isMuted ? 0 : (volume === 0 ? 75 : volume));
            youTubePlayerRef.current.playVideo();
          } catch (e) {
            console.warn("YouTube player loadVideoById error:", e);
          }
        }

        // Ambil info durasi preset jika ada
        const presetTargetUrl = preset.url || `https://www.youtube.com/watch?v=${preset.youtubeId}`;
        fetch(`/api/music/info?url=${encodeURIComponent(presetTargetUrl)}`)
          .then((res) => res.json())
          .then((data) => {
            if (typeof data.duration === "number" && data.duration > 0) {
              setDuration(data.duration);
            }
          })
          .catch(() => {});

        toast.success(`Memutar: ${preset.name}`);
        return;
      }

      // 2. Fallback stream
      if (preset.type === "stream" && preset.url) {
        if (youTubePlayerRef.current?.stopVideo) {
          try {
            youTubePlayerRef.current.stopVideo();
          } catch {}
        }
        if (audioRef.current) {
          audioRef.current.src = preset.url;
          audioRef.current.volume = isMuted ? 0 : volume / 100;
          audioRef.current.load();
          audioRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.warn("Stream play failed:", err);
              setIsPlaying(false);
              toast.error("Stream tidak dapat diputar di browser ini.");
            });
        }
        setCurrentTrack({
          title: preset.name,
          artist: preset.author,
          url: preset.url,
        });
        setSourceType("stream");
        toast.success(`Memutar: ${preset.name}`);
      }
    },
    [volume, isMuted]
  );

  const openDialog = useCallback(() => setDialogOpen(true), []);
  const closeDialog = useCallback(() => setDialogOpen(false), []);

  const contextValue = useMemo(
    () => ({
      isPlaying,
      volume,
      isMuted,
      sourceType,
      currentTrack,
      currentTime,
      duration,
      seek,
      setCurrentTime,
      setDuration,
      dialogOpen,
      openDialog,
      closeDialog,
      togglePlay,
      play,
      pause,
      stop,
      setVolume,
      toggleMute,
      loadUrl,
      loadLocalFile,
      loadPreset,
      setPlayerPlaying,
      youTubePlayerRef,
    }),
    [
      isPlaying,
      volume,
      isMuted,
      sourceType,
      currentTrack,
      currentTime,
      duration,
      seek,
      dialogOpen,
      openDialog,
      closeDialog,
      togglePlay,
      play,
      pause,
      stop,
      setVolume,
      toggleMute,
      loadUrl,
      loadLocalFile,
      loadPreset,
      setPlayerPlaying,
    ]
  );

  return (
    <MusicContext.Provider value={contextValue}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error("useMusic must be used within a MusicProvider");
  }
  return context;
};
