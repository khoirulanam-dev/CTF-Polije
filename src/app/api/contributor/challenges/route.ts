import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { validateAttachments } from '@/lib/safe-url'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function verifyContributor(req: Request) {
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
    .select('id, username, is_admin, role')
    .eq('id', authData.user.id)
    .single()

  const isContrib = (userProfile?.role === 'contributor') && !userProfile?.is_admin

  if (profileErr || !isContrib) {
    return { authorized: false, error: 'Forbidden: Khusus untuk akun dengan role Kontributor' }
  }

  return { authorized: true, user: userProfile, userId: authData.user.id, adminClient }
}

// GET: Ambil daftar soal yang dibuat oleh kontributor ini
export async function GET(req: Request) {
  try {
    const auth = await verifyContributor(req)
    if (!auth.authorized || !auth.adminClient || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const { adminClient, userId } = auth

    // Ownership is an immutable UUID relation, never a display-name match.
    const { data: challenges, error } = await adminClient
      .from('challenges')
      .select('*, seasons(id, number, name, status)')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const myChallenges = challenges || []

    // Ambil flag untuk masing-masing soal buatan mereka
    const challengeIds = myChallenges.map(c => c.id)
    let flagsMap: Record<string, string> = {}
    if (challengeIds.length > 0) {
      const { data: flags } = await adminClient
        .from('challenge_flags')
        .select('challenge_id, flag')
        .in('challenge_id', challengeIds)

      if (flags) {
        flags.forEach(f => {
          flagsMap[f.challenge_id] = f.flag
        })
      }
    }

    const enriched = myChallenges.map(c => ({
      ...c,
      flag: flagsMap[c.id] || '',
    }))

    return NextResponse.json({ success: true, challenges: enriched })
  } catch (err: any) {
    console.error('Error fetching contributor challenges:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// POST: Buat soal baru
export async function POST(req: Request) {
  try {
    const auth = await verifyContributor(req)
    if (!auth.authorized || !auth.adminClient || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const { adminClient, user, userId } = auth
    const body = await req.json()

    const {
      title,
      description,
      category,
      points,
      max_points,
      difficulty,
      hint,
      attachments,
      is_dynamic,
      min_points,
      decay_per_solve,
      season_id,
      flag,
    } = body

    if (!title || !description || !category || points === undefined || !flag) {
      return NextResponse.json({ error: 'Data wajib belum lengkap (title, description, category, points, flag)' }, { status: 400 })
    }

    const attachmentError = validateAttachments(attachments)
    if (attachmentError) {
      return NextResponse.json({ error: attachmentError }, { status: 400 })
    }

    // 1. Validasi format Flag POLIJE{.......}
    const cleanFlag = flag.trim()
    const flagPattern = /^POLIJE\{[ -~]+\}$/
    if (!flagPattern.test(cleanFlag)) {
      return NextResponse.json({ 
        error: 'Format flag tidak valid! Format wajib menggunakan: POLIJE{.......}' 
      }, { status: 400 })
    }

    // 2. Season wajib dipilih dan harus aktif atau draft.
    if (!season_id || season_id === 'none') {
      return NextResponse.json({ error: 'Target Season wajib dipilih.' }, { status: 400 })
    }

    const { data: season, error: seasonErr } = await adminClient
      .from('seasons')
      .select('id, number, name, status')
      .eq('id', season_id)
      .single()

    if (seasonErr || !season) {
      return NextResponse.json({ error: 'Target Season tidak ditemukan' }, { status: 400 })
    }

    if (season.status === 'archived') {
      return NextResponse.json({
        error: `Season #${season.number} (${season.name}) telah berakhir. Kontributor tidak dapat menambahkan soal ke season yang telah selesai.`
      }, { status: 400 })
    }

    // Siapkan hash flag
    const flagHash = crypto.createHash('sha256').update(cleanFlag).digest('hex')

    // Siapkan payload challenge
    const insertPayload: any = {
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      points: Number(points) || 100,
      max_points: max_points ? Number(max_points) : (is_dynamic ? Number(points) : null),
      difficulty: difficulty || 'Medium',
      hint: hint && hint.length > 0 ? hint : null,
      attachments: attachments || [],
      is_dynamic: Boolean(is_dynamic),
      min_points: min_points ? Number(min_points) : 0,
      decay_per_solve: decay_per_solve ? Number(decay_per_solve) : 0,
      season_id,
      is_active: true,
      total_solves: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: user.username,
      created_by: userId,
    }

    let insertedChallenge: any = null
    const { data, error } = await adminClient
      .from('challenges')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      insertedChallenge = data
    }

    // 3. Simpan Flag ke challenge_flags
    if (insertedChallenge?.id) {
      const { error: flagErr } = await adminClient
        .from('challenge_flags')
        .insert({
          challenge_id: insertedChallenge.id,
          flag: cleanFlag,
          flag_hash: flagHash,
        })

      if (flagErr) {
        console.error('Error inserting challenge flag:', flagErr)
      }
    }

    return NextResponse.json({ success: true, challenge: insertedChallenge })
  } catch (err: any) {
    console.error('Error creating contributor challenge:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT: Edit soal milik sendiri
export async function PUT(req: Request) {
  try {
    const auth = await verifyContributor(req)
    if (!auth.authorized || !auth.adminClient || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const { adminClient, userId } = auth
    const body = await req.json()
    const { challengeId, ...updates } = body

    if (!challengeId) {
      return NextResponse.json({ error: 'challengeId is required' }, { status: 400 })
    }

    // Pastikan challenge ini milik user (atau user admin)
    const { data: existing, error: existErr } = await adminClient
      .from('challenges')
      .select('id, created_by, season_id')
      .eq('id', challengeId)
      .single()

    if (existErr || !existing) {
      return NextResponse.json({ error: 'Challenge tidak ditemukan' }, { status: 404 })
    }

    const isOwner = existing.created_by === userId

    if (!isOwner) {
      return NextResponse.json({ error: 'Anda hanya dapat mengubah soal yang Anda buat sendiri' }, { status: 403 })
    }

    // Setiap soal wajib tetap memiliki season aktif atau draft.
    const nextSeasonId = updates.season_id ?? existing.season_id
    if (!nextSeasonId || nextSeasonId === 'none') {
      return NextResponse.json({ error: 'Target Season wajib dipilih.' }, { status: 400 })
    }

    const { data: season } = await adminClient
      .from('seasons')
      .select('id, number, name, status')
      .eq('id', nextSeasonId)
      .single()

    if (!season) {
      return NextResponse.json({ error: 'Target Season tidak ditemukan.' }, { status: 400 })
    }

    if (season.status === 'archived') {
      return NextResponse.json({
        error: `Season #${season.number} telah berakhir. Kontributor tidak dapat memindahkan soal ke season yang telah selesai.`
      }, { status: 400 })
    }

    if (updates.attachments !== undefined) {
      const attachmentError = validateAttachments(updates.attachments)
      if (attachmentError) {
        return NextResponse.json({ error: attachmentError }, { status: 400 })
      }
    }

    // Validasi flag jika diubah
    let cleanFlag: string | null = null
    if (updates.flag && typeof updates.flag === 'string' && updates.flag.trim()) {
      const trimmedFlag = updates.flag.trim()
      const flagPattern = /^POLIJE\{[ -~]+\}$/
      if (!flagPattern.test(trimmedFlag)) {
        return NextResponse.json({ 
          error: 'Format flag tidak valid! Format wajib menggunakan: POLIJE{.......}' 
        }, { status: 400 })
      }
      cleanFlag = trimmedFlag
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    }

    if (updates.title) updatePayload.title = updates.title.trim()
    if (updates.description) updatePayload.description = updates.description.trim()
    if (updates.category) updatePayload.category = updates.category.trim()
    if (updates.points !== undefined) updatePayload.points = Number(updates.points)
    if (updates.max_points !== undefined) updatePayload.max_points = Number(updates.max_points)
    if (updates.difficulty) updatePayload.difficulty = updates.difficulty
    if (updates.hint !== undefined) updatePayload.hint = updates.hint
    if (updates.attachments !== undefined) updatePayload.attachments = updates.attachments
    if (updates.is_dynamic !== undefined) updatePayload.is_dynamic = Boolean(updates.is_dynamic)
    if (updates.min_points !== undefined) updatePayload.min_points = Number(updates.min_points)
    if (updates.decay_per_solve !== undefined) updatePayload.decay_per_solve = Number(updates.decay_per_solve)
    if (updates.season_id !== undefined) updatePayload.season_id = nextSeasonId

    const { data: updated, error: updateErr } = await adminClient
      .from('challenges')
      .update(updatePayload)
      .eq('id', challengeId)
      .select()
      .single()

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Update flag jika ada perubahan
    if (cleanFlag) {
      const flagHash = crypto.createHash('sha256').update(cleanFlag).digest('hex')
      await adminClient
        .from('challenge_flags')
        .upsert({
          challenge_id: challengeId,
          flag: cleanFlag,
          flag_hash: flagHash,
        })
    }

    return NextResponse.json({ success: true, challenge: updated })
  } catch (err: any) {
    console.error('Error updating contributor challenge:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Hapus soal buatan sendiri
export async function DELETE(req: Request) {
  try {
    const auth = await verifyContributor(req)
    if (!auth.authorized || !auth.adminClient || !auth.user) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const { adminClient, userId } = auth
    const { searchParams } = new URL(req.url)
    const challengeId = searchParams.get('id')

    if (!challengeId) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 })
    }

    const { data: existing, error: existErr } = await adminClient
      .from('challenges')
      .select('id, created_by')
      .eq('id', challengeId)
      .single()

    if (existErr || !existing) {
      return NextResponse.json({ error: 'Challenge tidak ditemukan' }, { status: 404 })
    }

    const isOwner = existing.created_by === userId

    if (!isOwner) {
      return NextResponse.json({ error: 'Anda hanya dapat menghapus soal yang Anda buat sendiri' }, { status: 403 })
    }

    // Hapus flags dulu
    await adminClient.from('challenge_flags').delete().eq('challenge_id', challengeId)
    // Hapus solves & hints jika ada
    await adminClient.from('solves').delete().eq('challenge_id', challengeId)
    // Hapus challenge
    const { error: delErr } = await adminClient.from('challenges').delete().eq('id', challengeId)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error deleting contributor challenge:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
