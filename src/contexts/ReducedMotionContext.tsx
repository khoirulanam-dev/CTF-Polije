// src/contexts/ReducedMotionContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type ReducedMotionContextType = {
  reducedMotion: boolean;
  toggleReducedMotion: () => void;
};

const ReducedMotionContext = createContext<ReducedMotionContextType | null>(
  null
);

export function ReducedMotionProvider({ children }: { children: ReactNode }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // 1. Cek dari localStorage dulu
    const saved =
      typeof window !== "undefined"
        ? localStorage.getItem("ctf-reduced-motion")
        : null;

    if (saved !== null) {
      const value = saved === "true";
      setReducedMotion(value);
      updateHtmlClass(value);
      return;
    }

    // 2. Kalau belum ada, ikut setting OS (prefers-reduced-motion)
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mq.matches);
      updateHtmlClass(mq.matches);

      const handler = (e: MediaQueryListEvent) => {
        setReducedMotion(e.matches);
        updateHtmlClass(e.matches);
        localStorage.setItem("ctf-reduced-motion", String(e.matches));
      };

      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  const updateHtmlClass = (value: boolean) => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    if (value) {
      html.classList.add("reduced-motion");
    } else {
      html.classList.remove("reduced-motion");
    }
  };

  const toggleReducedMotion = () => {
    setReducedMotion((prev) => {
      const next = !prev;
      updateHtmlClass(next);
      if (typeof window !== "undefined") {
        localStorage.setItem("ctf-reduced-motion", String(next));
      }
      return next;
    });
  };

  return (
    <ReducedMotionContext.Provider
      value={{ reducedMotion, toggleReducedMotion }}
    >
      {children}
    </ReducedMotionContext.Provider>
  );
}

export function useReducedMotion() {
  const ctx = useContext(ReducedMotionContext);
  if (!ctx) {
    throw new Error(
      "useReducedMotion must be used inside ReducedMotionProvider"
    );
  }
  return ctx;
}
