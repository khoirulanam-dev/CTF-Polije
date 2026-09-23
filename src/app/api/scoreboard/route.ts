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
    const seasonParam = searchParams.get('season_id') // UUID, 'all', or empty (default to active)
    const period = (searchParams.get('period') || 'all').toLowerCase()
    const mode = (searchParams.get('mode') || 'users').toLowerCase()
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 1000)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)

    const client = supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : createClient(supabaseUrl, supabaseAnonKey)

    // 1. Resolve Target Season
    const { data: allSeasons } = await client
      .from('seasons')
      .select('id, number, name, status, started_at, ended_at')
      .order('number', { ascending: false })

    const seasonsList = allSeasons || []
    const activeSeason = seasonsList.find((s) => s.status === 'active') || null

    let targetSeasonId: string | null = null
    let targetSeason: any = null

    if (seasonParam === 'all') {
      targetSeasonId = null // indicates all seasons
      targetSeason = null
    } else if (seasonParam) {
      // Find by id or number
      targetSeason = seasonsList.find((s) => s.id === seasonParam || String(s.number) === seasonParam) || null
      targetSeasonId = targetSeason ? targetSeason.id : seasonParam
    } else {
      // Default to active season if exists, else latest, else null
      targetSeason = activeSeason || (seasonsList.length > 0 ? seasonsList[0] : null)
      targetSeasonId = targetSeason ? targetSeason.id : null
    }

    // 2. Fetch challenges belonging to the season (or all challenges if targetSeasonId is null)
    let challengesQuery = client
      .from('challenges')
      .select('id, title, category, points, season_id, is_active')

    if (targetSeasonId) {
      challengesQuery = challengesQuery.eq('season_id', targetSeasonId)
    }

    const { data: challenges, error: challErr } = await challengesQuery
    if (challErr) {
      return NextResponse.json({ error: challErr.message }, { status: 500 })
    }

    const challengeList = challenges || []
    const challMap = new Map(challengeList.map((c) => [c.id, c.points || 0]))
    const challIds = challengeList.map((c) => c.id)

    // If no challenges found for this season, return empty leaderboard early
    if (challIds.length === 0) {
      return NextResponse.json({
        leaderboard: [],
        teamLeaderboard: [],
        season: targetSeason,
        period,
        mode,
      })
    }

    // 3. Determine time cutoff based on period
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

    // 4. Fetch Solves for these challenges
    let solvesQuery = client
      .from('solves')
      .select('id, user_id, challenge_id, created_at')
      .in('challenge_id', challIds)
      .order('created_at', { ascending: true })

    if (periodStart) {
      solvesQuery = solvesQuery.gte('created_at', periodStart)
    }

    const { data: solvesData, error: solvesErr } = await solvesQuery
    if (solvesErr) {
      return NextResponse.json({ error: solvesErr.message }, { status: 500 })
    }
    const solves = solvesData || []

    // 5. Fetch hint deductions for these challenges
    let hintsQuery = client
      .from('unlocked_hints')
      .select('user_id, cost, challenge_id')
      .in('challenge_id', challIds)

    const { data: hintsData } = await hintsQuery
    const userHintCosts: Record<string, number> = {}
    for (const h of hintsData || []) {
      userHintCosts[h.user_id] = (userHintCosts[h.user_id] || 0) + (h.cost || 0)
    }

    // 6. Handle MODE = TEAMS
    if (mode === 'teams') {
      const { data: teamsData } = await client.from('teams').select('id, name')
      const { data: teamMembersData } = await client.from('team_members').select('team_id, user_id')

      const userToTeam = new Map<string, string>()
      const teamMemberCounts: Record<string, number> = {}

      for (const tm of teamMembersData || []) {
        userToTeam.set(tm.user_id, tm.team_id)
        teamMemberCounts[tm.team_id] = (teamMemberCounts[tm.team_id] || 0) + 1
      }

      const teamStats: Record<string, {
        team_id: string
        team_name: string
        member_count: number
        score: number
        last_solve: string | null
      }> = {}

      for (const t of teamsData || []) {
        teamStats[t.id] = {
          team_id: t.id,
          team_name: t.name,
          member_count: teamMemberCounts[t.id] || 0,
          score: 0,
          last_solve: null,
        }
      }

      // Hint deductions per team
      const teamHintCosts: Record<string, number> = {}
      for (const h of hintsData || []) {
        const tid = userToTeam.get(h.user_id)
        if (tid) {
          teamHintCosts[tid] = (teamHintCosts[tid] || 0) + (h.cost || 0)
        }
      }

      // Accumulate team points
      for (const s of solves) {
        const tid = userToTeam.get(s.user_id)
        if (!tid || !teamStats[tid]) continue

        const pts = challMap.get(s.challenge_id) || 0
        teamStats[tid].score += pts
        if (!teamStats[tid].last_solve || new Date(s.created_at) > new Date(teamStats[tid].last_solve!)) {
          teamStats[tid].last_solve = s.created_at
        }
      }

      // Deduct hints
      for (const tid of Object.keys(teamStats)) {
        teamStats[tid].score = Math.max(0, teamStats[tid].score - (teamHintCosts[tid] || 0))
      }

      const rankedTeams = Object.values(teamStats)
        .filter((t) => t.score > 0 || period === 'all')
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          if (a.last_solve && b.last_solve) {
            return new Date(a.last_solve).getTime() - new Date(b.last_solve).getTime()
          }
          if (a.last_solve) return -1
          if (b.last_solve) return 1
          return a.team_name.localeCompare(b.team_name)
        })
        .map((t, idx) => ({
          ...t,
          rank: idx + 1,
        }))
        .slice(offset, offset + limit)

      return NextResponse.json({
        teamLeaderboard: rankedTeams,
        leaderboard: [],
        season: targetSeason,
        period,
        mode,
      })
    }

    // 7. Handle MODE = USERS
    const userStats: Record<string, {
      score: number
      solvesCount: number
      lastSolve: string | null
    }> = {}

    // Timeline progress per user for ScoreboardChart
    const userProgressMap: Record<string, { date: string; score: number }[]> = {}

    for (const s of solves) {
      if (!userStats[s.user_id]) {
        userStats[s.user_id] = {
          score: 0,
          solvesCount: 0,
          lastSolve: s.created_at,
        }
        userProgressMap[s.user_id] = []
      }

      const pts = challMap.get(s.challenge_id) || 0
      userStats[s.user_id].score += pts
      userStats[s.user_id].solvesCount += 1
      if (!userStats[s.user_id].lastSolve || new Date(s.created_at) > new Date(userStats[s.user_id].lastSolve!)) {
        userStats[s.user_id].lastSolve = s.created_at
      }

      userProgressMap[s.user_id].push({
        date: s.created_at,
        score: userStats[s.user_id].score,
      })
    }

    // Deduct hint costs
    for (const uid of Object.keys(userStats)) {
      const deduction = userHintCosts[uid] || 0
      userStats[uid].score = Math.max(0, userStats[uid].score - deduction)

      // Adjust last entry in progress if hint deduction applies
      if (deduction > 0 && userProgressMap[uid]?.length > 0) {
        const lastP = userProgressMap[uid][userProgressMap[uid].length - 1]
        lastP.score = Math.max(0, lastP.score - deduction)
      }
    }

    const participatingUserIds = Object.keys(userStats)
    if (participatingUserIds.length === 0) {
      return NextResponse.json({
        leaderboard: [],
        teamLeaderboard: [],
        season: targetSeason,
        period,
        mode,
      })
    }

    // Fetch user details for participating users
    const { data: usersData } = await client
      .from('users')
      .select('id, username, avatar_url')
      .in('id', participatingUserIds)

    const userDetailsMap = new Map((usersData || []).map((u) => [u.id, u]))

    const sortedUsers = participatingUserIds
      .map((uid) => {
        const u = userDetailsMap.get(uid)
        return {
          id: uid,
          username: u?.username || 'Unknown',
          score: userStats[uid].score,
          solvesCount: userStats[uid].solvesCount,
          last_solve: userStats[uid].lastSolve,
          picture: u?.avatar_url || null,
          progress: userProgressMap[uid] || [],
        }
      })
      .filter((u) => u.score > 0 || period === 'all')
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.last_solve && b.last_solve) {
          return new Date(a.last_solve).getTime() - new Date(b.last_solve).getTime()
        }
        return a.username.localeCompare(b.username)
      })

    const rankedUsers = sortedUsers.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }))

    const pagedUsers = rankedUsers.slice(offset, offset + limit)

    return NextResponse.json({
      leaderboard: pagedUsers,
      totalCount: rankedUsers.length,
      season: targetSeason,
      period,
      mode,
    })
  } catch (err: any) {
    console.error('Error calculating scoreboard:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
