import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  if (!token) return { authorized: false, error: 'Unauthorized: missing token' }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data: authData, error: authError } = await authClient.auth.getUser(token)
  if (authError || !authData?.user) {
    return { authorized: false, error: 'Unauthorized: invalid token' }
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey)
  const { data: userProfile, error: profileErr } = await adminClient
    .from('users')
    .select('is_admin')
    .eq('id', authData.user.id)
    .single()

  if (profileErr || !userProfile?.is_admin) {
    return { authorized: false, error: 'Forbidden: Admin access required' }
  }

  return { authorized: true, userId: authData.user.id, adminClient }
}

export async function POST(req: Request) {
  try {
    const adminCheck = await verifyAdmin(req)
    if (!adminCheck.authorized || !adminCheck.adminClient) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const { adminClient } = adminCheck
    const body = await req.json()
    const { challengeId, seasonId, isActive, author, createdBy } = body

    if (!challengeId) {
      return NextResponse.json({ error: 'challengeId is required' }, { status: 400 })
    }

    const updatePayload: any = { updated_at: new Date().toISOString() }
    if (seasonId !== undefined) {
      updatePayload.season_id = seasonId === 'unassigned' || !seasonId ? null : seasonId
    }
    if (isActive !== undefined) {
      updatePayload.is_active = Boolean(isActive)
    }
    if (author !== undefined) {
      updatePayload.author = author
    }
    if (createdBy !== undefined) {
      updatePayload.created_by = createdBy
    }

    let { data, error } = await adminClient
      .from('challenges')
      .update(updatePayload)
      .eq('id', challengeId)
      .select()
      .single()

    if (error && (error.message?.includes('author') || error.message?.includes('created_by'))) {
      delete updatePayload.author
      delete updatePayload.created_by
      const retry = await adminClient
        .from('challenges')
        .update(updatePayload)
        .eq('id', challengeId)
        .select()
        .single()
      data = retry.data
      error = retry.error
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, challenge: data })
  } catch (err: any) {
    console.error('Error updating challenge season:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
