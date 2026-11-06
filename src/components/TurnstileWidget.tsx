"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          action?: string;
          appearance?: "always" | "execute" | "interaction-only";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (errorCode?: string) => void;
          "before-interactive-callback"?: () => void;
          "after-interactive-callback"?: () => void;
        },
      ) => string | number;
      reset: (widgetId: string | number) => void;
      remove?: (widgetId: string | number) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById("turnstile-script") as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Turnstile failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

type TurnstileWidgetProps = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  appearance?: "always" | "execute" | "interaction-only";
  action?: string;
  className?: string;
};

export default function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  appearance = "interaction-only",
  action = "login",
  className = "",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | number | null>(null);
  const [isInteractive, setIsInteractive] = useState(appearance === "always");
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;

        // Bersihkan widget lama jika ada
        if (widgetIdRef.current !== null && window.turnstile.remove) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // abaikan jika sudah di-remove
          }
          widgetIdRef.current = null;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          appearance,
          action,
          callback: (token) => {
            onVerifyRef.current(token);
          },
          "expired-callback": () => {
            onExpireRef.current?.();
          },
          "error-callback": () => {
            onErrorRef.current?.();
          },
          "before-interactive-callback": () => {
            setIsInteractive(true);
          },
          "after-interactive-callback": () => {
            setIsInteractive(false);
          },
        });
      })
      .catch(() => onErrorRef.current?.());

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, appearance, action]);

  if (!siteKey) {
    return (
      <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200 ring-1 ring-amber-500/30">
        CAPTCHA belum dikonfigurasi.
      </p>
    );
  }

  return (
    <div className={`transition-all duration-300 ${isInteractive ? "my-3" : "my-0"} ${className}`}>
      {isInteractive && (
        <p className="mb-2 text-center text-xs text-amber-300/90 font-medium">
          🛡️ Verifikasi keamanan diperlukan untuk melanjutkan:
        </p>
      )}
      <div
        ref={containerRef}
        className={`flex justify-center transition-all duration-300 ${
          isInteractive
            ? "min-h-[65px] opacity-100"
            : "h-0 min-h-0 overflow-hidden opacity-0 pointer-events-none"
        }`}
      />
    </div>
  );
}
