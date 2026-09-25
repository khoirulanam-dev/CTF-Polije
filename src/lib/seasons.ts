import { supabase } from './supabase'
import { Season, SeasonArchive } from '@/types'

let cachedActiveSeason: Season | null = null
let cachedPublicSeasons: Season[] | null = null
let cachedArchives: SeasonArchive[] | null = null
let seasonsInFlight: Promise<Season[]> | null = null
let archivesInFlight: Promise<SeasonArchive[]> | null = null

/**
 * Mengambil season yang sedang berstatus 'active'
 */
export async function getActiveSeason(forceRefresh = false): Promise<Season | null> {
  if (cachedActiveSeason && !forceRefresh) {
    return cachedActiveSeason
  }

  try {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.warn('Seasons table query warning:', error.message)
      return cachedActiveSeason || null
    }

    cachedActiveSeason = data as Season | null
    return cachedActiveSeason
  } catch (err) {
    console.warn('Error fetching active season:', err)
    return cachedActiveSeason || null
  }
}

/**
 * Mengambil seluruh daftar seasons yang dapat dilihat publik (active dan archived)
 * Dilengkapi memory-cache + inflight deduplication agar navigasi instan (0ms).
 */
export async function getPublicSeasons(forceRefresh = false): Promise<Season[]> {
  if (cachedPublicSeasons && cachedPublicSeasons.length > 0 && !forceRefresh) {
    // Revalidasi di latar belakang tanpa memblokir UI
    fetchPublicSeasonsRaw().catch(() => {})
    return cachedPublicSeasons
  }

  if (seasonsInFlight) {
    return seasonsInFlight
  }

  seasonsInFlight = fetchPublicSeasonsRaw().finally(() => {
    seasonsInFlight = null
  })

  return seasonsInFlight
}

async function fetchPublicSeasonsRaw(): Promise<Season[]> {
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/seasons')
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.seasons) && json.seasons.length > 0) {
          cachedPublicSeasons = json.seasons as Season[]
          return cachedPublicSeasons
        }
      }
    }

    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('number', { ascending: false })

    if (error) {
      console.warn('Error fetching public seasons:', error.message)
      return cachedPublicSeasons || []
    }

    cachedPublicSeasons = (data || []) as Season[]
    return cachedPublicSeasons
  } catch (err) {
    console.warn('Error getting public seasons:', err)
    return cachedPublicSeasons || []
  }
}

/**
 * Mengambil riwayat arsip season (Hall of Fame, top players, top soal)
 * Dilengkapi memory-cache agar buka halaman seasons instan tanpa delay.
 */
export async function getSeasonArchives(forceRefresh = false): Promise<SeasonArchive[]> {
  if (cachedArchives && cachedArchives.length > 0 && !forceRefresh) {
    fetchSeasonArchivesRaw().catch(() => {})
    return cachedArchives
  }

  if (archivesInFlight) {
    return archivesInFlight
  }

  archivesInFlight = fetchSeasonArchivesRaw().finally(() => {
    archivesInFlight = null
  })

  return archivesInFlight
}

async function fetchSeasonArchivesRaw(): Promise<SeasonArchive[]> {
  try {
    const { data, error } = await supabase
      .from('season_archives')
      .select('*')
      .order('season_number', { ascending: false })

    if (error) {
      console.warn('Error fetching season archives:', error.message)
      return cachedArchives || []
    }

    cachedArchives = (data || []) as SeasonArchive[]
    return cachedArchives
  } catch (err) {
    console.warn('Error getting season archives:', err)
    return cachedArchives || []
  }
}

/**
 * Mengambil detail snapshot arsip suatu season berdasarkan nomor season
 */
export async function getSeasonArchiveByNumber(seasonNumber: number): Promise<SeasonArchive | null> {
  if (cachedArchives) {
    const found = cachedArchives.find((a) => a.season_number === seasonNumber)
    if (found) return found
  }

  try {
    const { data, error } = await supabase
      .from('season_archives')
      .select('*')
      .eq('season_number', seasonNumber)
      .maybeSingle()

    if (error) {
      console.warn(`Error fetching season archive for season ${seasonNumber}:`, error.message)
      return null
    }

    return data as SeasonArchive | null
  } catch (err) {
    console.warn('Error getting season archive by number:', err)
    return null
  }
}
