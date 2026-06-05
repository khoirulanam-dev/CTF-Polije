// src/lib/users.ts

// Get user detail (rank, solved challenges) via RPC
import { PostgrestSingleResponse } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { User, ChallengeWithSolve } from '@/types'

export type UserDetail = {
  id: string
  username: string
  rank: number | null
  score: number
  picture?: string | null
  avatar_url?: string | null
  bio?: string | null
  github_url?: string | null
  linkedin_url?: string | null
  instagram_url?: string | null
  website_url?: string | null
  solved_challenges: ChallengeWithSolve[]
  highest_rank?: number | null
  highest_rank_at?: string | null
}

export type ProfileUpdateInput = {
  username: string
  avatar_url?: string | null
  bio?: string | null
  github_url?: string | null
  linkedin_url?: string | null
  instagram_url?: string | null
  website_url?: string | null
}

export type ProfileUpdateResult = ProfileUpdateInput & {
  picture?: string | null
}

// ambil detail user via RPC `detail_user` (yang tadi sudah kita update di supabase)
export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  try {
    const { data, error }: PostgrestSingleResponse<any> = await supabase.rpc(
      'detail_user',
      { p_id: userId }
    )

    if (error || !data || !data.success) {
      console.error('Error fetching user detail:', error || data?.message)
      return null
    }

    const u = data.user

    return {
      id: u.id,
      username: u.username,
      rank: u.rank ?? null,
      score: u.score ?? 0,
      picture: u.picture ?? null,
      avatar_url: u.avatar_url ?? null,
      bio: u.bio ?? null,
      github_url: u.github_url ?? null,
      linkedin_url: u.linkedin_url ?? null,
      instagram_url: u.instagram_url ?? null,
      website_url: u.website_url ?? null,
      // ⬇️ ikutkan dari RPC
      highest_rank: u.highest_rank ?? null,
      highest_rank_at: u.highest_rank_at ?? null,
      solved_challenges: (data.solved_challenges || []).map((c: any) => ({
        id: c.challenge_id,
        title: c.title,
        category: c.category,
        points: c.points,
        difficulty: c.difficulty,
        is_solved: true,
        solved_at: c.solved_at,
      })),
    }
  } catch (error) {
    console.error('Error fetching user detail:', error)
    return null
  }
}

// ini dipakai halaman /user/[username]
// kita sekalian ambil kolom peak-nya juga
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      // ambil field yg kita butuhkan aja, termasuk yg baru
      .select('id, username, avatar_url, bio, github_url, linkedin_url, instagram_url, website_url, is_admin, highest_rank, highest_rank_at, created_at, updated_at')
      .eq('username', username)
      .single()

    if (error) {
      console.error('Error fetching user by username:', error)
      return null
    }

    return data as unknown as User
  } catch (error) {
    console.error('Error fetching user by username:', error)
    return null
  }
}

// Ambil challenge user dari kolom attachments JSONB di tabel challenges.
export async function getUserChallenges(userId: string): Promise<ChallengeWithSolve[]> {
  try {
    const { data: challenges, error: challengesError } = await supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false })

    if (challengesError) {
      console.error('Error fetching challenges:', challengesError)
      return []
    }

    const { data: solves, error: solvesError } = await supabase
      .from('solves')
      .select('challenge_id')
      .eq('user_id', userId)

    if (solvesError) {
      console.error('Error fetching solves:', solvesError)
      return []
    }

    const solvedChallengeIds = new Set((solves || []).map(solve => solve.challenge_id))

    return (challenges || []).map(challenge => ({
      ...challenge,
      is_solved: solvedChallengeIds.has(challenge.id),
      attachments: challenge.attachments || [],
    }))
  } catch (error) {
    console.error('Error fetching user challenges:', error)
    return []
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    // di skema kamu tabel public.users TIDAK punya kolom "score"
    // jadi kita urutkan pakai created_at aja biar gak error
    const { data, error } = await supabase
      .from('users')
      .select('id, username, avatar_url, bio, github_url, linkedin_url, instagram_url, website_url, is_admin, highest_rank, highest_rank_at, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return []
    }

    return (data || []) as unknown as User[]
  } catch (error) {
    console.error('Error fetching users:', error)
    return []
  }
}

// Get category totals (total challenge per kategori)
export type CategoryTotal = {
  category: string
  total_challenges: number
}

export async function getCategoryTotals(): Promise<CategoryTotal[]> {
  try {
    const { data, error } = await supabase.rpc('get_category_totals')

    if (error) {
      console.error('Error fetching category totals:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error fetching category totals:', error)
    return []
  }
}

export type SiteInfo = {
  total_users: number
  total_admins: number
  total_solves: number
  unique_solvers: number
  total_challenges: number
  active_challenges: number
}

export async function getInfo(): Promise<SiteInfo | null> {
  try {
    const { data, error } = await supabase.rpc('get_info')
    if (error || !data) {
      console.error('Error fetching site info:', error)
      return null
    }
    return {
      total_users: Number(data.total_users || 0),
      total_admins: Number(data.total_admins || 0),
      total_solves: Number(data.total_solves || 0),
      unique_solvers: Number(data.unique_solvers || 0),
      total_challenges: Number(data.total_challenges || 0),
      active_challenges: Number(data.active_challenges || 0),
    }
  } catch (err) {
    console.error('Error in getInfo:', err)
    return null
  }
}

// Update current user's username via RPC
export async function updateUsername(
  userId: string,
  newUsername: string
): Promise<{ error: string | null; username?: string }> {
  try {
    const { data, error } = await supabase.rpc('update_username', {
      p_id: userId,
      p_username: newUsername,
    })
    if (error || !data) {
      return { error: error?.message || 'Failed to update username' }
    }
    if (!data.success) {
      return { error: data.message || 'Failed to update username' }
    }
    return { error: null, username: data.username }
  } catch (error) {
    return { error: 'Failed to update username' }
  }
}

export async function uploadProfileAvatar(
  userId: string,
  file: File
): Promise<{ error: string | null; url?: string }> {
  try {
    if (!file.type.startsWith('image/')) {
      return { error: 'File must be an image' }
    }

    if (file.size > 2 * 1024 * 1024) {
      return { error: 'Image must be 2 MB or smaller' }
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/avatar-${Date.now()}.${extension}`

    const { error } = await supabase.storage
      .from('profile-avatars')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: true,
      })

    if (error) {
      return { error: error.message }
    }

    const { data } = supabase.storage.from('profile-avatars').getPublicUrl(path)
    return { error: null, url: data.publicUrl }
  } catch (error) {
    return { error: 'Failed to upload profile photo' }
  }
}

export async function updateProfile(
  userId: string,
  profile: ProfileUpdateInput
): Promise<{ error: string | null; profile?: ProfileUpdateResult }> {
  try {
    const { data, error } = await supabase.rpc('update_profile', {
      p_id: userId,
      p_username: profile.username,
      p_avatar_url: profile.avatar_url || null,
      p_bio: profile.bio || null,
      p_github_url: profile.github_url || null,
      p_linkedin_url: profile.linkedin_url || null,
      p_instagram_url: profile.instagram_url || null,
      p_website_url: profile.website_url || null,
    })

    if (error || !data) {
      return { error: error?.message || 'Failed to update profile' }
    }

    if (!data.success) {
      return { error: data.message || 'Failed to update profile' }
    }

    return { error: null, profile: data.profile }
  } catch (error) {
    return { error: 'Failed to update profile' }
  }
}
