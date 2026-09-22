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

export async function GET(req: Request) {
  try {
    const adminCheck = await verifyAdmin(req)
    if (!adminCheck.authorized || !adminCheck.adminClient) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const { adminClient } = adminCheck

    // Query seasons
    const { data: seasons, error: seasonsError } = await adminClient
      .from('seasons')
      .select('*')
      .order('number', { ascending: true })

    if (seasonsError) {
      if (seasonsError.code === 'PGRST204' || seasonsError.message?.includes('does not exist') || seasonsError.message?.includes('schema cache')) {
        return NextResponse.json({
          table_missing: true,
          message: 'Tabel public.seasons belum dibuat di database Supabase.',
          seasons: [],
          activeSeason: null,
        })
      }
      return NextResponse.json({ error: seasonsError.message }, { status: 500 })
    }

    // Query challenge count per season
    const { data: challenges, error: chalErr } = await adminClient
      .from('challenges')
      .select('id, season_id, is_active')

    const challengeCountMap: Record<string, { total: number; active: number }> = {}
    if (challenges) {
      for (const ch of challenges) {
        const sId = ch.season_id || 'unassigned'
        if (!challengeCountMap[sId]) {
          challengeCountMap[sId] = { total: 0, active: 0 }
        }
        challengeCountMap[sId].total++
        if (ch.is_active) challengeCountMap[sId].active++
      }
    }

    const seasonsWithCounts = (seasons || []).map((s) => ({
      ...s,
      challenge_count: challengeCountMap[s.id]?.total || 0,
      active_challenge_count: challengeCountMap[s.id]?.active || 0,
    }))

    const activeSeason = seasonsWithCounts.find((s) => s.status === 'active') || null

    return NextResponse.json({
      table_missing: false,
      seasons: seasonsWithCounts,
      activeSeason,
      unassigned_challenges: challengeCountMap['unassigned']?.total || 0,
    })
  } catch (err: any) {
    console.error('Error fetching admin seasons:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const adminCheck = await verifyAdmin(req)
    if (!adminCheck.authorized || !adminCheck.adminClient) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const { adminClient } = adminCheck
    const body = await req.json()
    const { number, name, description } = body

    if (!name || typeof number !== 'number') {
      return NextResponse.json({ error: 'Name and Season Number are required' }, { status: 400 })
    }

    const { data: newSeason, error: insertErr } = await adminClient
      .from('seasons')
      .insert({
        number,
        name: name.trim(),
        description: description?.trim() || null,
        status: 'draft',
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, season: newSeason })
  } catch (err: any) {
    console.error('Error creating season:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const adminCheck = await verifyAdmin(req)
    if (!adminCheck.authorized || !adminCheck.adminClient) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const { adminClient } = adminCheck
    const body = await req.json()
    const { id, name, description } = body

    if (!id || !name) {
      return NextResponse.json({ error: 'Season ID and Name are required' }, { status: 400 })
    }

    const { data: updated, error: updateErr } = await adminClient
      .from('seasons')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, season: updated })
  } catch (err: any) {
    console.error('Error updating season:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const adminCheck = await verifyAdmin(req)
    if (!adminCheck.authorized || !adminCheck.adminClient) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const { adminClient } = adminCheck
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Season ID is required' }, { status: 400 })
    }

    // Check if season is active
    const { data: season, error: checkErr } = await adminClient
      .from('seasons')
      .select('*')
      .eq('id', id)
      .single()

    if (checkErr || !season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 })
    }

    if (season.status === 'active') {
      return NextResponse.json({ error: 'Tidak dapat menghapus Season yang sedang aktif.' }, { status: 400 })
    }

    const { error: delErr } = await adminClient
      .from('seasons')
      .delete()
      .eq('id', id)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Season berhasil dihapus' })
  } catch (err: any) {
    console.error('Error deleting season:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
