"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMusic } from "@/contexts/MusicContext";

export const HiddenYouTubePlayer: React.FC = () => {
  const {
    sourceType,
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    youTubePlayerRef,
    setPlayerPlaying,
    setCurrentTime,
    setDuration,
  } = useMusic();

  const [mounted, setMounted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [origin, setOrigin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && !origin) {
      setOrigin(window.location.origin);
    }
  }, [origin]);

  // Helper kirim postMessage ke YouTube IFrame
  const sendCommand = (func: string, args: any = "") => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func,
            args: args === "" ? [] : Array.isArray(args) ? args : [args],
          }),
          "*"
        );
      }
    } catch {}
  };

  const initialStart = useRef((() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("polije_music_state");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.currentTime === "number" && parsed.currentTime > 0) {
            return Math.floor(parsed.currentTime);
          }
        }
      } catch {}
    }
    return 0;
  })());
  const lastYtIdRef = useRef<string | undefined>(currentTrack?.youtubeId);

  // Reset waktu & durasi seketika saat ID video berganti (bukan saat mount sesi tersimpan)
  useEffect(() => {
    if (lastYtIdRef.current && lastYtIdRef.current !== currentTrack?.youtubeId) {
      initialStart.current = 0;
      setCurrentTime(0);
      setDuration(0);
    }
    lastYtIdRef.current = currentTrack?.youtubeId;
  }, [currentTrack?.youtubeId, setCurrentTime, setDuration]);

  // Kaitkan fungsi kontrol ke youTubePlayerRef di MusicContext
  useEffect(() => {
    youTubePlayerRef.current = {
      playVideo: () => sendCommand("playVideo"),
      pauseVideo: () => sendCommand("pauseVideo"),
      stopVideo: () => sendCommand("stopVideo"),
      loadVideoById: (args: any) => sendCommand("loadVideoById", args),
      setVolume: (v: number) => sendCommand("setVolume", v),
      mute: () => sendCommand("mute"),
      unMute: () => sendCommand("unMute"),
      seekTo: (sec: number) => sendCommand("seekTo", [sec, true]),
    };
  }, [youTubePlayerRef]);

  // Listener event postMessage dari YouTube IFrame
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        if (!event.data) return;

        // Keamanan: Validasi origin pengirim pesan (hanya domain resmi YouTube)
        if (
          event.origin !== "https://www.youtube.com" &&
          event.origin !== "https://www.youtube-nocookie.com"
        ) {
          return;
        }

        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        // Tangkap status playback YouTube
        if (data.event === "onStateChange") {
          // 1 = PLAYING, 2 = PAUSED, 0 = ENDED, 3 = BUFFERING
          if (data.info === 1) {
            setPlayerPlaying(true);
            sendCommand("listening");
          } else if (data.info === 2 || data.info === 0) {
            setPlayerPlaying(false);
          }
        } else if (data.event === "onReady") {
          sendCommand("listening");
        } else if (data.event === "initialDelivery" || data.event === "infoDelivery") {
          if (data.info && typeof data.info.playerState === "number") {
            if (data.info.playerState === 1) {
              setPlayerPlaying(true);
            } else if (
              data.info.playerState === 2 ||
              data.info.playerState === 0
            ) {
              setPlayerPlaying(false);
            }
          }
          if (data.info) {
            if (typeof data.info.currentTime === "number" && !isNaN(data.info.currentTime)) {
              setCurrentTime(Math.floor(data.info.currentTime));
            }
            if (typeof data.info.duration === "number" && !isNaN(data.info.duration)) {
              setDuration(data.info.duration > 0 ? Math.floor(data.info.duration) : 0);
            }
          }
        }
      } catch {}
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setPlayerPlaying, setCurrentTime, setDuration]);

  // Sinkronisasi Volume
  useEffect(() => {
    if (sourceType === "youtube") {
      const targetVol = isMuted ? 0 : (volume === 0 ? 75 : volume);
      sendCommand("setVolume", targetVol);
      if (isMuted) {
        sendCommand("mute");
      } else {
        sendCommand("unMute");
      }
    }
  }, [volume, isMuted, sourceType]);

  // Sinkronisasi Play/Pause
  useEffect(() => {
    if (sourceType === "youtube") {
      if (isPlaying) {
        sendCommand("playVideo");
      } else {
        sendCommand("pauseVideo");
      }
    }
  }, [isPlaying, sourceType]);

  if (!mounted || sourceType !== "youtube" || !currentTrack?.youtubeId) {
    return null;
  }

  const startParam = initialStart.current > 0 ? `&start=${initialStart.current}` : "";
  const embedSrc = `https://www.youtube.com/embed/${currentTrack.youtubeId}?autoplay=1&enablejsapi=1${
    origin ? `&origin=${origin}` : ""
  }${startParam}&playsinline=1&rel=0`;

  // Pemutar disembunyikan 100% tanpa elemen visual video di layar (Murni Audio)
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "1px",
        height: "1px",
        opacity: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: -9999,
      }}
    >
      <iframe
        ref={iframeRef}
        key={currentTrack.youtubeId}
        src={embedSrc}
        title="YouTube Audio Stream"
        allow="autoplay; encrypted-media"
        onLoad={() => {
          setTimeout(() => sendCommand("listening"), 300);
        }}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
    </div>
  );
};
