// src/lib/livechat.ts
import { supabase } from "@/lib/supabase";

export async function fetchMessages() {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, room, sender_id, sender_role, sender_name, content, created_at")
    .eq("room", "global")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(
  sender_id: string,
  sender_role: "user" | "admin",
  sender_name: string,
  content: string
) {
  const { error } = await supabase.from("chat_messages").insert({
    room: "global",
    sender_id,
    sender_role,
    sender_name,
    content,
  });

  if (error) throw error;
}
