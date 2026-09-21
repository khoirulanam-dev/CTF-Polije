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
  hint?: string
  attachments?: Attachment[]
  difficulty: string
  is_active: boolean
  is_dynamic: boolean
  min_points: number
  decay_per_solve: number
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
