"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchMessages, sendMessage } from "@/lib/livechat";
import { X, MessageSquare, Trash2, Reply } from "lucide-react";
import clsx from "clsx";

type Msg = {
  id: number;
  room: string;
  sender_id: string;
  sender_role: "user" | "admin";
  sender_name?: string | null;
  content: string;
  created_at: string;

  // reply optional fields (kalau kolom ada di DB)
  reply_to_id?: number | null;
  reply_to_name?: string | null;
  reply_to_content?: string | null;
};

type PresenceUser = {
  id: string;
  name: string;
  role: "user" | "admin";
  typing?: boolean;
  lastTypingAt?: number;
};

const CHAT_ROOM = "global";
const COOLDOWN_MS = 1500;
const MAX_LEN = 500;

export default function LiveChatWidget() {
  // ---------- state ----------
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [name, setName] = useState("");
  const [nameReady, setNameReady] = useState(false);

  const [onlineMap, setOnlineMap] = useState<Record<string, PresenceUser>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const [notice, setNotice] = useState<string | null>(null);

  // reply state
  const [replyTo, setReplyTo] = useState<Msg | null>(null);

  // ---------- refs ----------
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  const lastSendAtRef = useRef<number>(0);
  const lastMsgRef = useRef<string>("");
  const noticeTimerRef = useRef<any>(null);
  const typingTimerRef = useRef<any>(null);
  const typingThrottleRef = useRef<number>(0);

  // ---------- utils ----------
  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2500);
  }

  function escapeHtml(input: string) {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function sanitize(text: string) {
    const t = text.trim().slice(0, MAX_LEN);
    return escapeHtml(t);
  }

  function getNameKey(uid: string) {
    return `global_chat_name_${uid}`;
  }

  function saveName() {
    const n = name.trim().slice(0, 30);
    if (!n || !userId) return;
    localStorage.setItem(getNameKey(userId), n);
    setName(n);
    setNameReady(true);
  }

  function resetName() {
    if (!userId) return;
    localStorage.removeItem(getNameKey(userId));
    setName("");
    setNameReady(false);
    setReplyTo(null);
  }

  function truncate(s: string, n = 80) {
    const t = (s || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n) + "…" : t;
  }

  // ---------- derived ----------
  const onlineCount = useMemo(() => Object.keys(onlineMap).length, [onlineMap]);

  const typingLine = useMemo(() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return "";
    if (names.length === 1) return `${names[0]} sedang mengetik...`;
    if (names.length === 2)
      return `${names[0]} & ${names[1]} sedang mengetik...`;
    return `${names.slice(0, 2).join(", ")} +${
      names.length - 2
    } sedang mengetik...`;
  }, [typingUsers]);

  // ---------- auth + admin check ----------
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id ?? null;
        if (!mounted) return;

        setUserId(uid);

        if (!uid) {
          setIsAdmin(false);
          return;
        }

        const { data } = await supabase
          .from("users")
          .select("is_admin, admin, role")
          .eq("id", uid)
          .single();

        if (!mounted) return;

        const adminFlag =
          !!data?.is_admin || !!data?.admin || data?.role === "admin";
        setIsAdmin(adminFlag);
      } catch {
        if (mounted) setIsAdmin(false);
      }
    }

    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  // ---------- load display name PER USER ----------
  useEffect(() => {
    if (!userId) return;

    const saved = localStorage.getItem(getNameKey(userId));
    if (saved && saved.trim()) {
      setName(saved);
      setNameReady(true);
    } else {
      setName("");
      setNameReady(false);
    }
  }, [userId]);

  // ---------- load messages when opened ----------
  useEffect(() => {
    if (!open) return;
    fetchMessages()
      .then((data) => setMsgs((data || []) as unknown as Msg[]))
      .catch(() => setMsgs([]));
  }, [open]);

  // ---------- realtime chat (INSERT + DELETE) ----------
  useEffect(() => {
    const ch = supabase
      .channel("global-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room=eq.${CHAT_ROOM}`,
        },
        (payload) => {
          const m = payload.new as Msg;
          setMsgs((prev) => [...prev, m]);

          // mention popup
          if (
            nameReady &&
            name &&
            m.sender_id !== userId &&
            new RegExp(`@${name}\\b`, "i").test(m.content)
          ) {
            showNotice(`📣 Kamu di-mention oleh ${m.sender_name || "User"}!`);
            try {
              const audio = new Audio("/sounds/mention.mp3");
              audio.volume = 0.35;
              audio.play().catch(() => {});
            } catch {}
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chat_messages",
          filter: `room=eq.${CHAT_ROOM}`,
        },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (!deletedId) return;
          setMsgs((prev) => prev.filter((x) => x.id !== deletedId));
        }
      )
      .subscribe();

    chatChannelRef.current = ch;

    return () => {
      if (chatChannelRef.current)
        supabase.removeChannel(chatChannelRef.current);
      chatChannelRef.current = null;
    };
  }, [nameReady, name, userId]);

  // ---------- presence (online users + typing broadcast) ----------
  useEffect(() => {
    if (!userId) return;

    const presence = supabase.channel("presence-global-chat", {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    presence.on("presence", { event: "sync" }, () => {
      const state = presence.presenceState() as Record<string, any[]>;
      const map: Record<string, PresenceUser> = {};

      Object.keys(state).forEach((uid) => {
        const latest = state[uid][state[uid].length - 1];
        map[uid] = {
          id: uid,
          name: latest?.name || "User",
          role: latest?.role || "user",
          typing: latest?.typing || false,
          lastTypingAt: latest?.lastTypingAt || 0,
        };
      });

      setOnlineMap(map);

      const tmap: Record<string, string> = {};
      Object.values(map).forEach((u) => {
        if (u.typing && u.id !== userId) tmap[u.id] = u.name;
      });
      setTypingUsers(tmap);
    });

    presence.on("broadcast", { event: "typing" }, ({ payload }) => {
      const { uid, name: uname, typing } = payload || {};
      if (!uid || uid === userId) return;

      setTypingUsers((prev) => {
        const next = { ...prev };
        if (typing) next[uid] = uname || "User";
        else delete next[uid];
        return next;
      });

      setOnlineMap((prev) => {
        if (!prev[uid]) return prev;
        return {
          ...prev,
          [uid]: { ...prev[uid], typing: !!typing },
        };
      });
    });

    presence.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await presence.track({
          id: userId,
          name: nameReady ? name : "User",
          role: isAdmin ? "admin" : "user",
          typing: false,
          lastTypingAt: 0,
        });
      }
    });

    presenceChannelRef.current = presence;

    return () => {
      if (presenceChannelRef.current)
        supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    };
  }, [userId, nameReady, name, isAdmin]);

  // update presence name kalau user ganti nama
  useEffect(() => {
    if (!presenceChannelRef.current || !userId) return;
    presenceChannelRef.current.track({
      id: userId,
      name: nameReady ? name : "User",
      role: isAdmin ? "admin" : "user",
      typing: false,
      lastTypingAt: Date.now(),
    });
  }, [nameReady, name, isAdmin, userId]);

  // ---------- autoscroll ----------
  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  // ---------- typing handler ----------
  function emitTyping(isTyping: boolean) {
    if (!presenceChannelRef.current || !userId) return;

    const now = Date.now();
    if (now - typingThrottleRef.current < 500 && isTyping) return;
    typingThrottleRef.current = now;

    presenceChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { uid: userId, name: name || "User", typing: isTyping },
    });

    presenceChannelRef.current.track({
      id: userId,
      name: name || "User",
      role: isAdmin ? "admin" : "user",
      typing: isTyping,
      lastTypingAt: now,
    });
  }

  function onTypeChange(v: string) {
    setText(v);

    if (!nameReady) return;

    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 1200);
  }

  // ---------- send message ----------
  async function onSend() {
    if (!text.trim() || !userId || !nameReady) return;

    const now = Date.now();
    if (now - lastSendAtRef.current < COOLDOWN_MS) {
      showNotice("⏳ Pelan-pelan ya, jangan spam 🙏");
      return;
    }

    const cleaned = sanitize(text);
    if (!cleaned) return;

    if (cleaned === lastMsgRef.current) {
      showNotice("❗ Jangan kirim pesan yang sama terus.");
      return;
    }

    lastSendAtRef.current = now;
    lastMsgRef.current = cleaned;

    try {
      await (sendMessage as any)(
        userId,
        isAdmin ? "admin" : "user",
        name.trim(),
        cleaned,
        replyTo
          ? {
              reply_to_id: replyTo.id,
              reply_to_name:
                replyTo.sender_role === "admin"
                  ? "Admin"
                  : replyTo.sender_name || "User",
              reply_to_content: truncate(replyTo.content, 120),
            }
          : null
      );

      setText("");
      setReplyTo(null);
      emitTyping(false);
    } catch {
      showNotice("Gagal mengirim pesan.");
    }
  }

  // ---------- admin delete ----------
  async function onDeleteMessage(mid: number) {
    if (!isAdmin) return;
    try {
      await supabase.from("chat_messages").delete().eq("id", mid);
    } catch {
      showNotice("Gagal menghapus pesan.");
    }
  }

  // Chat hanya untuk user login
  if (!userId) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-purple-600 px-4 py-3 text-white shadow-lg hover:bg-purple-700"
        >
          <MessageSquare className="h-5 w-5" />
          Live Chat
        </button>
      )}

      {/* Drawer */}
      <div
        className={clsx(
          "fixed bottom-5 right-5 z-50 w-[370px] max-w-[94vw] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl transition-all",
          open
            ? "translate-y-0 opacity-100"
            : "translate-y-5 opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-zinc-900 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            Polije Live Chat
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 ring-1 ring-emerald-400/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online {onlineCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {nameReady && (
              <button
                onClick={resetName}
                className="text-[11px] text-white/60 hover:text-white/90"
                title="Ganti nama chat"
              >
                ganti nama
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Notice popup */}
        {notice && (
          <div className="px-3 pt-2">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white">
              {notice}
            </div>
          </div>
        )}

        {/* ====== PANEL INPUT NAMA ====== */}
        {!nameReady ? (
          <div className="p-4 space-y-3">
            <div className="text-white font-semibold text-sm">
              Masukkan nama untuk chat
            </div>
            <input
              className="w-full rounded-xl bg-zinc-800 px-3 py-2 text-white outline-none placeholder:text-white/40"
              placeholder="Contoh: Anam"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
            />
            <button
              onClick={saveName}
              className="w-full rounded-xl bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
            >
              Lanjut Chat
            </button>
          </div>
        ) : (
          <>
            {/* ====== LIST CHAT ====== */}
            <div
              className={clsx(
                "relative h-[380px] overflow-y-auto px-3 py-3 text-sm",
                "bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.10)_0%,_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(59,130,246,0.10)_0%,_transparent_60%),linear-gradient(180deg,_rgba(0,0,0,0.9)_0%,_rgba(0,0,0,0.7)_100%)]"
              )}
            >
              {msgs.map((m) => {
                const isMine = m.sender_id === userId;
                const bubbleClass = isMine
                  ? "bg-purple-600 text-white"
                  : m.sender_role === "admin"
                  ? "bg-zinc-800 text-white"
                  : "bg-zinc-900 text-white";

                return (
                  <div
                    key={m.id}
                    className={clsx(
                      "group my-1 flex items-end gap-2",
                      isMine ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={clsx(
                        "max-w-[80%] rounded-2xl px-3 py-2 shadow-sm",
                        bubbleClass
                      )}
                    >
                      <div className="text-[11px] opacity-80 mb-1 font-medium">
                        {m.sender_role === "admin"
                          ? "Admin"
                          : m.sender_name || "User"}
                      </div>

                      {/* reply preview inside bubble */}
                      {m.reply_to_id && (
                        <div className="mb-2 rounded-xl bg-black/25 px-2 py-1.5 text-[11px] border border-white/10">
                          <div className="opacity-80 font-semibold">
                            Reply to {m.reply_to_name || "User"}
                          </div>
                          <div className="opacity-70">
                            {m.reply_to_content || "(pesan)"}
                          </div>
                        </div>
                      )}

                      <div className="whitespace-pre-wrap break-words">
                        {m.content}
                      </div>

                      <div className="mt-1 text-[10px] opacity-60">
                        {new Date(m.created_at).toLocaleTimeString()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mb-1 flex items-center gap-1">
                      {/* Reply button (all users) */}
                      <button
                        onClick={() => {
                          setReplyTo(m);
                          setOpen(true);
                        }}
                        className="hidden rounded-lg bg-white/10 p-1 text-white/70 hover:bg-white/20 hover:text-white group-hover:inline-flex"
                        title="Reply"
                      >
                        <Reply className="h-4 w-4" />
                      </button>

                      {/* Admin delete */}
                      {isAdmin && (
                        <button
                          onClick={() => onDeleteMessage(m.id)}
                          className="hidden rounded-lg bg-red-500/15 p-1 text-red-300 hover:bg-red-500/30 group-hover:inline-flex"
                          title="Hapus pesan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div ref={bottomRef} />
            </div>

            {/* typing line */}
            {typingLine && (
              <div className="px-3 py-1 text-[11px] text-white/60 bg-zinc-950">
                {typingLine}
              </div>
            )}

            {/* ====== REPLY BAR + INPUT CHAT ====== */}
            <div className="border-t border-white/10 bg-zinc-900 p-2 space-y-2">
              {replyTo && (
                <div className="flex items-start justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-white">
                  <div className="min-w-0">
                    <div className="font-semibold opacity-90">
                      Reply to{" "}
                      {replyTo.sender_role === "admin"
                        ? "Admin"
                        : replyTo.sender_name || "User"}
                    </div>
                    <div className="opacity-70 truncate">
                      {truncate(replyTo.content, 140)}
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyTo(null)}
                    className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
                  >
                    batal
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-white outline-none placeholder:text-white/40"
                  placeholder="Tulis pesan..."
                  value={text}
                  onChange={(e) => onTypeChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onSend()}
                />
                <button
                  onClick={onSend}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
                >
                  Kirim
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
