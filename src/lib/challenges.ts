// Get user rank only (by username)
export async function getUserRank(username: string): Promise<number | null> {
  const leaderboard = await getLeaderboard();
  leaderboard.sort((a: any, b: any) => {
    const scoreA = a.progress.length > 0 ? a.progress[a.progress.length - 1].score : 0;
    const scoreB = b.progress.length > 0 ? b.progress[b.progress.length - 1].score : 0;
    return scoreB - scoreA;
  });
  const idx = leaderboard.findIndex((entry: any) => entry.username === username);
  return idx !== -1 ? idx + 1 : null;
}
import { supabase } from './supabase'
import { getActiveSeason } from './seasons'
import { isAdmin, getUserRole, getCurrentUser } from './auth'
import { Challenge, ChallengeWithSolve, LeaderboardEntry, Attachment, Announcement, AppNotification } from '@/types'

/**
 * Get all challenges
 */
export async function getChallenges(
  userId?: string,
  showAll: boolean = false,
  seasonId?: string
): Promise<(ChallengeWithSolve & { has_first_blood: boolean; is_new: boolean })[]> {
  try {
    // 🔹 Siapkan query challenge list
    let query = supabase
      .from('challenges')
      .select('*')
      .order('points', { ascending: true })        // poin terendah dulu
      .order('total_solves', { ascending: false }); // jika poin sama, paling banyak solves dulu

    if (!showAll) {
      query = query.eq('is_active', true);
      if (seasonId) {
        // Jangan kembalikan soal jika season berstatus draft
        const { data: sCheck } = await supabase
          .from('seasons')
          .select('status')
          .eq('id', seasonId)
          .maybeSingle();

        if (sCheck && sCheck.status === 'draft') {
          return [];
        }

        query = query.eq('season_id', seasonId);
      }
    } else if (seasonId && seasonId !== 'all') {
      if (seasonId === 'unassigned') {
        query = query.is('season_id', null);
      } else {
        query = query.eq('season_id', seasonId);
      }
    }

    // 🔹 Siapkan query solved user jika ada userId
    const solvesQuery = userId
      ? supabase.from('solves').select('challenge_id').eq('user_id', userId)
      : null;

    // 🔹 Jalankan kedua query secara paralel (menghilangkan network waterfall)
    const [challengesResult, solvesResult] = await Promise.all([
      query,
      solvesQuery,
    ]);

    if (challengesResult.error) throw new Error(challengesResult.error.message);
    const challenges = challengesResult.data;
    if (!challenges) return [];

    const solvedIds = new Set<string>(solvesResult?.data?.map((s) => s.challenge_id) || []);

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return challenges.map(ch => {
      const createdAt = new Date(ch.created_at);
      const isRecentlyCreated = (now - createdAt.getTime()) < oneDayMs;
      // First blood sudah terjadi jika total_solves > 0
      const hasFirstBlood = (ch.total_solves || 0) > 0;

      return {
        ...ch,
        is_solved: solvedIds.has(ch.id),
        has_first_blood: hasFirstBlood,
        is_recently_created: isRecentlyCreated,
        is_new: isRecentlyCreated || !hasFirstBlood,
        total_solves: ch.total_solves || 0,
      };
    });
  } catch (err) {
    console.error('Error fetching challenges:', err);
    return [];
  }
}

/**
 * Submit flag for a challenge
 */
export async function submitFlag(challengeId: string, flag: string) {
  try {
    // 1. Validasi format Flag POLIJE{.......}
    const cleanFlag = (flag || '').trim();
    const flagPattern = /^POLIJE\{[ -~]+\}$/;
    if (!flagPattern.test(cleanFlag)) {
      return {
        success: false,
        message: 'Format flag tidak valid! Format wajib menggunakan: POLIJE{.......}',
      };
    }

    // 2. Cek apakah user adalah kontributor
    const userRole = await getUserRole();
    if (userRole === 'contributor') {
      return {
        success: false,
        message: 'Akun kontributor soal dibatasi hanya untuk membuat soal dan tidak dapat melakukan submit flag.',
      };
    }

    // 3. Cek apakah tantangan ini terikat pada season yang berstatus draft / belum dibuka
    const { data: chall } = await supabase
      .from('challenges')
      .select('id, season_id, seasons(id, number, name, status)')
      .eq('id', challengeId)
      .maybeSingle();

    const season = (chall as any)?.seasons;
    if (season && season.status === 'draft') {
      const admin = await isAdmin();
      if (!admin) {
        return {
          success: false,
          message: `Musim ${season.name || ''} belum resmi dimulai. Flag belum dapat dikirimkan oleh peserta.`,
        };
      }
    }
  } catch (err) {
    console.warn('Error checking season draft status on flag submission:', err);
  }

  const { data, error } = await supabase.rpc('submit_flag', {
    challenge_id: challengeId,
    flag: flag,
  });

  if (error) {
    console.error('submit_flag error', error);
    return { success: false, message: error.message };
  }

  return data;
}


/**
 * Add a new challenge (Admin only)
 */
export async function addChallenge(challengeData: {
  title: string
  description: string
  category: string
  points: number
  max_points?: number
  flag: string
  hint?: string | string[] | null
  attachments?: Attachment[]
  difficulty: string
  is_dynamic?: boolean
  min_points?: number
  decay_per_solve?: number
  season_id?: string | null
  is_active?: boolean
  author?: string | null
  created_by?: string | null
}): Promise<void> {
  try {
    let hintValue: any = null;
    if (Array.isArray(challengeData.hint)) {
      hintValue = challengeData.hint.length > 0 ? JSON.stringify(challengeData.hint) : null;
    } else if (typeof challengeData.hint === 'string' && challengeData.hint.trim() !== '') {
      hintValue = JSON.stringify([challengeData.hint]);
    }
    const { error } = await supabase.rpc('add_challenge', {
      p_title: challengeData.title,
      p_description: challengeData.description,
      p_category: challengeData.category,
      p_points: challengeData.points,
      p_max_points: challengeData.max_points ?? null,
      p_flag: challengeData.flag,
      p_difficulty: challengeData.difficulty,
      p_hint: hintValue,
      p_attachments: challengeData.attachments || [],
      p_is_dynamic: challengeData.is_dynamic,
      p_min_points: challengeData.min_points ,
      p_decay_per_solve: challengeData.decay_per_solve
    });
    if (error) {
      throw new Error(error.message)
    }

    if (challengeData.season_id !== undefined || challengeData.is_active !== undefined || challengeData.author || challengeData.created_by) {
      const { data: latest } = await supabase
        .from('challenges')
        .select('id')
        .eq('title', challengeData.title)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latest?.id) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token || ''
          await fetch('/api/admin/challenges/season', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              challengeId: latest.id,
              seasonId: challengeData.season_id,
              isActive: challengeData.is_active,
              author: challengeData.author,
              createdBy: challengeData.created_by,
            }),
          })
        } catch (apiErr) {
          console.warn('Could not update challenge season via API:', apiErr)
        }
      }
    }
  } catch (error) {
    console.error('Error adding challenge:', error)
    throw error
  }
}

/**
 * Update challenge (Admin only)
 */
export async function updateChallenge(challengeId: string, challengeData: {
  title: string
  description: string
  category: string
  points: number
  max_points?: number
  flag?: string
  hint?: string | string[] | null
  attachments?: Attachment[]
  difficulty: string
  is_active?: boolean
  is_dynamic?: boolean
  min_points?: number
  decay_per_solve?: number
  season_id?: string | null
  author?: string | null
  created_by?: string | null
}): Promise<void> {
  try {
    let hintValue: any = null;
    if (Array.isArray(challengeData.hint)) {
      hintValue = challengeData.hint.length > 0 ? JSON.stringify(challengeData.hint) : null;
    } else if (typeof challengeData.hint === 'string' && challengeData.hint.trim() !== '') {
      hintValue = JSON.stringify([challengeData.hint]);
    }
    const { error } = await supabase.rpc('update_challenge', {
      p_challenge_id: challengeId,
      p_title: challengeData.title,
      p_description: challengeData.description,
      p_category: challengeData.category,
      p_points: challengeData.points,
      p_max_points: challengeData.max_points ?? null,
      p_difficulty: challengeData.difficulty,
      p_hint: hintValue,
      p_attachments: challengeData.attachments || [],
      p_is_active: challengeData.is_active, // kirim undefined jika tidak ada perubahan
      p_flag: challengeData.flag || null,
      p_is_dynamic: challengeData.is_dynamic ?? false,
      p_min_points: challengeData.min_points ?? 0,
      p_decay_per_solve: challengeData.decay_per_solve ?? 0
    });
    if (error) {
      throw new Error(error.message)
    }

    if (challengeData.season_id !== undefined || challengeData.is_active !== undefined || challengeData.author || challengeData.created_by) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token || ''
        await fetch('/api/admin/challenges/season', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            challengeId,
            seasonId: challengeData.season_id,
            isActive: challengeData.is_active,
            author: challengeData.author,
            createdBy: challengeData.created_by,
          }),
        })
      } catch (apiErr) {
        console.warn('Could not update challenge season via API:', apiErr)
      }
    }
  } catch (error) {
    console.error('Error updating challenge:', error)
    throw error
  }
}

/**
 * Delete challenge (Admin only)
 */
export async function deleteChallenge(challengeId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('delete_challenge', {
      p_challenge_id: challengeId
    });
    if (error) {
      throw new Error(error.message)
    }
  } catch (error) {
    console.error('Error deleting challenge:', error)
    throw error
  }
}

/**
 * Get challenge by ID (Admin only - includes flag info)
 */
export async function getChallengeById(challengeId: string): Promise<Challenge | null> {
  try {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return data
  } catch (error) {
    console.error('Error fetching challenge:', error)
    return null
  }
}

/**
 * Get leaderboard with progress
 */
export async function getLeaderboard(limit = 100, offset = 0) {
  const { data, error } = await supabase.rpc('get_leaderboard', {
    limit_rows: limit,
    offset_rows: offset,
  })
  if (error) throw error
  return data
}

/**
 * Get lightweight leaderboard summary: username and final score (no progress history)
 */
export async function getLeaderboardSummary(limit = 100, offset = 0) {
  const data = await getLeaderboard(limit, offset)
  return (data || []).map((d: any) => ({
    id: d.id,
    username: d.username,
    score: typeof d.score === 'number' ? d.score : (d.progress?.at(-1)?.score ?? 0),
    rank: d.rank,
    last_solve: d.last_solve,
  }))
}

export async function getTopProgress(topUsers: string[]) {
  const { data, error } = await supabase
    .from('solves')
    .select(`
      created_at,
      challenges(points),
      users(id, username)
    `)
    .in('user_id', topUsers)
    .order('created_at', { ascending: true })
  // console.log('Get Solves User', topUsers, data, error)

  if (error) throw error

  // Build progress curve per user
  const rows: any[] = (data as any[]) || []
  const progress: Record<string, { username: string; history: { date: string; score: number }[] }> = {}
  for (const row of rows) {
    const user = row.users
    if (!user) continue
    if (!progress[user.id]) {
      progress[user.id] = { username: user.username, history: [] }
    }

    const prev = progress[user.id].history.at(-1)?.score || 0
    progress[user.id].history.push({
      date: row.created_at,
      score: prev + (row.challenges?.points || 0)
    })
  }

  return progress
}

/**
 * Fetch progress curves for a list of usernames (convenience wrapper).
 * Internally resolves usernames -> ids then reuses getTopProgress which expects user ids.
 */
export async function getTopProgressByUsernames(usernames: string[]) {
  if (!usernames || usernames.length === 0) return {}

  // Fetch user ids for the provided usernames
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, username')
    .in('username', usernames)

  if (usersError) throw usersError

  const idToUsername: Record<string, string> = {}
  const ids: string[] = (users || []).map((u: any) => {
    idToUsername[u.id] = u.username
    return u.id
  })

  if (ids.length === 0) return {}

  const progressById = await getTopProgress(ids)

  // Transform to username-keyed map
  const result: Record<string, { username: string; history: { date: string; score: number }[] }> = {}
  for (const id of Object.keys(progressById)) {
    const entry = progressById[id]
    const uname = idToUsername[id]
    if (!uname) continue
    result[uname] = {
      username: entry.username,
      history: entry.history,
    }
  }

  return result
}

// export async function getLeaderboard() {
//   const batchSize = 1000
//   let allSolves: any[] = []
//   let from = 0

//   console.log('Fetching solves with pagination...')

//   // 🔁 Fetch solves by batches until all retrieved
//   while (true) {
//     const { data, error } = await supabase
//       .from('solves')
//       .select(`
//         created_at,
//         challenges(points),
//         users(id, username)
//       `)
//       .order('created_at', { ascending: true })
//       .range(from, from + batchSize - 1)

//     if (error) throw error

//     allSolves = allSolves.concat(data)
//     console.log(`Fetched ${data.length} solves (total ${allSolves.length})`)

//     // stop if we’ve reached the last batch
//     if (data.length < batchSize) break
//     from += batchSize
//   }

//   console.log(`✅ Total solves fetched: ${allSolves.length}`)

//   // 🧩 Build progress per user
//   const userProgress: Record<string, { username: string, progress: { date: string, score: number }[] }> = {}
//   const startDate = allSolves[0]?.created_at || new Date().toISOString()

//   for (const row of allSolves) {
//     const user = row.users
//     if (!userProgress[user.id]) {
//       userProgress[user.id] = { username: user.username, progress: [{ date: startDate, score: 0 }] }
//     }

//     const prevScore = userProgress[user.id].progress.at(-1)?.score || 0
//     const points = row.challenges?.points || 0

//     userProgress[user.id].progress.push({
//       date: row.created_at,
//       score: prevScore + points,
//     })
//   }

//   // 🏁 Final leaderboard (sorted by score)
//   const leaderboard = Object.values(userProgress)
//     .map(user => ({
//       username: user.username,
//       score: user.progress.at(-1)?.score || 0,
//       progress: user.progress,
//     }))
//     .sort((a, b) => b.score - a.score)

//   console.log(`🏆 Leaderboard built with ${leaderboard.length} users`)
//   return leaderboard
// }

/**
 * Get registered solvers for a challenge
 */
export async function getSolversByChallenge(challengeId: string) {
  try {
    const { data, error } = await supabase
      .from('solves')
      .select('created_at, users(username)')
      .eq('challenge_id', challengeId)
      .order('created_at', { ascending: true })

    if (error) throw error

  // Use any to avoid TypeScript complaints
    return ((data as any[]) || []).map(row => ({
      username: row.users.username,
      solvedAt: row.created_at
    }))
  } catch (error) {
    console.error('Error fetching solvers:', error)
    return []
  }
}

/**
 * Get first blood challenge IDs for a user
 */
export async function getFirstBloodChallengeIds(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_user_first_bloods', { p_user_id: userId })
    console.log(data, error)
    if (error) throw error
    // data is expected to be array of { challenge_id }
    return (data || []).map((r: any) => r.challenge_id)
  } catch (err) {
    console.error('Error fetching first bloods (rpc):', err)
    return []
  }
}

/**
 * Get challenge flag (Admin only)
 */
export async function getFlag(challengeId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('get_flag', {
      p_challenge_id: challengeId
    });

    if (error) {
      console.error('Error fetching flag:', error);
      return null;
    }

  return data; // data is already text (flag)
  } catch (err) {
    console.error('Unexpected error fetching flag:', err);
    return null;
  }
}


/**
 * Set challenge active / inactive (Admin only)
 */
export async function setChallengeActive(challengeId: string, isActive: boolean): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('set_challenge_active', {
      p_challenge_id: challengeId,
      p_active: isActive,
    });

    if (error) {
      console.error('Error setting challenge active state:', error);
      return false;
    }

    return data?.success === true;
  } catch (err) {
    console.error('Unexpected error setting challenge active state:', err);
    return false;
  }
}

/**
 * Get all solvers (Admin only) with pagination
 */
export async function getSolversAll(limit = 250, offset = 0) {
  const { data, error } = await supabase.rpc('get_solvers_all', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error('Error fetching solvers (paginated):', error);
    return [];
  }

  return data || [];
}

/**
 * Get solvers for a specific username
 */
export async function getSolversByUsername(username: string) {
  const { data, error } = await supabase.rpc('get_solves_by_name', {
    p_username: username,
  });

  if (error) {
    console.error(`Error fetching solvers for ${username}:`, error);
    return [];
  }

  return data || [];
}

/** Delete a solver entry by solve ID (Admin only)
 */
export async function deleteSolver(solveId: string) {
  const { data, error } = await supabase.rpc("delete_solver", {
    p_solve_id: solveId,
  })

  if (error) throw error
  return data
}

/**
 * Get notifications (new challenges & first blood)
 */
export async function getNotifications(limit = 100, offset = 0) {
  const { data, error } = await supabase.rpc('get_notifications', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
  // console.log(data)
  return data || [];
}

/**
  * Get active announcements (feature upgrades, system updates)
  */
export async function getAnnouncements(limit = 20): Promise<Announcement[]> {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Return empty array gracefully if table does not exist yet
      console.warn('Announcements fetch notice:', error.message);
      return [];
    }
    return (data || []) as Announcement[];
  } catch (err) {
    console.error('Failed to get announcements:', err);
    return [];
  }
}

/**
 * Get unified notifications (announcements, new challenges, and first bloods)
 */
export async function getCombinedNotifications(limit = 100): Promise<AppNotification[]> {
  const [announcementsRes, notifsRes, activeSeasonRes] = await Promise.allSettled([
    getAnnouncements(limit),
    getNotifications(limit, 0),
    getActiveSeason(),
  ]);

  const list: AppNotification[] = [];

  // Add announcements
  if (announcementsRes.status === 'fulfilled' && Array.isArray(announcementsRes.value)) {
    for (const a of announcementsRes.value) {
      list.push({
        id: `announcement-${a.id}`,
        notif_type: a.type === 'feature' ? 'feature_update' : 'system_update',
        title: a.title,
        description: a.description,
        badge: a.badge || (a.type === 'feature' ? 'FITUR BARU' : 'UPDATE'),
        link: a.link || '/challenges',
        created_at: a.created_at,
      });
    }
  }

  // Add challenge notifications (KHUSUS season yang sedang aktif & soal berstatus active)
  if (notifsRes.status === 'fulfilled' && Array.isArray(notifsRes.value) && notifsRes.value.length > 0) {
    const activeSeasonId =
      activeSeasonRes.status === 'fulfilled' && activeSeasonRes.value ? activeSeasonRes.value.id : null;

    const rawNotifs = notifsRes.value;
    const challengeIds = Array.from(
      new Set(
        rawNotifs
          .map((n: any) => n.notif_challenge_id)
          .filter(Boolean)
      )
    );

    let allowedIds = new Set<string>();
    if (challengeIds.length > 0) {
      try {
        let q = supabase
          .from('challenges')
          .select('id, season_id, is_active')
          .in('id', challengeIds)
          .eq('is_active', true);

        if (activeSeasonId) {
          q = q.eq('season_id', activeSeasonId);
        }

        const { data: validChalls } = await q;
        allowedIds = new Set((validChalls || []).map((c: any) => c.id));
      } catch (err) {
        console.warn('Failed to filter notifications by active season:', err);
      }
    }

    for (const n of rawNotifs) {
      // Lewati jika tantangan berasal dari season draft / bukan season aktif
      if (!allowedIds.has(n.notif_challenge_id)) {
        continue;
      }

      if (n.notif_type === 'new_challenge') {
        list.push({
          id: `new_chall-${n.notif_challenge_id}-${n.notif_created_at}`,
          notif_type: 'new_challenge',
          title: `Soal Baru: ${n.notif_challenge_title}`,
          description: `Tantangan baru kategori ${n.notif_category} siap dikerjakan!`,
          badge: 'SOAL BARU',
          category: n.notif_category,
          challenge_id: n.notif_challenge_id,
          link: '/challenges',
          created_at: n.notif_created_at,
        });
      } else if (n.notif_type === 'first_blood') {
        list.push({
          id: `fb-${n.notif_challenge_id}-${n.notif_user_id}-${n.notif_created_at}`,
          notif_type: 'first_blood',
          title: `First Blood: ${n.notif_challenge_title}`,
          description: `${n.notif_username || 'Seseorang'} berhasil merebut first blood!`,
          badge: 'FIRST BLOOD',
          category: n.notif_category,
          challenge_id: n.notif_challenge_id,
          user_id: n.notif_user_id,
          username: n.notif_username,
          link: n.notif_username ? `/user/${encodeURIComponent(n.notif_username)}` : '/challenges',
          created_at: n.notif_created_at,
        });
      }
    }
  }

  // Sort by date descending
  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return list.slice(0, limit);
}

/**
 * Unlock hint with point penalty
 */
export async function unlockHint(challengeId: string, hintIdx: number, cost = 0) {
  try {
    const { data, error } = await supabase.rpc('unlock_hint', {
      p_challenge_id: challengeId,
      p_hint_idx: hintIdx,
      p_cost: cost,
    });
    if (error) throw error;

    // Simpan di localStorage hanya jika SUKSES dari database
    if (data && data.success) {
      if (typeof window !== 'undefined') {
        const storageKey = `unlocked_hints_${challengeId}`;
        const saved = localStorage.getItem(storageKey);
        const list: number[] = saved ? JSON.parse(saved) : [];
        if (!list.includes(hintIdx)) {
          localStorage.setItem(storageKey, JSON.stringify([...list, hintIdx]));
        }
      }
    }

    return data;
  } catch (err: any) {
    console.error('unlockHint error:', err);
    return {
      success: false,
      message: err?.message || 'Terjadi kesalahan sistem saat membuka hint.',
    };
  }
}

/**
 * Get all unlocked hints for current user on a challenge
 */
export async function getUnlockedHints(challengeId: string): Promise<number[]> {
  const storageKey = `unlocked_hints_${challengeId}`;
  let localList: number[] = [];
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(storageKey);
      localList = saved ? JSON.parse(saved) : [];
    } catch {}
  }

  try {
    const { data, error } = await supabase.rpc('get_unlocked_hints', {
      p_challenge_id: challengeId,
    });
    if (error) return localList;
    const remoteList: number[] = (data || []).map((h: any) => h.hint_idx);
    
    // Sinkronkan cache localStorage dengan data riil dari Supabase
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(remoteList));
    }
    return remoteList;
  } catch {
    return localList;
  }
}

