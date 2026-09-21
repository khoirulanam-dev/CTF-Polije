'use client'

import dynamic from 'next/dynamic'
import ScoreboardTable from '@/components/scoreboard/ScoreboardTable'
import ScoreboardEmptyState from '@/components/scoreboard/ScoreboardEmptyState'

const ScoreboardChart = dynamic(() => import('@/components/scoreboard/ScoreboardChart'), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse bg-slate-800/40 rounded-xl" />,
});
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Loader from '@/components/custom/loading'
import TitlePage from '@/components/custom/TitlePage'
import { Button } from '@/components/ui/button'

import { getTopProgressByUsernames } from '@/lib/challenges'
import { getEventSettings, getScopedLeaderboard, getTeamLeaderboard, LeaderboardPeriod, TeamLeaderboardEntry } from '@/lib/engagement'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { LeaderboardEntry } from '@/types'
import { supabase } from '@/lib/supabase'

export default function ScoreboardPage() {
  const { user, loading: authLoading } = useAuth()
  const { theme } = useTheme()
  const router = useRouter()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([])
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [mode, setMode] = useState<'users' | 'teams'>('users')
  const [eventEnabled, setEventEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  // 🔒 redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)

    try {
      if (mode === 'teams') {
        const teams = await getTeamLeaderboard(period, 100, 0)
        setTeamLeaderboard(teams)
        setLeaderboard([])
        return
      }

      const summary = await getScopedLeaderboard(period, 100, 0)
      const top100 = summary.slice(0, 100)

      const baseLeaderboard: LeaderboardEntry[] = top100.map((t: any, i: number) => ({
        id: t.id || String(i + 1),
        username: t.username,
        score: t.score ?? 0,
        rank: t.rank ?? i + 1,
        picture: t.picture || t.avatar_url || null,
        progress: [],
      }))

      if (period === 'all') {
        const topForChart = top100.slice(0, 10)
        const topUsernames = topForChart.map((t: any) => t.username)
        const progressMap: Record<string, any> = (await getTopProgressByUsernames(topUsernames).catch(() => ({}))) || {}

        for (let i = 0; i < topForChart.length; i++) {
          const uname = topForChart[i].username
          const history = progressMap[uname]?.history ?? []
          baseLeaderboard[i].progress = history.map((p: any) => ({ date: String(p.date), score: p.score }))
        }
      }

      setLeaderboard(baseLeaderboard)
      setTeamLeaderboard([])
    } catch (err) {
      console.error("Failed to load scoreboard data:", err)
      setLeaderboard([])
    } finally {
      setLoading(false)
    }
  }, [user, period, mode])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ⚡ Supabase Realtime Listener (Debounced 3 detik agar tidak membebani server)
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

  // tunggu authContext
  if (authLoading) return <Loader fullscreen color="text-orange-500" />
  // do not render if not logged in (so redirect can happen)
  if (!user) return null

  const isEmpty = leaderboard.length === 0 || leaderboard.every(e => (e.score ?? 0) === 0)

  // detect dark mode from context to re-render when theme changes
  const isDark = theme === 'dark'
  const periodOptions: { value: LeaderboardPeriod; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'all', label: 'All time' },
  ]
  if (eventEnabled) periodOptions.push({ value: 'event', label: 'Event' })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101b]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <TitlePage>🏆 Scoreboard</TitlePage>
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((item) => {
              const active = period === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPeriod(item.value)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('users')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs ${
                mode === 'users'
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
              }`}
            >
              Users
            </button>
            <button
              type="button"
              onClick={() => setMode('teams')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition shadow-xs ${
                mode === 'teams'
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
              }`}
            >
              Teams
            </button>
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
            {mode === 'users' && period === 'all' && (
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
                <ScoreboardTable leaderboard={leaderboard} currentUsername={user?.username} />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Team Ranking</h2>
                    <Button size="sm" variant="outline" onClick={() => router.push('/teams')}>My Team</Button>
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
                          <tr key={entry.team_id} className="border-b last:border-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 text-center font-mono text-slate-600 dark:text-slate-300">#{entry.rank}</td>
                            <td className="py-3 font-medium text-slate-900 dark:text-white">
                              {entry.team_name}
                            </td>
                            <td className="py-3 text-center text-slate-600 dark:text-slate-300">{entry.member_count}</td>
                            <td className="py-3 text-center font-semibold text-blue-600 dark:text-cyan-400">{entry.score}</td>
                          </tr>
                        ))}
                        {teamLeaderboard.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-gray-500">No ranked teams yet</td>
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
