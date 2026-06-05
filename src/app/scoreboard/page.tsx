'use client'

import ScoreboardChart from '@/components/scoreboard/ScoreboardChart'
import ScoreboardTable from '@/components/scoreboard/ScoreboardTable'
import ScoreboardEmptyState from '@/components/scoreboard/ScoreboardEmptyState'
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false)
        return
      }
      setLoading(true)

      if (mode === 'teams') {
        const teams = await getTeamLeaderboard(period, 100, 0)
        setTeamLeaderboard(teams)
        setLeaderboard([])
        setLoading(false)
        return
      }

      const summary = await getScopedLeaderboard(period, 100, 0)
      const top100 = summary.slice(0, 100)

      const baseLeaderboard: LeaderboardEntry[] = top100.map((t: any, i: number) => ({
        id: t.id || String(i + 1),
        username: t.username,
        score: t.score ?? 0,
        rank: t.rank ?? i + 1,
        progress: [],
      }))

      if (period === 'all') {
        const topForChart = top100.slice(0, 10)
        const topUsernames = topForChart.map((t: any) => t.username)
        const progressMap = await getTopProgressByUsernames(topUsernames)

        for (let i = 0; i < topForChart.length; i++) {
          const uname = topForChart[i].username
          const history = progressMap[uname]?.history ?? []
          baseLeaderboard[i].progress = history.map((p: any) => ({ date: String(p.date), score: p.score }))
        }
      }

      setLeaderboard(baseLeaderboard)
      setTeamLeaderboard([])
      setLoading(false)
    }
    fetchData()
  }, [user, period, mode])

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <TitlePage>🏆 Scoreboard</TitlePage>
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={period === item.value ? 'default' : 'outline'}
                onClick={() => setPeriod(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'users' ? 'default' : 'outline'} onClick={() => setMode('users')}>
              Users
            </Button>
            <Button size="sm" variant={mode === 'teams' ? 'default' : 'outline'} onClick={() => setMode('teams')}>
              Teams
            </Button>
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
                <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Ranking</h2>
                    <Button size="sm" variant="outline" onClick={() => router.push('/teams')}>My Team</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-600 dark:border-gray-700 dark:text-gray-300">
                          <th className="w-16 py-2 text-center">Rank</th>
                          <th className="py-2">Team</th>
                          <th className="py-2 text-center">Members</th>
                          <th className="py-2 text-center">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamLeaderboard.map((entry) => (
                          <tr key={entry.team_id} className="border-b last:border-0 dark:border-gray-700">
                            <td className="py-3 text-center font-mono text-gray-600 dark:text-gray-300">#{entry.rank}</td>
                            <td className="py-3 font-medium text-gray-900 dark:text-white">
                              {entry.team_name}
                              {entry.is_solo && (
                                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                  Solo
                                </span>
                              )}
                            </td>
                            <td className="py-3 text-center text-gray-600 dark:text-gray-300">{entry.member_count}</td>
                            <td className="py-3 text-center font-semibold text-gray-900 dark:text-white">{entry.score}</td>
                          </tr>
                        ))}
                        {teamLeaderboard.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-gray-500">No teams yet</td>
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
