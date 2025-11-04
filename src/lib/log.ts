// src/lib/log.ts
import { supabase } from "./supabase"

export interface AuditLogPayload {
  action: string
  actor_id: string | null
  log_type: string
  actor_username?: string | null
  actor_via_sso?: boolean
  traits?: {
    provider?: string
    user_id?: string
    user_email?: string
    user_phone?: string
  }
}

export interface AuditLogEntry {
  id: string
  created_at: string
  instance_id: string
  ip_address: string | null
  payload: AuditLogPayload
}

export async function getAuditLogs(
  limit = 50,
  offset = 0
): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabase.rpc("get_auth_audit_logs", {
      p_limit: limit,
      p_offset: offset,
    })

    if (error) {
      console.error("Error fetching audit logs:", error)
      return []
    }

    return (data ?? []) as AuditLogEntry[]
  } catch (err) {
    console.error("Error fetching audit logs:", err)
    return []
  }
}
