'use client'

import dynamic from 'next/dynamic'
import ScoreboardTable from '@/components/scoreboard/ScoreboardTable'
import ScoreboardEmptyState from '@/components/scoreboard/ScoreboardEmptyState'

const ScoreboardChart = dynamic(() => import('@/components/scoreboard/ScoreboardChart'), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse bg-slate-800/40 rounded-xl" />,
})

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Loader from '@/components/custom/loading'
import TitlePage from '@/components/custom/TitlePage'
import { Button } from '@/components/ui/button'

import { getEventSettings, LeaderboardPeriod, TeamLeaderboardEntry } from '@/lib/engagement'
import { getPublicSeasons } from '@/lib/seasons'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { LeaderboardEntry, Season } from '@/types'
import { supabase } from '@/lib/supabase'

export default function ScoreboardPage() {
  const { user, loading: authLoading } = useAuth()
  const { theme } = useTheme()
  const router = useRouter()

  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('')
  const [seasonsLoaded, setSeasonsLoaded] = useState(false)

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([])
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [mode, setMode] = useState<'users' | 'teams'>('users')
  const [eventEnabled, setEventEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  // 🔒 Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Load Seasons and resolve initial selection
  useEffect(() => {
    let mounted = true
    const initSeasons = async () => {
      try {
        const publicSeasons = await getPublicSeasons()
        if (!mounted) return
        setSeasons(publicSeasons)

        // Read query param from URL if present
        let initialSeasonId = ''
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const sParam = params.get('season')
          if (sParam) {
            if (sParam.toLowerCase() === 'all') {
              initialSeasonId = 'all'
            } else {
              const matched = publicSeasons.find(
                (s) => s.id === sParam || String(s.number) === sParam
              )
              if (matched) initialSeasonId = matched.id
            }
          }
        }

        // If no URL param, default to active season
        if (!initialSeasonId) {
          const active = publicSeasons.find((s) => s.status === 'active')
          if (active) {
            initialSeasonId = active.id
          } else if (publicSeasons.length > 0) {
            initialSeasonId = publicSeasons[0].id
          } else {
            initialSeasonId = 'all'
          }
        }

        setSelectedSeasonId(initialSeasonId)
      } catch (err) {
        console.error('Error fetching seasons:', err)
        setSelectedSeasonId('all')
      } finally {
        if (mounted) setSeasonsLoaded(true)
      }
    }

    if (user) {
      initSeasons()
    }

    return () => {
      mounted = false
    }
  }, [user])

  // Fetch Scoreboard Data
  const fetchData = useCallback(async () => {
    if (!user || !seasonsLoaded || !selectedSeasonId) {
      return
    }
    setLoading(true)

    try {
      const res = await fetch(
        `/api/scoreboard?season_id=${encodeURIComponent(selectedSeasonId)}&period=${encodeURIComponent(period)}&mode=${encodeURIComponent(mode)}`
      )
      if (!res.ok) {
        throw new Error(`Failed to fetch scoreboard: ${res.statusText}`)
      }

      const json = await res.json()

      if (mode === 'teams') {
        setTeamLeaderboard(json.teamLeaderboard || [])
        setLeaderboard([])
      } else {
        const baseLeaderboard: LeaderboardEntry[] = (json.leaderboard || []).map((t: any) => ({
          id: t.id,
          username: t.username,
          score: t.score ?? 0,
          rank: t.rank,
          picture: t.picture || null,
          progress: (t.progress || []).map((p: any) => ({
            date: String(p.date),
            score: p.score,
          })),
        }))

        setLeaderboard(baseLeaderboard)
        setTeamLeaderboard([])
      }
    } catch (err) {
      console.error('Failed to load scoreboard data:', err)
      setLeaderboard([])
      setTeamLeaderboard([])
    } finally {
      setLoading(false)
    }
  }, [user, seasonsLoaded, selectedSeasonId, period, mode])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ⚡ Supabase Realtime Listener (Debounced 3 detik)
  useEffect(() => {
    if (!user) return
    let timer: NodeJS.Timeout | null = null

    const channel = supabase
      .channel('realtime_scoreboard_solves')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solves' },
        () => {
          if (timer) clearTimeout(timer)
          timer = setTimeout(() => {
            fetchData()
          }, 3000)
        }
      )
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [user, fetchData])

  // Fetch Event settings
  useEffect(() => {
    const fetchEvent = async () => {
      if (!user) return
      try {
        const event = await getEventSettings()
        setEventEnabled(Boolean(event?.is_enabled))
        if (period === 'event' && !event?.is_enabled) setPeriod('all')
      } catch {
        setEventEnabled(false)
      }
    }
    fetchEvent()
  }, [user, period])

  // Handle Season switch & sync URL
  const handleSeasonChange = (seasonId: string) => {
    setSelectedSeasonId(seasonId)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const targetSeason = seasons.find((s) => s.id === seasonId)
      if (seasonId === 'all') {
        url.searchParams.set('season', 'all')
      } else if (targetSeason) {
        url.searchParams.set('season', String(targetSeason.number))
      } else {
        url.searchParams.delete('season')
      }
      window.history.replaceState({}, '', url.toString())
    }
  }

  // Loading auth
  if (authLoading) return <Loader fullscreen color="text-orange-500" />
  if (!user) return null

  const isEmpty =
    mode === 'users'
      ? leaderboard.length === 0 || leaderboard.every((e) => (e.score ?? 0) === 0)
      : teamLeaderboard.length === 0 || teamLeaderboard.every((t) => (t.score ?? 0) === 0)

  const isDark = theme === 'dark'

  const periodOptions: { value: LeaderboardPeriod; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ]
  if (eventEnabled) periodOptions.push({ value: 'event', label: 'Event' })

  const currentSelectedSeason = seasons.find((s) => s.id === selectedSeasonId)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101b]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <TitlePage>🏆 Scoreboard</TitlePage>
          {currentSelectedSeason && (
            <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Musim:{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-200">
                {currentSelectedSeason.name}
              </span>
              {currentSelectedSeason.status === 'active' && (
                <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
          )}
          {selectedSeasonId === 'all' && (
            <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Musim:{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                Seluruh Musim (All Season)
              </span>
            </div>
          )}
        </div>

        {/* Filter Controls Card */}
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          {/* Row 1: Season Selector Tabs + Mode Toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 uppercase tracking-wider">
                Season:
              </span>
              {seasons.map((s) => {
                const isSelected = selectedSeasonId === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSeasonChange(s.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shadow-xs ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'
                    }`}
                  >
                    <span>Season #{s.number}</span>
                    {s.status === 'active' && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        LIVE
                      </span>
                    )}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => handleSeasonChange('all')}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shadow-xs ${
                  selectedSeasonId === 'all'
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'
                }`}
              >
                <span>🌐 All Season</span>
              </button>
            </div>

            {/* Mode Switcher: Users / Teams */}
            <div className="flex gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMode('users')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs ${
                  mode === 'users'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'
                }`}
              >
                Users
              </button>
              <button
                type="button"
                onClick={() => setMode('teams')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs ${
                  mode === 'teams'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'
                }`}
              >
                Teams
              </button>
            </div>
          </div>

          {/* Row 2: Time Period Filter */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 uppercase tracking-wider">
              Periode:
            </span>
            {periodOptions.map((item) => {
              const active = period === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPeriod(item.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition shadow-xs ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-200/70 text-slate-600 border border-slate-200/60 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/60 dark:hover:bg-slate-700/70 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader fullscreen color="text-orange-500" />
          </div>
        ) : !user ? null : mode === 'users' && isEmpty ? (
          <ScoreboardEmptyState />
        ) : (
          <>
            {mode === 'users' && !isEmpty && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <ScoreboardChart leaderboard={leaderboard} isDark={isDark} />
              </motion.div>
            )}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {mode === 'users' ? (
                <ScoreboardTable
                  leaderboard={leaderboard}
                  currentUsername={user?.username}
                  seasonId={selectedSeasonId}
                />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Team Ranking{' '}
                      {currentSelectedSeason ? `(${currentSelectedSeason.name})` : '(All Season)'}
                    </h2>
                    <Button size="sm" variant="outline" onClick={() => router.push('/teams')}>
                      My Team
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                          <th className="w-16 py-2 text-center">Rank</th>
                          <th className="py-2">Team</th>
                          <th className="py-2 text-center">Members</th>
                          <th className="py-2 text-center">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamLeaderboard.map((entry) => (
                          <tr
                            key={entry.team_id}
                            className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-3 text-center font-mono text-slate-600 dark:text-slate-300">
                              #{entry.rank}
                            </td>
                            <td className="py-3 font-medium text-slate-900 dark:text-white">
                              {entry.team_name}
                            </td>
                            <td className="py-3 text-center text-slate-600 dark:text-slate-300">
                              {entry.member_count}
                            </td>
                            <td className="py-3 text-center font-semibold text-blue-600 dark:text-cyan-400">
                              {entry.score}
                            </td>
                          </tr>
                        ))}
                        {teamLeaderboard.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-gray-500">
                              No ranked teams yet for this season
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
