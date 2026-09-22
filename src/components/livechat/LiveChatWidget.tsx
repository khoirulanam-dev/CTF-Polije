"use client";

import { useEffect, useMemo, useRef, useState, useCallback, Fragment } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
  Search,
} from "lucide-react";
import clsx from "clsx";
import ImageWithFallback from "@/components/ImageWithFallback";

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
  userIds: string[];
};

type UserProfileMini = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type MentionUser = {
  id: string;
  username: string;
  is_admin: boolean;
};

const CHAT_ROOM = "global";
const COOLDOWN_SECONDS = 3;
const COOLDOWN_MS = COOLDOWN_SECONDS * 1000;
const MAX_LEN = 500;

// emoji list sederhana (no lib)
const EMOJIS = ["😂", "😮", "🔥", "❤️", "👍", "👎", "🎉", "🤯", "😡", "😢"];
const QUICK_REACT = ["😂", "🔥", "❤️", "👍"];

function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return timeStr;
  if (isYesterday) return `Kemarin, ${timeStr}`;

  if (date.getFullYear() !== now.getFullYear()) {
    return `${date.toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    })} • ${timeStr}`;
  }

  return `${date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  })} • ${timeStr}`;
}

function getMessageDateGroup(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isToday) return "Hari Ini";
  if (isYesterday) return "Kemarin";

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function LiveChatWidget() {
  const { user: authUser, loading: authLoading } = useAuth();

  // ---------- state ----------
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);

  // search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(authUser?.id || null);
  const [isAdmin, setIsAdmin] = useState(!!authUser?.is_admin);
  const [username, setUsername] = useState<string>(
    authUser?.username || "User"
  );

  const activeUserId = userId || authUser?.id || null;
  const activeUsername =
    (username && username !== "User" ? username : authUser?.username) ||
    "User";
  const activeIsAdmin = isAdmin || !!authUser?.is_admin;

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
  const [activeReactMsgId, setActiveReactMsgId] = useState<number | null>(null);

  // user profiles cache (id -> { id, username, avatar_url })
  const [userProfiles, setUserProfiles] = useState<
    Record<string, UserProfileMini>
  >({});
  const requestedProfileIdsRef = useRef<Set<string>>(new Set());

  // inspect reaction modal state
  const [inspectReaction, setInspectReaction] = useState<{
    messageId: number;
    selectedEmoji?: string | null;
  } | null>(null);

  // delete confirmation dialog state
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<{
    id: number;
    isMine: boolean;
  } | null>(null);

  // messages deleted for me (locally hidden)
  const [deletedForMeIds, setDeletedForMeIds] = useState<Set<number>>(new Set());

  // unread message counter (when closed)
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

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

  // Sync from AuthContext
  useEffect(() => {
    if (authUser?.id) {
      requestedProfileIdsRef.current.add(authUser.id);
      setUserId(authUser.id);
      setUsername(authUser.username || authUser.id.slice(0, 8));
      setIsAdmin(!!authUser.is_admin);
      setUserProfiles((prev) => ({
        ...prev,
        [authUser.id]: {
          id: authUser.id,
          username: authUser.username || authUser.id.slice(0, 8),
          avatar_url: authUser.avatar_url || null,
        },
      }));
    }
  }, [authUser]);

  // ---------- auth + admin check + get platform username ----------
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id ?? authUser?.id ?? null;
        if (!mounted) return;

        if (uid) {
          setUserId(uid);
          requestedProfileIdsRef.current.add(uid);
          const { data, error } = await supabase
            .from("users")
            .select("is_admin, username, avatar_url")
            .eq("id", uid)
            .single();

          if (!error && data && mounted) {
            setIsAdmin(!!data.is_admin);
            let uname = (data.username || "").trim();
            if (!uname) uname = uid.slice(0, 8);
            setUsername(uname);
            setUserProfiles((prev) => ({
              ...prev,
              [uid]: {
                id: uid,
                username: uname,
                avatar_url: data.avatar_url || null,
              },
            }));
          }
        }
      } catch (err) {
        console.warn("LiveChatWidget initAuth fallback to useAuth:", err);
      }
    }

    initAuth();
    return () => {
      mounted = false;
    };
  }, [authUser?.id]);

  // load messages deleted locally ("Hapus untuk saya")
  useEffect(() => {
    if (!activeUserId) return;
    try {
      const stored = localStorage.getItem(`chat_deleted_for_me_${activeUserId}`);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          setDeletedForMeIds(new Set(arr));
        }
      }
    } catch {}
  }, [activeUserId]);

  // messages visible to this user (filtered by deleted & search query)
  const visibleMsgs = useMemo(() => {
    const base = msgs.filter((m) => !deletedForMeIds.has(m.id));
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().trim();
    return base.filter((m) => {
      const contentMatch = m.content && m.content.toLowerCase().includes(q);
      const senderMatch =
        (m.sender_name && m.sender_name.toLowerCase().includes(q)) ||
        (userProfiles[m.sender_id]?.username &&
          userProfiles[m.sender_id].username.toLowerCase().includes(q));
      const attachMatch =
        m.attachment_name && m.attachment_name.toLowerCase().includes(q);
      return contentMatch || senderMatch || attachMatch;
    });
  }, [msgs, deletedForMeIds, searchQuery, userProfiles]);

  // Helper untuk mengambil avatar & username user yang belum ada di cache
  const fetchMissingUserProfiles = useCallback((ids: string[]) => {
    if (!ids || !ids.length) return;
    const unique = Array.from(new Set(ids.filter(Boolean)));
    const missing = unique.filter((id) => !requestedProfileIdsRef.current.has(id));
    if (missing.length === 0) return;

    missing.forEach((id) => requestedProfileIdsRef.current.add(id));

    supabase
      .from("users")
      .select("id, username, avatar_url")
      .in("id", missing)
      .then(
        ({ data }) => {
          if (data && data.length > 0) {
            setUserProfiles((current) => {
              const updated = { ...current };
              data.forEach((u: any) => {
                updated[u.id] = {
                  id: u.id,
                  username: u.username || u.id.slice(0, 8),
                  avatar_url: u.avatar_url || null,
                };
              });
              return updated;
            });
          }
        },
        () => {}
      );
  }, []);

  const refreshReactions = useCallback(
    (messageIds: number[]) => {
      if (!messageIds.length) return;
      fetchReactions(messageIds)
        .then((rows: any[]) => {
          const agg: Record<number, Record<string, ReactionAgg>> = {};
          const reactionUids: string[] = [];
          for (const r of rows) {
            const mid = r.message_id as number;
            const emoji = r.emoji as string;
            const uid = r.user_id as string;
            if (uid) reactionUids.push(uid);
            if (!agg[mid]) agg[mid] = {};
            if (!agg[mid][emoji]) {
              agg[mid][emoji] = {
                emoji,
                count: 0,
                reactedByMe: false,
                userIds: [],
              };
            }
            agg[mid][emoji].count += 1;
            if (uid && !agg[mid][emoji].userIds.includes(uid)) {
              agg[mid][emoji].userIds.push(uid);
            }
            if (r.user_id === userId) agg[mid][emoji].reactedByMe = true;
          }
          const out: Record<number, ReactionAgg[]> = {};
          Object.keys(agg).forEach((midStr) => {
            const mid = Number(midStr);
            out[mid] = Object.values(agg[mid]);
          });
          setReactionsMap(out);

          if (reactionUids.length) {
            fetchMissingUserProfiles(reactionUids);
          }
        })
        .catch(() => {});
    },
    [userId, fetchMissingUserProfiles]
  );

  // ---------- inspect reaction derived states ----------
  const inspectMessageReactions = useMemo(() => {
    if (!inspectReaction) return [];
    return reactionsMap[inspectReaction.messageId] || [];
  }, [inspectReaction, reactionsMap]);

  const totalInspectReactions = useMemo(() => {
    return inspectMessageReactions.reduce((acc, r) => acc + r.count, 0);
  }, [inspectMessageReactions]);

  const inspectUserList = useMemo(() => {
    if (!inspectReaction) return [];
    const list: { userId: string; emoji: string }[] = [];
    inspectMessageReactions.forEach((r) => {
      if (!inspectReaction.selectedEmoji || inspectReaction.selectedEmoji === r.emoji) {
        r.userIds.forEach((uid) => {
          list.push({ userId: uid, emoji: r.emoji });
        });
      }
    });
    return list;
  }, [inspectReaction, inspectMessageReactions]);

  useEffect(() => {
    if (!inspectReaction) return;
    const list = reactionsMap[inspectReaction.messageId] || [];
    const uids = list.flatMap((r) => r.userIds);
    if (uids.length) {
      fetchMissingUserProfiles(uids);
    }
  }, [inspectReaction, reactionsMap, fetchMissingUserProfiles]);

  // ---------- fetch mention users (RPC) ----------
  useEffect(() => {
    if (!activeUserId || !open) return;

    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_public_users");
        if (error) {
          showNotice("mention hanya tampil jika policy select aktif");
          return;
        }

        let list: MentionUser[] =
          (data || [])
            .filter((u: any) => u.username && u.id !== activeUserId)
            .map((u: any) => ({
              id: u.id as string,
              username: String(u.username),
              is_admin: !!u.is_admin,
            })) || [];

        if (activeIsAdmin) {
          list = [{ id: "all", username: "all", is_admin: true }, ...list];
        }

        setMentionUsers(list);
      } catch {
        showNotice("mention hanya tampil jika policy select aktif");
      }
    })();
  }, [activeUserId, activeIsAdmin, open]);

  // ---------- load messages on mount or when opened ----------
  useEffect(() => {
    if (!activeUserId) return;
    fetchMessages(CHAT_ROOM)
      .then((data) => {
        const list = (data || []) as Msg[];
        setMsgs(list);

        try {
          const stored = localStorage.getItem(`chat_last_read_id_${activeUserId}`);
          if (stored !== null) {
            const lastReadId = Number(stored);
            if (!isNaN(lastReadId)) {
              const unread = list.filter(
                (m) =>
                  m.id > lastReadId &&
                  m.sender_id !== activeUserId &&
                  m.content !== "__DELETED_FOR_EVERYONE__" &&
                  !deletedForMeIds.has(m.id)
              ).length;
              setUnreadCount(openRef.current ? 0 : unread);
            }
          } else {
            // First time: initialize to latest message so user starts with 0
            const latestId =
              list.length > 0 ? Math.max(...list.map((m) => m.id)) : 0;
            localStorage.setItem(
              `chat_last_read_id_${activeUserId}`,
              String(latestId)
            );
            setUnreadCount(0);
          }
        } catch {}
      })
      .catch(() => setMsgs([]));
  }, [activeUserId, deletedForMeIds]);

  // ---------- mark as read when chat is opened ----------
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      if (msgs.length > 0 && activeUserId) {
        const latestId = Math.max(...msgs.map((m) => m.id));
        try {
          localStorage.setItem(`chat_last_read_id_${activeUserId}`, String(latestId));
        } catch {}
      }
    }
  }, [open, msgs, activeUserId]);

  // ---------- realtime chat (INSERT + DELETE + REACTIONS) ----------
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

          if (m.sender_id === activeUserId) {
            m.sender_name = activeUsername;
            m.sender_role = activeIsAdmin ? "admin" : "user";
          } else if (m.sender_id) {
            fetchMissingUserProfiles([m.sender_id]);
          }

          setMsgs((prev) => [...prev, m]);

          // Increment unread count if chat is closed and message is not mine
          if (
            !openRef.current &&
            m.sender_id !== activeUserId &&
            m.content !== "__DELETED_FOR_EVERYONE__"
          ) {
            setUnreadCount((prev) => prev + 1);
          }

          if (
            activeUsername &&
            m.sender_id !== activeUserId &&
            new RegExp(`@${activeUsername}\\b`, "i").test(m.content || "")
          ) {
            showNotice(`📣 Kamu di-mention oleh ${m.sender_name || "User"}!`);
            try {
              const audio = new Audio("/sounds/mention.mp3");
              audio.volume = 0.35;
              audio.play().catch(() => {});
            } catch {}
          }

          if (
            m.sender_id !== activeUserId &&
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
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `room=eq.${CHAT_ROOM}`,
        },
        (payload) => {
          const updated = payload.new as Msg;
          if (updated && updated.id) {
            setMsgs((prev) =>
              prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
            );
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_reactions",
        },
        () => {
          setMsgs((current) => {
            if (current.length) {
              refreshReactions(current.map((m) => m.id));
            }
            return current;
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
  }, [activeUsername, activeUserId, activeIsAdmin, fetchMissingUserProfiles, refreshReactions]);

  // ---------- presence (online users + typing broadcast) ----------
  useEffect(() => {
    if (!activeUserId || !open) return;

    const presence = supabase.channel("presence-global-chat", {
      config: { presence: { key: activeUserId } },
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
        if (u.typing && u.id !== activeUserId) tmap[u.id] = u.name;
      });
      setTypingUsers(tmap);
    });

    presence.on("broadcast", { event: "typing" }, ({ payload }) => {
      const { uid, name: uname, typing } = payload || {};
      if (!uid || uid === activeUserId) return;

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
          id: activeUserId,
          name: activeUsername || "User",
          role: activeIsAdmin ? "admin" : "user",
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
  }, [activeUserId, activeUsername, activeIsAdmin, open]);

  // ---------- autoscroll ----------
  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
    return () => clearTimeout(timer);
  }, [msgs, open]);

  // ---------- cooldown countdown timer ----------
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((COOLDOWN_MS - (Date.now() - lastSendAtRef.current)) / 1000)
      );
      setCooldownLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 150);

    return () => clearInterval(timer);
  }, [cooldownLeft]);

  // ---------- reactions fetch/aggregate ----------
  useEffect(() => {
    if (!msgs.length) return;
    const ids = msgs.map((m) => m.id);
    const senderIds = msgs.map((m) => m.sender_id).filter(Boolean);
    if (activeUserId) senderIds.push(activeUserId);
    fetchMissingUserProfiles(senderIds);

    refreshReactions(ids);
  }, [msgs, activeUserId, fetchMissingUserProfiles, refreshReactions]);

  async function onReact(mid: number, emoji: string) {
    if (!activeUserId) return;
    try {
      await toggleReaction(mid, emoji, activeUserId);
      setReactionsMap((prev) => {
        const list = prev[mid] ? [...prev[mid]] : [];
        const idx = list.findIndex((x) => x.emoji === emoji);
        if (idx === -1) {
          list.push({
            emoji,
            count: 1,
            reactedByMe: true,
            userIds: [activeUserId],
          });
        } else {
          const it = list[idx];
          if (it.reactedByMe) {
            const newCount = it.count - 1;
            const newUserIds = (it.userIds || []).filter((id) => id !== activeUserId);
            if (newCount <= 0) list.splice(idx, 1);
            else list[idx] = { ...it, count: newCount, reactedByMe: false, userIds: newUserIds };
          } else {
            const newUserIds = (it.userIds || []).includes(activeUserId)
              ? it.userIds
              : [...(it.userIds || []), activeUserId];
            list[idx] = { ...it, count: it.count + 1, reactedByMe: true, userIds: newUserIds };
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
    if (!presenceChannelRef.current || !activeUserId) return;

    const now = Date.now();
    if (now - typingThrottleRef.current < 500 && isTyping) return;
    typingThrottleRef.current = now;

    presenceChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { uid: activeUserId, name: activeUsername || "User", typing: isTyping },
    });

    presenceChannelRef.current.track({
      id: activeUserId,
      name: activeUsername || "User",
      role: activeIsAdmin ? "admin" : "user",
      typing: isTyping,
      lastTypingAt: now,
    });
  }

  function onTypeChange(v: string) {
    setText(v);
    emitTyping(true);

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
    if (!activeUserId) return;

    const now = Date.now();
    const elapsed = now - lastSendAtRef.current;
    if (elapsed < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      showNotice(`⏳ Tunggu ${waitSec}s sebelum mengirim lagi.`);
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
    setCooldownLeft(COOLDOWN_SECONDS);

    try {
      await sendMessage(
        activeUserId,
        activeIsAdmin ? "admin" : "user",
        activeUsername,
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

  // ---------- delete handlers ----------
  async function handleDeleteForEveryone(mid: number) {
    // 1. Optimistic update locally for instant feedback (0ms delay)
    setMsgs((prev) =>
      prev.map((m) =>
        m.id === mid
          ? {
              ...m,
              content: "__DELETED_FOR_EVERYONE__",
              attachment_url: null,
              attachment_name: null,
              attachment_size: null,
              attachment_mime: null,
              attachment_type: null,
            }
          : m
      )
    );
    setReactionsMap((prev) => {
      const next = { ...prev };
      delete next[mid];
      return next;
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/chat/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messageId: mid }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menghapus pesan.");
      }
    } catch (err: any) {
      showNotice(err?.message || "Gagal menghapus pesan.");
    }
  }

  function handleDeleteForMe(mid: number) {
    // 1. Save to local storage for current user
    setDeletedForMeIds((prev) => {
      const next = new Set(prev);
      next.add(mid);
      if (activeUserId) {
        try {
          localStorage.setItem(
            `chat_deleted_for_me_${activeUserId}`,
            JSON.stringify(Array.from(next))
          );
        } catch {}
      }
      return next;
    });

    // 2. Optimistically remove from state immediately
    setMsgs((prev) => prev.filter((m) => m.id !== mid));
    setReactionsMap((prev) => {
      const next = { ...prev };
      delete next[mid];
      return next;
    });
  }

  // ---------- attachment upload handlers ----------
  async function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeUserId) return;
    try {
      const att = await uploadAttachment(file, activeUserId, CHAT_ROOM);
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
          if (!activeUserId) return;
          const att = await uploadAttachment(file, activeUserId, CHAT_ROOM);
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

  if (!activeUserId && !authLoading) return null;

  return (
    <>
      {!open && (
        <div className="fixed bottom-5 right-5 z-50">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2.5 rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 px-4 py-2.5 text-white font-bold text-sm shadow-[0_4px_25px_rgba(6,182,212,0.45)] hover:shadow-[0_4px_30px_rgba(6,182,212,0.7)] border border-cyan-200/40 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <MessageSquare className="h-4 w-4 drop-shadow-sm" />
            <span>Live Chat</span>
          </button>

          {/* WhatsApp-style unread message counter badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-black text-white shadow-[0_2px_12px_rgba(16,185,129,0.7)] ring-2 ring-zinc-950 animate-bounce pointer-events-none z-10">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
      )}

      <div
        className={clsx(
          "fixed bottom-5 right-5 z-50 w-[380px] max-w-[94vw] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl transition-all",
          open
            ? "translate-y-0 opacity-100"
            : "translate-y-5 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between bg-zinc-900 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            Polije Live Chat
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 ring-1 ring-emerald-400/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online {onlineCount}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((prev) => {
                  const next = !prev;
                  if (!next) setSearchQuery("");
                  else setTimeout(() => searchInputRef.current?.focus(), 100);
                  return next;
                });
              }}
              className={clsx(
                "rounded-lg p-1.5 transition-colors cursor-pointer",
                searchOpen
                  ? "bg-purple-500/20 text-purple-300"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
              title={searchOpen ? "Tutup pencarian" : "Cari pesan"}
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Tutup chat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {searchOpen && (
          <div className="flex items-center gap-2 border-b border-white/10 bg-zinc-900/95 px-3 py-2 animate-in slide-in-from-top-2 duration-150">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pesan atau nama user..."
                className="w-full rounded-xl bg-white/10 pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-purple-500/60"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs cursor-pointer"
                  title="Hapus pencarian"
                >
                  ✕
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <span className="text-[10px] text-white/50 shrink-0 font-mono">
                {visibleMsgs.length} hasil
              </span>
            )}
          </div>
        )}

        {notice && (
          <div className="px-3 pt-2">
            <div className="rounded-xl bg-white/10 px-3 py-2 text-xs text-white">
              {notice}
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {confirmDeleteMsg && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-[290px] rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-2xl space-y-3">
              <div className="flex items-center gap-2.5 text-white">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400 ring-1 ring-red-500/30">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Hapus pesan?</div>
                  <div className="text-[11px] text-white/50">Pilih opsi penghapusan</div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {confirmDeleteMsg.isMine && (
                  <button
                    type="button"
                    onClick={() => {
                      const mid = confirmDeleteMsg.id;
                      setConfirmDeleteMsg(null);
                      handleDeleteForEveryone(mid);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 px-3 py-2 text-xs font-semibold text-white shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    Hapus untuk semua orang
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const mid = confirmDeleteMsg.id;
                    setConfirmDeleteMsg(null);
                    handleDeleteForMe(mid);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-medium text-white active:scale-95 transition-all cursor-pointer"
                >
                  Hapus untuk saya
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteMsg(null)}
                  className="w-full rounded-xl py-1.5 text-xs text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inspect Reaction Modal Overlay */}
        {inspectReaction && (
          <div className="absolute inset-0 z-40 flex flex-col rounded-2xl bg-zinc-950/95 backdrop-blur-md animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-zinc-900/90">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Reaksi Pesan</span>
                <span className="text-xs text-white/50">
                  ({totalInspectReactions})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectReaction(null)}
                className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                title="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Emoji Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-b border-white/10 bg-zinc-900/40">
              <button
                type="button"
                onClick={() =>
                  setInspectReaction((prev) => (prev ? { ...prev, selectedEmoji: null } : null))
                }
                className={clsx(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors shrink-0",
                  !inspectReaction.selectedEmoji
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                )}
              >
                Semua {totalInspectReactions}
              </button>
              {inspectMessageReactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() =>
                    setInspectReaction((prev) => (prev ? { ...prev, selectedEmoji: r.emoji } : null))
                  }
                  className={clsx(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors shrink-0",
                    inspectReaction.selectedEmoji === r.emoji
                      ? "bg-purple-600 text-white ring-1 ring-purple-400 shadow-sm"
                      : "bg-white/5 text-white/70 hover:bg-white/10"
                  )}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              ))}
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              {inspectUserList.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-xs text-white/40">
                  Tidak ada reaksi
                </div>
              ) : (
                inspectUserList.map((item, idx) => {
                  const profile = userProfiles[item.userId];
                  const isMe = item.userId === userId;
                  const uname = isMe ? `${username} (Anda)` : profile?.username || `User_${item.userId.slice(0, 6)}`;
                  const avatar = isMe ? (userProfiles[userId || ""]?.avatar_url || profile?.avatar_url) : profile?.avatar_url;

                  return (
                    <div
                      key={`${item.userId}-${item.emoji}-${idx}`}
                      className="flex items-center justify-between rounded-xl bg-white/[0.04] hover:bg-white/[0.08] p-2 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ImageWithFallback
                          src={avatar}
                          alt={uname}
                          size={32}
                          className="shrink-0 rounded-full ring-1 ring-white/10"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-white truncate max-w-[170px]">
                            {uname}
                          </div>
                          {isMe && (
                            <button
                              type="button"
                              onClick={() => {
                                onReact(inspectReaction.messageId, item.emoji);
                              }}
                              className="text-[10px] text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                            >
                              Hapus reaksi
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-base shrink-0 select-none pl-2">
                        {item.emoji}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div
          className={clsx(
            "relative h-[380px] overflow-y-auto px-3 py-3 text-sm",
            "bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.10)_0%,_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(59,130,246,0.10)_0%,_transparent_60%),linear-gradient(180deg,_rgba(0,0,0,0.9)_0%,_rgba(0,0,0,0.7)_100%)]"
          )}
        >
          {searchQuery.trim() && visibleMsgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center text-white/50 space-y-2">
              <Search className="h-8 w-8 text-white/25 mb-1" />
              <p className="text-xs font-medium text-white/70">
                Tidak ada pesan untuk &ldquo;{searchQuery}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[11px] text-purple-400 hover:underline cursor-pointer"
              >
                Reset pencarian
              </button>
            </div>
          ) : (
            visibleMsgs.map((m, idx) => {
            const isMine = m.sender_id === activeUserId;
            const isDeletedForEveryone =
              m.content === "__DELETED_FOR_EVERYONE__" ||
              m.content === "Pesan telah dihapus";

            const bubbleClass = isMine
              ? "bg-purple-600 text-white"
              : m.sender_role === "admin"
              ? "bg-zinc-800 text-white"
              : "bg-zinc-900 text-white";

            const reacts = reactionsMap[m.id] || [];

            const senderProfile =
              userProfiles[m.sender_id] ||
              (isMine ? userProfiles[activeUserId || ""] : null);
            const senderAvatar = isMine
              ? userProfiles[activeUserId || ""]?.avatar_url ||
                senderProfile?.avatar_url
              : senderProfile?.avatar_url;
            const senderDisplayName = isMine
              ? activeUsername
              : m.sender_role === "admin"
              ? "Admin"
              : senderProfile?.username ||
                m.sender_name?.trim() ||
                m.sender_id?.slice(0, 8) ||
                "User";

            const prevMsg = idx > 0 ? visibleMsgs[idx - 1] : null;
            const showDateDivider =
              !prevMsg ||
              new Date(m.created_at).toDateString() !==
                new Date(prevMsg.created_at).toDateString();

            return (
              <Fragment key={m.id}>
                {showDateDivider && (
                  <div className="flex justify-center my-3">
                    <span className="px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-medium bg-zinc-800/90 text-zinc-300 border border-white/10 shadow-xs backdrop-blur-md select-none">
                      {getMessageDateGroup(m.created_at)}
                    </span>
                  </div>
                )}
                <div
                  className={clsx(
                    "group relative my-2 flex flex-col",
                    isMine ? "items-end" : "items-start"
                  )}
                >
                {/* Floating Reaction Picker (WhatsApp style - absolute floating above the bubble) */}
                {!isDeletedForEveryone && activeReactMsgId === m.id && (
                  <div
                    className={clsx(
                      "absolute z-30 -top-8 flex items-center gap-1 rounded-full bg-zinc-900/95 border border-white/20 p-1 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95",
                      isMine ? "right-8" : "left-8"
                    )}
                  >
                    {QUICK_REACT.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          onReact(m.id, e);
                          setActiveReactMsgId(null);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/20 hover:scale-125 transition-all text-sm select-none"
                        title={e}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}

                {/* Message Bubble + Avatar Row */}
                <div
                  className={clsx(
                    "flex items-start gap-2 max-w-[88%]",
                    isMine ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <ImageWithFallback
                    src={senderAvatar}
                    alt={senderDisplayName}
                    size={28}
                    className="shrink-0 mt-0.5 rounded-full ring-1 ring-white/10 shadow-sm"
                  />

                  <div className="relative min-w-0">
                    <div
                      className={clsx(
                        "rounded-2xl px-3 py-2 shadow-sm transition-all",
                        isDeletedForEveryone
                          ? "border border-white/10 bg-zinc-900/50 text-white/50"
                          : bubbleClass
                      )}
                    >
                      <div className="text-[11px] opacity-80 mb-1 font-medium flex items-center gap-1.5">
                        <span className="truncate max-w-[140px]">
                          {senderDisplayName}
                        </span>
                        {m.sender_role === "admin" && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 border border-purple-400/30">
                            admin
                          </span>
                        )}
                      </div>

                      {isDeletedForEveryone ? (
                        <div className="flex items-center gap-1.5 py-1 text-xs italic text-white/50 select-none">
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/50">
                            <X className="h-2.5 w-2.5 stroke-[2.5]" />
                          </div>
                          <span>Pesan telah dihapus</span>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}

                      <div
                        className="mt-1 text-[10px] opacity-65 flex items-center gap-1 cursor-default select-none"
                        title={new Date(m.created_at).toLocaleString("id-ID", {
                          dateStyle: "full",
                          timeStyle: "medium",
                        })}
                      >
                        <span>{formatMessageTime(m.created_at)}</span>
                      </div>
                    </div>

                    {/* Existing reaction badges if any */}
                    {!isDeletedForEveryone && reacts.length > 0 && (
                      <div
                        className={clsx(
                          "mt-1 flex flex-wrap gap-1",
                          isMine ? "justify-end" : "justify-start"
                        )}
                      >
                        {reacts.map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            onClick={() => {
                              setInspectReaction({
                                messageId: m.id,
                                selectedEmoji: r.emoji,
                              });
                            }}
                            className={clsx(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border border-white/10 bg-white/5 hover:bg-white/15 transition-colors cursor-pointer",
                              r.reactedByMe && "ring-1 ring-purple-400/60 bg-purple-500/15"
                            )}
                            title="Klik untuk melihat siapa yang bereaksi"
                          >
                            <span>{r.emoji}</span>
                            <span className="font-semibold text-[10px]">
                              {r.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Subtle Action Buttons Below Message (Emot icon, Reply, Delete) - WhatsApp style */}
                {!isDeletedForEveryone && (
                  <div
                    className={clsx(
                      "flex items-center gap-1.5 mt-0.5 px-9 opacity-50 hover:opacity-100 group-hover:opacity-100 transition-opacity",
                      isMine ? "justify-end" : "justify-start"
                    )}
                  >
                    {/* Small emote trigger button */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveReactMsgId((prev) =>
                          prev === m.id ? null : m.id
                        )
                      }
                      title="Beri reaksi emoji"
                      className="flex items-center justify-center h-5 w-5 rounded-full text-white/70 hover:text-yellow-300 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <SmilePlus className="h-3.5 w-3.5" />
                    </button>

                    {/* Small reply button */}
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(m);
                        setOpen(true);
                      }}
                      title="Balas pesan"
                      className="flex items-center justify-center h-5 w-5 rounded-full text-white/70 hover:text-cyan-300 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete button (opens confirmation dialog) */}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteMsg({ id: m.id, isMine })}
                      title="Hapus pesan"
                      className="flex items-center justify-center h-5 w-5 rounded-full text-white/70 hover:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                </div>
              </Fragment>
            );
          })
        )}

          <div ref={bottomRef} />
        </div>

        {typingLine && (
          <div className="px-3 py-1 text-[11px] text-white/60 bg-zinc-950">
            {typingLine}
          </div>
        )}

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
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              className="min-w-0 flex-1 rounded-xl bg-zinc-800 px-3 py-2 text-white outline-none placeholder:text-white/40"
              placeholder="Tulis pesan..."
              value={text}
              onChange={(e) => onTypeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (cooldownLeft <= 0) onSend();
                }
              }}
            />

            <button
              onClick={() => onSend()}
              disabled={cooldownLeft > 0}
              className={clsx(
                "shrink-0 whitespace-nowrap rounded-xl px-3 sm:px-4 py-2 font-medium transition-all text-sm flex items-center justify-center min-w-[64px]",
                cooldownLeft > 0
                  ? "bg-zinc-700/80 text-zinc-400 cursor-not-allowed border border-zinc-600/40"
                  : "bg-purple-600 hover:bg-purple-700 text-white active:scale-95"
              )}
            >
              {cooldownLeft > 0 ? `${cooldownLeft}s` : "Kirim"}
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
