export type UserRole = 'admin' | 'contributor' | 'user'

export interface User {
  id: string
  username: string
  picture?: string
  avatar_url?: string | null
  bio?: string | null
  github_url?: string | null
  linkedin_url?: string | null
  instagram_url?: string | null
  website_url?: string | null
  score: number
  rank?: number
  is_admin?: boolean
  is_contributor?: boolean
  role?: UserRole
  created_at: string
  updated_at: string
}

export interface Attachment {
  name: string
  url: string
  type: 'file' | 'link'
}

export interface Challenge {
  id: string
  title: string
  description: string
  category: string
  points: number
  max_points?: number
  flag: string
  flag_hash: string
  hint?: any
  attachments?: Attachment[]
  difficulty: string
  is_active: boolean
  is_dynamic: boolean
  min_points: number
  decay_per_solve: number
  season_id?: string | null
  author?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface Solve {
  id: string
  user_id: string
  challenge_id: string
  created_at: string
}

export interface ChallengeWithSolve extends Challenge {
  is_solved?: boolean
  solved_at?: string // Add this line to support solved_at in UserProfile
  total_solves?: number
  has_first_blood?: boolean
  is_new?: boolean
  is_recently_created?: boolean
}

// export interface LeaderboardEntry {
//   id: string
//   username: string
//   score: number
//   rank: number
// }

export type LeaderboardEntry = {
  id: string
  username: string
  score: number
  rank: number
  picture?: string | null
  progress: {
    date: string
    score: number
  }[]
}

export interface Announcement {
  id: string
  title: string
  description: string
  type: 'feature' | 'challenge' | 'system' | 'maintenance'
  badge?: string
  link?: string | null
  created_at: string
  is_active: boolean
}

export type AppNotification = {
  id: string
  notif_type: 'feature_update' | 'new_challenge' | 'first_blood' | 'system_update'
  title: string
  description?: string
  badge?: string
  category?: string
  challenge_id?: string
  user_id?: string
  username?: string
  link?: string
  created_at: string
}

export type SeasonStatus = 'draft' | 'active' | 'archived'

export interface Season {
  id: string
  number: number
  name: string
  description?: string | null
  status: SeasonStatus
  started_at?: string | null
  ended_at?: string | null
  created_at: string
  updated_at: string
  challenge_count?: number
}

export interface TopPlayerArchive {
  rank: number
  user_id: string
  username: string
  score: number
  total_solves: number
  avatar_url?: string | null
}

export interface TopChallengeArchive {
  id: string
  title: string
  category: string
  points: number
  solves_count: number
  first_blood_user?: string | null
}

export interface SeasonArchive {
  id: string
  season_id: string
  season_number: number
  season_name: string
  top_players: TopPlayerArchive[]
  top_challenges: TopChallengeArchive[]
  stats: {
    total_solves: number
    total_users: number
    total_challenges: number
    started_at?: string | null
    ended_at?: string | null
  }
  created_at: string
}

