"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchMessages,
  sendMessage,
  toggleReaction,
  fetchReactions,
  uploadAttachment,
  ChatMessage,
  ChatAttachment,
} from "@/lib/livechat";
import {
  X,
  MessageSquare,
  Trash2,
  Reply,
  SmilePlus,
  Paperclip,
  Mic,
  StopCircle,
} from "lucide-react";
import clsx from "clsx";

type Msg = ChatMessage;

type PresenceUser = {
  id: string;
  name: string;
  role: "user" | "admin";
  typing?: boolean;
  lastTypingAt?: number;
};

type ReactionAgg = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

type MentionUser = {
  id: string;
  username: string;
  is_admin: boolean;
};

const CHAT_ROOM = "global";
const COOLDOWN_MS = 1500;
const MAX_LEN = 500;

// emoji list sederhana (no lib)
const EMOJIS = ["😂", "😮", "🔥", "❤️", "👍", "👎", "🎉", "🤯", "😡", "😢"];
const QUICK_REACT = ["😂", "🔥", "❤️", "👍"];

export default function LiveChatWidget() {
  // ---------- state ----------
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string>("User");

  const [onlineMap, setOnlineMap] = useState<Record<string, PresenceUser>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const [notice, setNotice] = useState<string | null>(null);

  // reply state
  const [replyTo, setReplyTo] = useState<Msg | null>(null);

  // emoji UI
  const [emojiOpen, setEmojiOpen] = useState(false);

  // reactions map: message_id -> ReactionAgg[]
  const [reactionsMap, setReactionsMap] = useState<
    Record<number, ReactionAgg[]>
  >({});

  // voice note
  const [recording, setRecording] = useState(false);

  // mention users + UI
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  // ---------- refs ----------
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);

  const lastSendAtRef = useRef<number>(0);
  const lastMsgRef = useRef<string>("");
  const noticeTimerRef = useRef<any>(null);
  const typingTimerRef = useRef<any>(null);
  const typingThrottleRef = useRef<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);

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

  function sanitize(t: string) {
    return escapeHtml(t.trim().slice(0, MAX_LEN));
  }

  function truncate(s: string, n = 80) {
    const t = (s || "").replace(/\s+/g, " ").trim();
    return t.length > n ? t.slice(0, n) + "…" : t;
  }

  // ambil token terakhir setelah spasi (untuk mention)
  function getLastToken(value: string) {
    const parts = value.split(/\s/);
    return parts[parts.length - 1] || "";
  }

  function replaceLastToken(value: string, newToken: string) {
    const parts = value.split(/\s/);
    parts[parts.length - 1] = newToken;
    return parts.join(" ");
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

  // helper online check (presence realtime)
  function isUserOnline(uid: string) {
    return !!onlineMap[uid];
  }

  // ---------- auth + admin check + get platform username ----------
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
          setUsername("User");
          return;
        }

        const { data } = await supabase
          .from("users")
          .select("is_admin, admin, username")
          .eq("id", uid)
          .single();

        if (!mounted) return;

        const adminFlag = !!data?.is_admin || !!data?.admin;
        setIsAdmin(adminFlag);
        setUsername((data?.username || auth.user?.email || "User").toString());
      } catch {
        if (mounted) {
          setIsAdmin(false);
          setUsername("User");
        }
      }
    }

    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  // ---------- fetch mention users (RPC) ----------
  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_public_users");
        if (error) {
          showNotice("mention hanya tampil jika policy select aktif");
          return;
        }

        let list: MentionUser[] =
          (data || [])
            .filter((u: any) => u.username && u.id !== userId) // ❗ exclude diri sendiri
            .map((u: any) => ({
              id: u.id as string,
              username: String(u.username),
              is_admin: !!u.is_admin,
            })) || [];

        // admin bisa @all
        if (isAdmin) {
          list = [{ id: "all", username: "all", is_admin: true }, ...list];
        }

        setMentionUsers(list);
      } catch {
        showNotice("mention hanya tampil jika policy select aktif");
      }
    })();
  }, [userId, isAdmin]);

  // ---------- load messages when opened ----------
  useEffect(() => {
    if (!open) return;
    fetchMessages(CHAT_ROOM)
      .then((data) => setMsgs((data || []) as Msg[]))
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
            username &&
            m.sender_id !== userId &&
            new RegExp(`@${username}\\b`, "i").test(m.content || "")
          ) {
            showNotice(`📣 Kamu di-mention oleh ${m.sender_name || "User"}!`);
            try {
              const audio = new Audio("/sounds/mention.mp3");
              audio.volume = 0.35;
              audio.play().catch(() => {});
            } catch {}
          }

          // admin @all
          if (
            m.sender_id !== userId &&
            /\@all\b/i.test(m.content || "") &&
            m.sender_role === "admin"
          ) {
            showNotice(`📣 Admin mem-mention semua orang!`);
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
          setReactionsMap((prev) => {
            const next = { ...prev };
            delete next[deletedId];
            return next;
          });
        }
      )
      .subscribe();

    chatChannelRef.current = ch;

    return () => {
      if (chatChannelRef.current)
        supabase.removeChannel(chatChannelRef.current);
      chatChannelRef.current = null;
    };
  }, [username, userId]);

  // ---------- presence (online users + typing broadcast) ----------
  useEffect(() => {
    if (!userId) return;

    const presence = supabase.channel("presence-global-chat", {
      config: { presence: { key: userId } },
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
          typing: !!latest?.typing,
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
        return { ...prev, [uid]: { ...prev[uid], typing: !!typing } };
      });
    });

    presence.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await presence.track({
          id: userId,
          name: username || "User",
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
  }, [userId, username, isAdmin]);

  // ---------- autoscroll ----------
  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  // ---------- reactions fetch/aggregate ----------
  useEffect(() => {
    if (!msgs.length) return;
    const ids = msgs.map((m) => m.id);
    fetchReactions(ids)
      .then((rows: any[]) => {
        const agg: Record<number, Record<string, ReactionAgg>> = {};
        for (const r of rows) {
          const mid = r.message_id as number;
          const emoji = r.emoji as string;
          if (!agg[mid]) agg[mid] = {};
          if (!agg[mid][emoji]) {
            agg[mid][emoji] = { emoji, count: 0, reactedByMe: false };
          }
          agg[mid][emoji].count += 1;
          if (r.user_id === userId) agg[mid][emoji].reactedByMe = true;
        }
        const out: Record<number, ReactionAgg[]> = {};
        Object.keys(agg).forEach((midStr) => {
          const mid = Number(midStr);
          out[mid] = Object.values(agg[mid]);
        });
        setReactionsMap(out);
      })
      .catch(() => {});
  }, [msgs, userId]);

  async function onReact(mid: number, emoji: string) {
    if (!userId) return;
    try {
      await toggleReaction(mid, emoji, userId);
      setReactionsMap((prev) => {
        const list = prev[mid] ? [...prev[mid]] : [];
        const idx = list.findIndex((x) => x.emoji === emoji);
        if (idx === -1) {
          list.push({ emoji, count: 1, reactedByMe: true });
        } else {
          const it = list[idx];
          if (it.reactedByMe) {
            const newCount = it.count - 1;
            if (newCount <= 0) list.splice(idx, 1);
            else list[idx] = { ...it, count: newCount, reactedByMe: false };
          } else {
            list[idx] = { ...it, count: it.count + 1, reactedByMe: true };
          }
        }
        return { ...prev, [mid]: list };
      });
    } catch {
      showNotice("Gagal react.");
    }
  }

  // ---------- typing handler ----------
  function emitTyping(isTyping: boolean) {
    if (!presenceChannelRef.current || !userId) return;

    const now = Date.now();
    if (now - typingThrottleRef.current < 500 && isTyping) return;
    typingThrottleRef.current = now;

    presenceChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { uid: userId, name: username || "User", typing: isTyping },
    });

    presenceChannelRef.current.track({
      id: userId,
      name: username || "User",
      role: isAdmin ? "admin" : "user",
      typing: isTyping,
      lastTypingAt: now,
    });
  }

  function onTypeChange(v: string) {
    setText(v);
    emitTyping(true);

    // ---- mention detection ----
    const token = getLastToken(v);
    if (token.startsWith("@")) {
      setMentionOpen(true);
      setMentionQuery(token.slice(1).toLowerCase());
    } else {
      setMentionOpen(false);
      setMentionQuery("");
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 1200);
  }

  function onPickMention(u: MentionUser) {
    const token = getLastToken(text);
    if (!token.startsWith("@")) return;

    const replaced = replaceLastToken(text, `@${u.username} `);
    setText(replaced);
    setMentionOpen(false);
    setMentionQuery("");
  }

  const filteredMentions = useMemo(() => {
    const q = mentionQuery.trim();
    if (!q) return mentionUsers;
    return mentionUsers.filter((u) => u.username.toLowerCase().includes(q));
  }, [mentionUsers, mentionQuery]);

  // ---------- send message ----------
  async function onSend(attachment?: ChatAttachment | null) {
    if (!userId) return;

    const now = Date.now();
    if (now - lastSendAtRef.current < COOLDOWN_MS) {
      showNotice("⏳ Pelan-pelan ya, jangan spam 🙏");
      return;
    }

    const cleaned = sanitize(text);

    if (!cleaned && !attachment) return;

    if (cleaned && cleaned === lastMsgRef.current && !attachment) {
      showNotice("❗ Jangan kirim pesan yang sama terus.");
      return;
    }

    lastSendAtRef.current = now;
    lastMsgRef.current = cleaned;

    try {
      await sendMessage(
        userId,
        isAdmin ? "admin" : "user",
        username,
        cleaned,
        {
          ...(replyTo
            ? {
                reply_to_id: replyTo.id,
                reply_to_name:
                  replyTo.sender_role === "admin"
                    ? "Admin"
                    : replyTo.sender_name || "User",
                reply_to_content: truncate(replyTo.content, 120),
              }
            : {}),
          attachment: attachment || null,
        },
        CHAT_ROOM
      );

      setText("");
      setReplyTo(null);
      emitTyping(false);
      setMentionOpen(false);
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

  // ---------- attachment upload handlers ----------
  async function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    try {
      const att = await uploadAttachment(file, userId, CHAT_ROOM);
      await onSend(att);
    } catch (err: any) {
      showNotice(err?.message || "Upload gagal.");
    }
  }

  // ---------- voice note ----------
  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: "audio/webm",
        });
        try {
          if (!userId) return;
          const att = await uploadAttachment(file, userId, CHAT_ROOM);
          await onSend(att);
        } catch (err: any) {
          showNotice(err?.message || "Voice note gagal.");
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      showNotice("🎙️ Recording...");
    } catch {
      showNotice("Tidak bisa akses mic.");
    }
  }

  function stopRecording() {
    if (!recording) return;
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
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
          "fixed bottom-5 right-5 z-50 w-[380px] max-w-[94vw] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl transition-all",
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
          <button
            onClick={() => setOpen(false)}
            className="text-white/70 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notice popup */}
        {notice && (
          <div className="px-3 pt-2">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white">
              {notice}
            </div>
          </div>
        )}

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

            const reacts = reactionsMap[m.id] || [];

            return (
              <div
                key={m.id}
                className={clsx(
                  "group my-1 flex items-end gap-2",
                  isMine ? "justify-end" : "justify-start"
                )}
              >
                <div className="max-w-[80%]">
                  <div
                    className={clsx(
                      "rounded-2xl px-3 py-2 shadow-sm",
                      bubbleClass
                    )}
                  >
                    <div className="text-[11px] opacity-80 mb-1 font-medium">
                      {m.sender_role === "admin"
                        ? "Admin"
                        : m.sender_name || "User"}
                    </div>

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

                    {m.content && (
                      <div className="whitespace-pre-wrap break-words">
                        {m.content}
                      </div>
                    )}

                    {m.attachment_url && (
                      <div className="mt-2">
                        {m.attachment_type === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.attachment_url}
                            alt={m.attachment_name || "image"}
                            className="max-h-60 rounded-xl border border-white/10 object-contain"
                          />
                        ) : m.attachment_type === "pdf" ? (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                          >
                            📄 {m.attachment_name || "file.pdf"}
                          </a>
                        ) : m.attachment_type === "audio" ? (
                          <audio
                            controls
                            src={m.attachment_url}
                            className="w-full"
                          />
                        ) : (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                          >
                            📎 {m.attachment_name || "file"}
                          </a>
                        )}
                      </div>
                    )}

                    <div className="mt-1 text-[10px] opacity-60">
                      {new Date(m.created_at).toLocaleTimeString()}
                    </div>
                  </div>

                  {reacts.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {reacts.map((r) => (
                        <button
                          key={r.emoji}
                          onClick={() => onReact(m.id, r.emoji)}
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-[11px] border border-white/10 bg-white/5 hover:bg-white/10",
                            r.reactedByMe && "ring-1 ring-purple-400/60"
                          )}
                          title="Toggle reaction"
                        >
                          {r.emoji} {r.count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-1 flex items-center gap-1">
                  <div className="hidden items-center gap-1 group-hover:flex">
                    {QUICK_REACT.map((e) => (
                      <button
                        key={e}
                        onClick={() => onReact(m.id, e)}
                        className="rounded-lg bg-white/10 p-1 text-white/70 hover:bg-white/20 hover:text-white"
                        title={`React ${e}`}
                      >
                        <span className="text-sm">{e}</span>
                      </button>
                    ))}
                  </div>

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

        {typingLine && (
          <div className="px-3 py-1 text-[11px] text-white/60 bg-zinc-950">
            {typingLine}
          </div>
        )}

        {/* ====== REPLY BAR + INPUT CHAT ====== */}
        <div className="border-t border-white/10 bg-zinc-900 p-2 space-y-2 relative">
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

          {/* emoji picker */}
          {emojiOpen && (
            <div className="absolute bottom-[62px] left-2 z-20 w-[280px] rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setText((t) => t + e);
                      setEmojiOpen(false);
                    }}
                    className="rounded-lg p-1 hover:bg-white/10 text-lg"
                    title={e}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* mention dropdown */}
          {mentionOpen && filteredMentions.length > 0 && (
            <div className="absolute bottom-[62px] left-2 z-20 w-[280px] max-h-[220px] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-1 shadow-2xl">
              {filteredMentions.map((u) => {
                const online = u.id === "all" ? true : isUserOnline(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => onPickMention(u)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                  >
                    <div className="min-w-0 truncate">
                      @{u.username}
                      {u.is_admin && u.id !== "all" && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200">
                          admin
                        </span>
                      )}
                      {u.id === "all" && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">
                          broadcast
                        </span>
                      )}
                    </div>

                    <div
                      className={clsx(
                        "text-[10px] px-2 py-0.5 rounded-full border",
                        online
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : "border-white/10 bg-white/5 text-white/50"
                      )}
                    >
                      {online ? "online" : "offline"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-end w-full">
            {/* left tools */}
            <div className="flex items-center gap-1 pb-1">
              <button
                onClick={() => setEmojiOpen((v) => !v)}
                className="rounded-xl bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
                title="Emoji"
              >
                <SmilePlus className="h-5 w-5" />
              </button>

              <button
                onClick={handlePickFile}
                className="rounded-xl bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
                title="Upload file / foto / pdf / audio"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {!recording ? (
                <button
                  onClick={startRecording}
                  className="rounded-xl bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
                  title="Voice note"
                >
                  <Mic className="h-5 w-5" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="rounded-xl bg-red-500/15 p-2 text-red-300 hover:bg-red-500/30"
                  title="Stop recording"
                >
                  <StopCircle className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* input */}
            <input
              className="min-w-0 flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-white outline-none placeholder:text-white/40"
              placeholder="Tulis pesan..."
              value={text}
              onChange={(e) => onTypeChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
            />

            <button
              onClick={() => onSend()}
              className="shrink-0 whitespace-nowrap rounded-xl bg-purple-600 px-3 sm:px-4 py-2 text-white hover:bg-purple-700"
            >
              Kirim
            </button>

            {/* hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf,audio/*"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </div>
    </>
  );
}
