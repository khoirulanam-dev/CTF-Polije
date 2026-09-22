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
    const { newSeasonId } = body

    if (!newSeasonId) {
      return NextResponse.json({ error: 'New Season ID is required' }, { status: 400 })
    }

    // 1. Fetch new season details
    const { data: newSeason, error: newSeasonErr } = await adminClient
      .from('seasons')
      .select('*')
      .eq('id', newSeasonId)
      .single()

    if (newSeasonErr || !newSeason) {
      return NextResponse.json({ error: 'Target season not found' }, { status: 404 })
    }

    if (newSeason.status === 'active') {
      return NextResponse.json({ error: 'Season ini sudah berstatus aktif.' }, { status: 400 })
    }

    // 2. Fetch current active season (if any)
    const { data: currentActiveSeasons } = await adminClient
      .from('seasons')
      .select('*')
      .eq('status', 'active')

    const oldSeason = currentActiveSeasons && currentActiveSeasons.length > 0 ? currentActiveSeasons[0] : null

    // 3. If there is an old active season, create historical snapshot
    if (oldSeason) {
      const nowIso = new Date().toISOString()

      // Fetch challenges for old season (or all challenges if old season is Season 1 and challenges had no season_id)
      const { data: allChallenges } = await adminClient
        .from('challenges')
        .select('id, title, category, points, season_id, is_active')

      const oldSeasonChallenges = (allChallenges || []).filter(
        (c) => c.season_id === oldSeason.id || (oldSeason.number === 1 && !c.season_id)
      )
      const oldSeasonChallengeIds = new Set(oldSeasonChallenges.map((c) => c.id))

      // Fetch solves
      const { data: allSolves } = await adminClient
        .from('solves')
        .select('id, user_id, challenge_id, created_at')
        .order('created_at', { ascending: true })

      // Filter solves for old season
      const seasonSolves = (allSolves || []).filter((s) => oldSeasonChallengeIds.has(s.challenge_id))

      // Fetch users
      const { data: users } = await adminClient
        .from('users')
        .select('id, username, avatar_url')

      // Fetch hint costs
      const { data: hintData } = await adminClient
        .from('unlocked_hints')
        .select('user_id, cost')

      const hintCostMap: Record<string, number> = {}
      if (hintData) {
        for (const h of hintData) {
          hintCostMap[h.user_id] = (hintCostMap[h.user_id] || 0) + (h.cost || 0)
        }
      }

      // Compute user scores and solves count
      const challengePointMap: Record<string, number> = {}
      for (const ch of oldSeasonChallenges) {
        challengePointMap[ch.id] = ch.points || 0
      }

      const userSolvesCount: Record<string, number> = {}
      const userTotalPoints: Record<string, number> = {}
      const userLastSolveTime: Record<string, string> = {}

      for (const s of seasonSolves) {
        userSolvesCount[s.user_id] = (userSolvesCount[s.user_id] || 0) + 1
        const pt = challengePointMap[s.challenge_id] || 0
        userTotalPoints[s.user_id] = (userTotalPoints[s.user_id] || 0) + pt
        userLastSolveTime[s.user_id] = s.created_at
      }

      const topPlayers = (users || [])
        .map((u) => {
          const rawScore = userTotalPoints[u.id] || 0
          const hintCost = hintCostMap[u.id] || 0
          const finalScore = Math.max(0, rawScore - hintCost)
          return {
            user_id: u.id,
            username: u.username,
            score: finalScore,
            total_solves: userSolvesCount[u.id] || 0,
            avatar_url: u.avatar_url,
            last_solve: userLastSolveTime[u.id] || '',
          }
        })
        .filter((u) => u.total_solves > 0 || u.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          if (a.last_solve && b.last_solve) {
            return new Date(a.last_solve).getTime() - new Date(b.last_solve).getTime()
          }
          return a.username.localeCompare(b.username)
        })
        .map((p, idx) => ({
          rank: idx + 1,
          user_id: p.user_id,
          username: p.username,
          score: p.score,
          total_solves: p.total_solves,
          avatar_url: p.avatar_url,
        }))

      // Compute top challenges & first blood
      const userMap = new Map((users || []).map((u) => [u.id, u.username]))
      const challengeSolvesCount: Record<string, number> = {}
      const challengeFirstBlood: Record<string, string> = {}

      for (const s of seasonSolves) {
        challengeSolvesCount[s.challenge_id] = (challengeSolvesCount[s.challenge_id] || 0) + 1
        if (!challengeFirstBlood[s.challenge_id]) {
          challengeFirstBlood[s.challenge_id] = userMap.get(s.user_id) || 'Unknown'
        }
      }

      const topChallenges = oldSeasonChallenges.map((ch) => ({
        id: ch.id,
        title: ch.title,
        category: ch.category,
        points: ch.points,
        solves_count: challengeSolvesCount[ch.id] || 0,
        first_blood_user: challengeFirstBlood[ch.id] || null,
      })).sort((a, b) => b.solves_count - a.solves_count)

      const archiveStats = {
        total_solves: seasonSolves.length,
        total_users: topPlayers.length,
        total_challenges: oldSeasonChallenges.length,
        started_at: oldSeason.started_at,
        ended_at: nowIso,
      }

      // Upsert into season_archives
      try {
        await adminClient.from('season_archives').upsert({
          season_id: oldSeason.id,
          season_number: oldSeason.number,
          season_name: oldSeason.name,
          top_players: topPlayers,
          top_challenges: topChallenges,
          stats: archiveStats,
          created_at: nowIso,
        }, { onConflict: 'season_number' })
      } catch (archiveErr: any) {
        console.error('Error saving season archive:', archiveErr)
      }

      // Update old season to archived
      await adminClient
        .from('seasons')
        .update({
          status: 'archived',
          ended_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', oldSeason.id)
    }

    // 4. Activate new season
    const nowIso = new Date().toISOString()
    const { data: activatedSeason, error: actErr } = await adminClient
      .from('seasons')
      .update({
        status: 'active',
        started_at: newSeason.started_at || nowIso,
        ended_at: null,
        updated_at: nowIso,
      })
      .eq('id', newSeasonId)
      .select()
      .single()

    if (actErr) {
      return NextResponse.json({ error: actErr.message }, { status: 500 })
    }

    // 5. Bersihkan data test solve admin dari masa draft & aktifkan seluruh tantangan season baru
    const { data: newSeasonChalls } = await adminClient
      .from('challenges')
      .select('id')
      .eq('season_id', newSeasonId)

    if (newSeasonChalls && newSeasonChalls.length > 0) {
      const newChallIds = newSeasonChalls.map((c) => c.id)
      await adminClient.from('solves').delete().in('challenge_id', newChallIds)
    }

    await adminClient
      .from('challenges')
      .update({ is_active: true, total_solves: 0 })
      .eq('season_id', newSeasonId)

    // 6. Buat pengumuman broadcast resmi bahwa season baru telah dimulai
    try {
      await adminClient.from('announcements').insert({
        title: `${newSeason.name} Telah Dimulai! 🚀`,
        description: `Musim kompetisi baru telah resmi dibuka. Tantangan baru telah dirilis, selamat berjuang kepada seluruh peserta!`,
        badge: 'SEASON BARU',
        type: 'feature',
        is_active: true,
        link: '/challenges',
      })
    } catch (annErr) {
      console.warn('Could not insert season announcement:', annErr)
    }

    return NextResponse.json({
      success: true,
      message: `Season ${newSeason.number} (${newSeason.name}) berhasil diaktifkan!`,
      activatedSeason,
      archivedSeason: oldSeason ? { id: oldSeason.id, number: oldSeason.number, name: oldSeason.name } : null,
    })
  } catch (err: any) {
    console.error('Error activating season:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
