import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(req: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(req.url)
    const teamId = searchParams.get('team_id')
    const seasonParam = searchParams.get('season_id') // UUID, 'all', or empty
    const period = (searchParams.get('period') || 'all').toLowerCase()

    if (!teamId) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 })
    }

    const client = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : createClient(supabaseUrl, supabaseAnonKey)

    // 1. Fetch team info
    const { data: team, error: teamErr } = await client
      .from('teams')
      .select('id, name, invite_code, is_solo, created_by, created_at')
      .eq('id', teamId)
      .single()

    if (teamErr || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // 2. Fetch members and their profiles
    const { data: membersData, error: memErr } = await client
      .from('team_members')
      .select('user_id, role, joined_at, users(id, username, avatar_url)')
      .eq('team_id', teamId)

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 })
    }

    const membersList = membersData || []
    const memberUserIds = membersList.map((m: any) => m.user_id)
    const userProfileMap = new Map<string, any>(
      membersList.map((m: any) => [m.user_id, m.users])
    )

    // 3. Resolve Season
    let targetSeasonId: string | null = null
    let seasonName = 'All Season'

    if (seasonParam && seasonParam !== 'all') {
      const { data: seasonData } = await client
        .from('seasons')
        .select('id, number, name')
        .or(`id.eq.${seasonParam},number.eq.${parseInt(seasonParam, 10) || -1}`)
        .maybeSingle()

      if (seasonData) {
        targetSeasonId = seasonData.id
        seasonName = seasonData.name
      }
    }

    // 4. Fetch challenges belonging to season
    let challengesQuery = client
      .from('challenges')
      .select('id, title, category, points, season_id')

    if (targetSeasonId) {
      challengesQuery = challengesQuery.eq('season_id', targetSeasonId)
    }

    const { data: challenges, error: challErr } = await challengesQuery
    if (challErr) {
      return NextResponse.json({ error: challErr.message }, { status: 500 })
    }

    const challengeList = challenges || []
    const challMap = new Map(challengeList.map((c) => [c.id, c]))
    const challIds = challengeList.map((c) => c.id)

    // If no challenges in this season or no members in team
    if (challIds.length === 0 || memberUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        team,
        members: membersList.map((m: any) => ({
          user_id: m.user_id,
          username: m.users?.username || 'Unknown',
          avatar_url: m.users?.avatar_url || null,
          role: m.role,
          joined_at: m.joined_at,
          score: 0,
          solves_count: 0,
        })),
        solves: [],
        total_score: 0,
        total_solves: 0,
        season_name: seasonName,
        period,
      })
    }

    // 5. Determine time cutoff
    let periodStart: string | null = null
    const now = new Date()

    if (period === 'today') {
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0))
      periodStart = startOfDay.toISOString()
    } else if (period === 'weekly') {
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      periodStart = startOfWeek.toISOString()
    } else if (period === 'monthly') {
      const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      periodStart = startOfMonth.toISOString()
    }

    // 6. Fetch solves for team members
    let solvesQuery = client
      .from('solves')
      .select('id, user_id, challenge_id, created_at')
      .in('user_id', memberUserIds)
      .in('challenge_id', challIds)
      .order('created_at', { ascending: false })

    if (periodStart) {
      solvesQuery = solvesQuery.gte('created_at', periodStart)
    }

    const { data: solvesData, error: solvesErr } = await solvesQuery
    if (solvesErr) {
      return NextResponse.json({ error: solvesErr.message }, { status: 500 })
    }

    const solves = solvesData || []

    // 7. Fetch hint costs if any
    let hintsQuery = client
      .from('unlocked_hints')
      .select('user_id, cost, challenge_id')
      .in('user_id', memberUserIds)
      .in('challenge_id', challIds)

    const { data: hintsData } = await hintsQuery
    const userHintCosts: Record<string, number> = {}
    for (const h of hintsData || []) {
      userHintCosts[h.user_id] = (userHintCosts[h.user_id] || 0) + (h.cost || 0)
    }

    // 8. Build detailed solves list
    const detailedSolves = solves.map((s) => {
      const c = challMap.get(s.challenge_id)
      const u = userProfileMap.get(s.user_id)
      return {
        id: s.id,
        challenge_id: s.challenge_id,
        challenge_title: c?.title || 'Unknown',
        category: c?.category || 'General',
        points: c?.points || 0,
        solved_at: s.created_at,
        user_id: s.user_id,
        username: u?.username || 'Unknown',
        avatar_url: u?.avatar_url || null,
      }
    })

    // 9. Aggregate per member
    const memberStats = membersList.map((m: any) => {
      const userSolves = detailedSolves.filter((s) => s.user_id === m.user_id)
      const rawScore = userSolves.reduce((sum, s) => sum + s.points, 0)
      const deduction = userHintCosts[m.user_id] || 0
      const netScore = Math.max(0, rawScore - deduction)

      return {
        user_id: m.user_id,
        username: m.users?.username || 'Unknown',
        avatar_url: m.users?.avatar_url || null,
        role: m.role,
        joined_at: m.joined_at,
        score: netScore,
        solves_count: userSolves.length,
      }
    }).sort((a: any, b: any) => b.score - a.score)

    const totalScore = memberStats.reduce((sum: number, m: any) => sum + m.score, 0)

    return NextResponse.json({
      success: true,
      team,
      members: memberStats,
      solves: detailedSolves,
      total_score: totalScore,
      total_solves: detailedSolves.length,
      season_name: seasonName,
      period,
    })
  } catch (err: any) {
    console.error('Error fetching team detail:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
