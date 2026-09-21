import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: missing token' }, { status: 401 })
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Unauthorized: invalid token' }, { status: 401 })
    }

    const userId = authData.user.id

    const body = await req.json()
    const { messageId } = body
    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Check message and user admin status
    const [{ data: msg, error: msgErr }, { data: userProfile }] = await Promise.all([
      adminClient.from('chat_messages').select('*').eq('id', messageId).single(),
      adminClient.from('users').select('is_admin').eq('id', userId).single(),
    ])

    if (msgErr || !msg) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    const isSender = msg.sender_id === userId

    if (!isSender) {
      return NextResponse.json(
        { error: 'Forbidden: Anda hanya dapat menghapus pesan Anda sendiri untuk semua orang' },
        { status: 403 }
      )
    }

    // Update message to deleted placeholder and clear all attachments
    const { error: updateErr } = await adminClient
      .from('chat_messages')
      .update({
        content: '__DELETED_FOR_EVERYONE__',
        attachment_url: null,
        attachment_name: null,
        attachment_size: null,
        attachment_mime: null,
        attachment_type: null,
      })
      .eq('id', messageId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Remove reactions for this deleted message
    await adminClient.from('chat_reactions').delete().eq('message_id', messageId)

    return NextResponse.json({ success: true, messageId })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
