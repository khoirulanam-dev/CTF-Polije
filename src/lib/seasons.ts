import { supabase } from './supabase'
import { Season, SeasonArchive } from '@/types'

/**
 * Mengambil season yang sedang berstatus 'active'
 */
export async function getActiveSeason(): Promise<Season | null> {
  try {
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      // Tabel belum ada atau error RLS, fallback ke default Season 1 virtual
      console.warn('Seasons table query warning:', error.message)
      return null
    }

    return data as Season | null
  } catch (err) {
    console.warn('Error fetching active season:', err)
    return null
  }
}

/**
 * Mengambil seluruh daftar seasons yang dapat dilihat publik (active dan archived)
 */
export async function getPublicSeasons(): Promise<Season[]> {
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/seasons')
      if (res.ok) {
        const json = await res.json()
        if (json.seasons) return json.seasons as Season[]
      }
    }

    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .order('number', { ascending: false })

    if (error) {
      console.warn('Error fetching public seasons:', error.message)
      return []
    }

    return (data || []) as Season[]
  } catch (err) {
    console.warn('Error getting public seasons:', err)
    return []
  }
}

/**
 * Mengambil riwayat arsip season (Hall of Fame, top players, top soal)
 */
export async function getSeasonArchives(): Promise<SeasonArchive[]> {
  try {
    const { data, error } = await supabase
      .from('season_archives')
      .select('*')
      .order('season_number', { ascending: false })

    if (error) {
      console.warn('Error fetching season archives:', error.message)
      return []
    }

    return (data || []) as SeasonArchive[]
  } catch (err) {
    console.warn('Error getting season archives:', err)
    return []
  }
}

/**
 * Mengambil detail snapshot arsip suatu season berdasarkan nomor season
 */
export async function getSeasonArchiveByNumber(seasonNumber: number): Promise<SeasonArchive | null> {
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
