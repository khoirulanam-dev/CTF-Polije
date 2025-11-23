// src/lib/livechat.ts
import { supabase } from "./supabase";

export type ChatAttachment = {
  url: string;
  name: string;
  size: number;
  mime: string;
  type: "image" | "pdf" | "audio" | "file";
};

export type ChatMessage = {
  id: number;
  room: string;
  sender_id: string;
  sender_role: "user" | "admin";
  sender_name?: string | null;
  content: string;
  created_at: string;

  reply_to_id?: number | null;
  reply_to_name?: string | null;
  reply_to_content?: string | null;

  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
  attachment_mime?: string | null;
  attachment_type?: "image" | "pdf" | "audio" | "file" | null;
};

const ROOM = "global";
const BUCKET = "chat-attachments";

/**
 * Ambil history chat untuk room global.
 */
export async function fetchMessages(room: string = ROOM): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select(
      `
      id,
      room,
      sender_id,
      sender_role,
      sender_name,
      content,
      created_at,
      reply_to_id,
      reply_to_name,
      reply_to_content,
      attachment_url,
      attachment_name,
      attachment_size,
      attachment_mime,
      attachment_type
    `
    )
    .eq("room", room)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("fetchMessages error", error);
    return [];
  }

  return (data || []) as ChatMessage[];
}

export type ReplyMeta =
  | {
      reply_to_id?: number | null;
      reply_to_name?: string | null;
      reply_to_content?: string | null;
    }
  | null;

export type SendOptions =
  | ReplyMeta
  | {
      reply_to_id?: number | null;
      reply_to_name?: string | null;
      reply_to_content?: string | null;
      attachment?: ChatAttachment | null;
    }
  | null;

/**
 * Kirim pesan baru (support reply + attachment).
 */
export async function sendMessage(
  sender_id: string,
  sender_role: "user" | "admin",
  sender_name: string,
  content: string,
  opts?: SendOptions,
  room: string = ROOM
): Promise<void> {
  const payload: any = {
    room,
    sender_id,
    sender_role,
    sender_name,
    content,
  };

  if (opts && "reply_to_id" in opts) {
    payload.reply_to_id = opts.reply_to_id ?? null;
    payload.reply_to_name = opts.reply_to_name ?? null;
    payload.reply_to_content = opts.reply_to_content ?? null;
  }

  if (opts && "attachment" in opts && opts.attachment) {
    payload.attachment_url = opts.attachment.url;
    payload.attachment_name = opts.attachment.name;
    payload.attachment_size = opts.attachment.size;
    payload.attachment_mime = opts.attachment.mime;
    payload.attachment_type = opts.attachment.type;
  }

  const { error } = await supabase.from("chat_messages").insert(payload);

  if (error) {
    console.error("sendMessage error", error);
    throw error;
  }
}

/**
 * Toggle reaction emoji (like/unlike).
 */
export async function toggleReaction(
  message_id: number,
  emoji: string,
  user_id: string
): Promise<{ reacted: boolean }> {
  const { data: exist, error: existErr } = await supabase
    .from("chat_reactions")
    .select("id")
    .eq("message_id", message_id)
    .eq("user_id", user_id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existErr) throw existErr;

  if (exist?.id) {
    const { error } = await supabase
      .from("chat_reactions")
      .delete()
      .eq("id", exist.id);

    if (error) throw error;
    return { reacted: false };
  }

  const { error } = await supabase
    .from("chat_reactions")
    .insert({ message_id, user_id, emoji });

  if (error) throw error;
  return { reacted: true };
}

/**
 * Ambil semua reactions untuk sekumpulan message id.
 */
export async function fetchReactions(messageIds: number[]) {
  if (!messageIds.length) return [];

  const { data, error } = await supabase
    .from("chat_reactions")
    .select("id, message_id, user_id, emoji, created_at")
    .in("message_id", messageIds);

  if (error) throw error;
  return data || [];
}

/**
 * Upload attachment aman (gambar/pdf/audio).
 * - block svg/executable/script
 * - allowlist MIME
 * - size limit
 */
export async function uploadAttachment(
  file: File,
  user_id: string,
  room: string = ROOM
): Promise<ChatAttachment> {
  const MAX_MB = 8;
  const maxBytes = MAX_MB * 1024 * 1024;

  const mime = file.type || "";
  const name = file.name || "file";
  const size = file.size;

  if (size > maxBytes) {
    throw new Error(`File terlalu besar. Max ${MAX_MB}MB`);
  }

  const blockedExt = [
    ".svg",
    ".exe",
    ".dll",
    ".bat",
    ".sh",
    ".js",
    ".php",
    ".py",
    ".jar",
    ".com",
    ".msi",
    ".cmd",
  ];
  const lowerName = name.toLowerCase();
  if (blockedExt.some((ext) => lowerName.endsWith(ext))) {
    throw new Error("Tipe file tidak diizinkan.");
  }

  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const isAudio =
    mime.startsWith("audio/") || mime === "audio/webm" || mime === "audio/ogg";

  if (!isImage && !isPdf && !isAudio) {
    throw new Error("Hanya boleh upload gambar, pdf, atau audio.");
  }

  const type: ChatAttachment["type"] = isImage
    ? "image"
    : isPdf
    ? "pdf"
    : "audio";

  const ext = lowerName.split(".").pop() || "bin";
  const path = `${room}/${user_id}/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: mime,
    });

  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    url: pub.publicUrl,
    name,
    size,
    mime,
    type,
  };
}
