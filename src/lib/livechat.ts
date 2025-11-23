import { supabase } from "./supabase";

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
};

const ROOM = "global";

/**
 * Ambil history chat untuk room global.
 */
export async function fetchMessages(): Promise<ChatMessage[]> {
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
      reply_to_content
    `
    )
    .eq("room", ROOM)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    console.error("fetchMessages error", error);
    return [];
  }

  return (data || []) as ChatMessage[];
}

type ReplyMeta =
  | {
      reply_to_id?: number | null;
      reply_to_name?: string | null;
      reply_to_content?: string | null;
    }
  | null;

/**
 * Kirim pesan baru (support reply).
 */
export async function sendMessage(
  sender_id: string,
  sender_role: "user" | "admin",
  sender_name: string,
  content: string,
  reply?: ReplyMeta
): Promise<void> {
  const payload: any = {
    room: ROOM,
    sender_id,
    sender_role,
    sender_name,
    content,
  };

  if (reply) {
    payload.reply_to_id = reply.reply_to_id ?? null;
    payload.reply_to_name = reply.reply_to_name ?? null;
    payload.reply_to_content = reply.reply_to_content ?? null;
  }

  const { error } = await supabase.from("chat_messages").insert(payload);

  if (error) {
    console.error("sendMessage error", error);
    throw error;
  }
}
