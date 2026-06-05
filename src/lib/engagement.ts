import { supabase } from './supabase'

export type LeaderboardPeriod = 'today' | 'weekly' | 'monthly' | 'all' | 'event'

export type TeamMember = {
  user_id: string
  username: string
  role: 'owner' | 'member'
  joined_at: string
  score: number
  solves: number
}

export type MyTeam = {
  id: string
  name: string
  invite_code: string
  is_solo: boolean
  created_by: string | null
  created_at: string
  my_role?: 'owner' | 'member'
}

export type TeamSolve = {
  username: string
  challenge_id: string
  challenge_title: string
  category: string
  points: number
  solved_at: string
}

export type TeamLeaderboardEntry = {
  team_id: string
  team_name: string
  is_solo?: boolean
  member_count: number
  score: number
  last_solve: string | null
  rank: number
}

export type ActivityFeedItem = {
  activity_type: 'solve' | 'first_blood' | 'new_challenge' | 'team_join'
  user_id: string | null
  username: string | null
  challenge_id: string | null
  challenge_title: string | null
  category: string | null
  points: number | null
  team_id: string | null
  team_name: string | null
  created_at: string
}

export type EventSettings = {
  event_name: string
  is_enabled: boolean
  starts_at: string | null
  ends_at: string | null
  freeze_scoreboard: boolean
  freeze_at: string | null
  updated_at: string
}

export type CategoryProgress = {
  category: string
  total_challenges: number
  solved_challenges: number
  solved_points: number
  percentage: number
}

export async function getScopedLeaderboard(period: LeaderboardPeriod = 'all', limit = 100, offset = 0) {
  const { data, error } = await supabase.rpc('get_leaderboard_scoped', {
    p_period: period,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return data || []
}

export async function getTeamLeaderboard(period: LeaderboardPeriod = 'all', limit = 100, offset = 0): Promise<TeamLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_team_leaderboard', {
    p_period: period,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return (data || []) as TeamLeaderboardEntry[]
}

export async function createTeam(name: string, isSolo = false) {
  const { data, error } = await supabase.rpc('create_team', {
    p_name: name,
    p_is_solo: isSolo,
  })
  if (error) throw error
  return data as { success: boolean; message?: string; team_id?: string; invite_code?: string }
}

export async function joinTeam(inviteCode: string) {
  const { data, error } = await supabase.rpc('join_team', {
    p_invite_code: inviteCode,
  })
  if (error) throw error
  return data as { success: boolean; message?: string; team_id?: string }
}

export async function leaveTeam() {
  const { data, error } = await supabase.rpc('leave_team')
  if (error) throw error
  return data as { success: boolean; message?: string }
}

export async function getMyTeam(): Promise<{ team: MyTeam | null; members: TeamMember[] }> {
  const { data, error } = await supabase.rpc('get_my_team')
  if (error) throw error
  if (!data?.success) return { team: null, members: [] }
  return {
    team: data.team || null,
    members: data.members || [],
  }
}

export async function getTeamDetail(teamId: string): Promise<{ team: MyTeam | null; members: TeamMember[]; recent_solves: TeamSolve[] }> {
  const { data, error } = await supabase.rpc('get_team_detail', {
    p_team_id: teamId,
  })
  if (error) throw error
  if (!data?.success) return { team: null, members: [], recent_solves: [] }
  return {
    team: data.team || null,
    members: data.members || [],
    recent_solves: data.recent_solves || [],
  }
}

export async function getActivityFeed(limit = 50, offset = 0): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase.rpc('get_activity_feed', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return (data || []) as ActivityFeedItem[]
}

export async function getEventSettings(): Promise<EventSettings | null> {
  const { data, error } = await supabase.rpc('get_event_settings')
  if (error) throw error
  return data?.event || null
}

export async function updateEventSettings(settings: {
  event_name: string
  is_enabled: boolean
  starts_at?: string | null
  ends_at?: string | null
  freeze_scoreboard: boolean
  freeze_at?: string | null
}) {
  const { data, error } = await supabase.rpc('update_event_settings', {
    p_event_name: settings.event_name,
    p_is_enabled: settings.is_enabled,
    p_starts_at: settings.starts_at || null,
    p_ends_at: settings.ends_at || null,
    p_freeze_scoreboard: settings.freeze_scoreboard,
    p_freeze_at: settings.freeze_at || null,
  })
  if (error) throw error
  return data?.event as EventSettings
}

export async function getUserCategoryProgress(userId: string): Promise<CategoryProgress[]> {
  const { data, error } = await supabase.rpc('get_user_category_progress', {
    p_user_id: userId,
  })
  if (error) throw error
  return (data || []) as CategoryProgress[]
}
