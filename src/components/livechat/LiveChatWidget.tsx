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
  AtSign,
} from "lucide-react";
import clsx from "clsx";

type Msg = ChatMessage;

type PresenceUser = {
  id: string;
  name: string; // sekarang ISINYA username
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
  role: "user" | "admin" | string | null;
  is_admin: boolean;
};

const CHAT_ROOM = "global";
const COOLDOWN_MS = 1500;
const MAX_LEN = 500;

const EMOJIS = ["😂", "😮", "🔥", "❤️", "👍", "👎", "🎉", "🤯", "😡", "😢"];
const QUICK_REACT = ["😂", "🔥", "❤️", "👍"];

const lastReadKey = (uid: string) => `livechat:lastReadAt:${CHAT_ROOM}:${uid}`;

export default function LiveChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string>("User"); // dipakai buat mention

  const [onlineMap, setOnlineMap] = useState<Record<string, PresenceUser>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const [notice, setNotice] = useState<string | null>(null);

  const [replyTo, setReplyTo] = useState<Msg | null>(null);

  const [emojiOpen, setEmojiOpen] = useState(false);

  const [reactionsMap, setReactionsMap] = useState<
    Record<number, ReactionAgg[]>
  >({});

  const [recording, setRecording] = useState(false);

  const [unread, setUnread] = useState(0);

  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

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

  const lastReadAtRef = useRef<number>(0);

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

  function playMentionSound() {
    try {
      const audio = new Audio("/sounds/mention.mp3");
      audio.volume = 0.35;
      audio.play().catch(() => {});
    } catch {}
  }

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

  // ====== mention source (utama dari users, fallback dari presence) ======
  const mentionSource: MentionUser[] = useMemo(() => {
    if (mentionUsers.length) return mentionUsers;

    let list: MentionUser[] = Object.values(onlineMap)
      .map((u) => ({
        id: u.id,
        username: u.name || "user",
        role: u.role,
        is_admin: u.role === "admin",
      }))
      .filter((x) => x.username);

    if (isAdmin) {
      list = [
        { id: "all", username: "all", role: "admin", is_admin: true },
        ...list,
      ];
    }

    const seen = new Set<string>();
    return list.filter((x) => {
      const k = x.username.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [mentionUsers, onlineMap, isAdmin]);

  const filteredMentionUsers = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    const list = mentionSource.filter((u) =>
      u.username.toLowerCase().includes(q)
    );
    return list.slice(0, 8);
  }, [mentionSource, mentionQuery]);

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
          setUsername("User");
          return;
        }

        const { data } = await supabase
          .from("users")
          .select("is_admin, role, username")
          .eq("id", uid)
          .single();

        if (!mounted) return;

        const adminFlag = !!data?.is_admin || data?.role === "admin";
        setIsAdmin(adminFlag);

        const uname =
          data?.username || auth.user?.email?.split("@")[0] || "User";
        setUsername(String(uname));

        const saved = localStorage.getItem(lastReadKey(uid));
        lastReadAtRef.current = saved ? Number(saved) : 0;
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

  // ---------- hitung unread awal waktu chat tertutup ----------
  useEffect(() => {
    if (!userId || open) return;

    (async () => {
      try {
        // kalau belum pernah read, set ke pesan terakhir supaya history gak dihitung unread
        if (!lastReadAtRef.current) {
          const { data: lastMsg } = await supabase
            .from("chat_messages")
            .select("created_at")
            .eq("room", CHAT_ROOM)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const ts = lastMsg?.created_at
            ? new Date(lastMsg.created_at).getTime()
            : Date.now();

          lastReadAtRef.current = ts;
          localStorage.setItem(lastReadKey(userId), String(ts));
          setUnread(0);
          return;
        }

        const { count } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("room", CHAT_ROOM)
          .gt("created_at", new Date(lastReadAtRef.current).toISOString());

        // kalau RLS ngeblok count, count bisa null → fallback 0
        setUnread(count || 0);
      } catch {
        // RLS ngeblok query? gapapa, unread realtime tetap jalan
        setUnread((u) => u || 0);
      }
    })();
  }, [userId, open]);

  // ---------- fetch mention users dari table users ----------
  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, username, role, is_admin");

        if (error) throw error;

        let list =
          (data || [])
            .map((u: any) => ({
              id: String(u.id),
              username: String(u.username || ""),
              role: (u.role || "user") as any,
              is_admin: !!u.is_admin,
            }))
            .filter((u: any) => u.username) || [];

        if (isAdmin) {
          list = [
            { id: "all", username: "all", role: "admin", is_admin: true },
            ...list,
          ];
        }

        setMentionUsers(list);
      } catch {
        setMentionUsers(
          isAdmin
            ? [{ id: "all", username: "all", role: "admin", is_admin: true }]
            : []
        );
      }
    })();
  }, [userId, isAdmin]);

  // ---------- load messages when opened ----------
  useEffect(() => {
    if (!open) return;
    fetchMessages(CHAT_ROOM)
      .then((data) => {
        const arr = (data || []) as Msg[];
        setMsgs(arr);

        const last = arr[arr.length - 1];
        const ts = last ? new Date(last.created_at).getTime() : Date.now();
        lastReadAtRef.current = ts;
        if (userId) localStorage.setItem(lastReadKey(userId), String(ts));

        setUnread(0);
      })
      .catch(() => setMsgs([]));
  }, [open, userId]);

  // ---------- realtime chat ----------
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

          const isMine = m.sender_id === userId;
          const mTime = new Date(m.created_at).getTime();

          // unread realtime saat chat tertutup
          if (!open && !isMine) {
            if (mTime > lastReadAtRef.current) {
              setUnread((u) => u + 1);
            }
          }

          // notif mention by USERNAME
          const me = (username || "").toLowerCase();
          const content = (m.content || "").toLowerCase();

          if (me && !isMine && new RegExp(`@${me}\\b`, "i").test(content)) {
            showNotice(`📣 Kamu di-mention oleh ${m.sender_name || "User"}!`);
            playMentionSound();
          }

          if (!isMine && /@all\b/i.test(m.content || "")) {
            showNotice(`📣 Admin mention semua orang!`);
            playMentionSound();
          }

          // kalau chat kebuka, update read marker
          if (open) {
            lastReadAtRef.current = mTime;
            if (userId)
              localStorage.setItem(lastReadKey(userId), String(mTime));
            setUnread(0);
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
  }, [username, userId, open]);

  // ---------- presence ----------
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
          name: username || "User", // <= TRACK USERNAME
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

  // ---------- reactions ----------
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

  // ---------- typing ----------
  function emitTyping(isTyping: boolean) {
    if (!presenceChannelRef.current || !userId) return;
    const now = Date.now();
    if (now - typingThrottleRef.current < 500 && isTyping) return;
    typingThrottleRef.current = now;

    presenceChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: {
        uid: userId,
        name: username || "User",
        typing: isTyping,
      },
    });

    presenceChannelRef.current.track({
      id: userId,
      name: username || "User",
      role: isAdmin ? "admin" : "user",
      typing: isTyping,
      lastTypingAt: now,
    });
  }

  // detect mention by username (underscore, number, huruf)
  function handleMentionDetect(v: string) {
    const m = v.match(/(^|\s)@([a-zA-Z0-9_]*)$/);
    if (!m) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionIndex(0);
      return;
    }
    setMentionOpen(true);
    setMentionQuery(m[2] || "");
    setMentionIndex(0);
  }

  function onTypeChange(v: string) {
    setText(v);
    handleMentionDetect(v);

    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 1200);
  }

  function applyMention(u: MentionUser) {
    setText((prev) =>
      prev.replace(/(^|\s)@([a-zA-Z0-9_]*)$/, `$1@${u.username} `)
    );
    setMentionOpen(false);
    setMentionQuery("");
    setMentionIndex(0);
  }

  // ---------- send ----------
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

  async function onDeleteMessage(mid: number) {
    if (!isAdmin) return;
    try {
      await supabase.from("chat_messages").delete().eq("id", mid);
    } catch {
      showNotice("Gagal menghapus pesan.");
    }
  }

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

  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mr = new MediaRecorder(stream, { mimeType });
      recordChunksRef.current = [];

      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunksRef.current, { type: mimeType });
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: mimeType,
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

  if (!userId) return null;

  return (
    <>
      {/* BUTTON SAAT TERTUTUP + BADGE UNREAD */}
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            setUnread(0);
          }}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-purple-600 px-4 py-3 text-white shadow-lg hover:bg-purple-700"
        >
          <MessageSquare className="h-5 w-5" />
          Live Chat
          {unread > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}

      <div
        className={clsx(
          "fixed bottom-5 right-5 z-50 w-[380px] max-w-[94vw] rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl transition-all overflow-visible",
          open
            ? "translate-y-0 opacity-100"
            : "translate-y-5 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 rounded-t-2xl">
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

        {notice && (
          <div className="px-3 pt-2">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white">
              {notice}
            </div>
          </div>
        )}

        <div className="relative h-[380px] overflow-y-auto px-3 py-3 text-sm rounded-b-none">
          {msgs.map((m) => {
            const isMine = m.sender_id === userId;
            const reacts = reactionsMap[m.id] || [];
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
                <div className="max-w-[80%]">
                  <div className={clsx("rounded-2xl px-3 py-2", bubbleClass)}>
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
                          <img
                            src={m.attachment_url}
                            alt={m.attachment_name || "image"}
                            className="max-h-60 rounded-xl border border-white/10 object-contain"
                          />
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
                      >
                        <span className="text-sm">{e}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setReplyTo(m)}
                    className="hidden rounded-lg bg-white/10 p-1 text-white/70 hover:bg-white/20 hover:text-white group-hover:inline-flex"
                  >
                    <Reply className="h-4 w-4" />
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => onDeleteMessage(m.id)}
                      className="hidden rounded-lg bg-red-500/15 p-1 text-red-300 hover:bg-red-500/30 group-hover:inline-flex"
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

        <div className="border-t border-white/10 bg-zinc-900 p-2 space-y-2 relative rounded-b-2xl">
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

          {emojiOpen && (
            <div className="absolute bottom-[62px] left-2 z-50 w-[280px] rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setText((t) => t + e);
                      setEmojiOpen(false);
                    }}
                    className="rounded-lg p-1 hover:bg-white/10 text-lg"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mentionOpen && filteredMentionUsers.length > 0 && (
            <div className="absolute bottom-[62px] left-2 z-50 w-[260px] rounded-2xl border border-white/10 bg-zinc-950 p-1 shadow-2xl">
              {filteredMentionUsers.map((u, i) => (
                <button
                  key={u.id}
                  onClick={() => applyMention(u)}
                  className={clsx(
                    "w-full flex items-center gap-2 px-3 py-2 text-xs text-white/80 hover:bg-white/10 rounded-xl",
                    i === mentionIndex && "bg-white/10 text-white"
                  )}
                >
                  <AtSign className="h-3.5 w-3.5" />
                  <span className="truncate">@{u.username}</span>
                  {u.is_admin && (
                    <span className="ml-auto text-[10px] text-emerald-300">
                      admin
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex items-center gap-1 pb-1">
              <button
                onClick={() => setEmojiOpen((v) => !v)}
                className="rounded-xl bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <SmilePlus className="h-5 w-5" />
              </button>

              <button
                onClick={handlePickFile}
                className="rounded-xl bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {!recording ? (
                <button
                  onClick={startRecording}
                  className="rounded-xl bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <Mic className="h-5 w-5" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="rounded-xl bg-red-500/15 p-2 text-red-300 hover:bg-red-500/30"
                >
                  <StopCircle className="h-5 w-5" />
                </button>
              )}
            </div>

            <input
              className="flex-1 min-w-0 w-0 rounded-xl bg-zinc-800 px-3 py-2 text-white outline-none placeholder:text-white/40"
              placeholder="Tulis pesan..."
              value={text}
              onChange={(e) => onTypeChange(e.target.value)}
              onKeyDown={(e) => {
                if (mentionOpen && filteredMentionUsers.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setMentionIndex((i) =>
                      Math.min(i + 1, filteredMentionUsers.length - 1)
                    );
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setMentionIndex((i) => Math.max(i - 1, 0));
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyMention(filteredMentionUsers[mentionIndex]);
                    return;
                  }
                  if (e.key === "Escape") {
                    setMentionOpen(false);
                    return;
                  }
                }

                if (e.key === "Enter") onSend();
              }}
            />

            <button
              onClick={() => onSend()}
              className="rounded-xl bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 shrink-0"
            >
              Kirim
            </button>

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
