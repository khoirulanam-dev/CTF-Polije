'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Loader from '@/components/custom/loading'
import TitlePage from '@/components/custom/TitlePage'
import ScoreboardTable from '@/components/scoreboard/ScoreboardTable'
import BackButton from '@/components/custom/BackButton'
import { useAuth } from '@/contexts/AuthContext'
import { LeaderboardEntry, Season } from '@/types'
import { getPublicSeasons } from '@/lib/seasons'

export default function ScoreboardAllPage() {
  const { user, loading: authLoading } = useAuth()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Initialize seasons & read URL param
  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const publicSeasons = await getPublicSeasons()
        if (!mounted) return
        setSeasons(publicSeasons)

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
              else initialSeasonId = sParam
            }
          }
        }

        if (!initialSeasonId) {
          const active = publicSeasons.find((s) => s.status === 'active')
          initialSeasonId = active ? active.id : (publicSeasons[0]?.id || 'all')
        }

        setSelectedSeasonId(initialSeasonId)
      } catch (err) {
        console.error('Error initializing seasons:', err)
        setSelectedSeasonId('all')
      }
    }

    if (user) {
      init()
    }

    return () => {
      mounted = false
    }
  }, [user])

  const fetchData = useCallback(async () => {
    if (!user || !selectedSeasonId) {
      return
    }
    setLoading(true)

    try {
      const res = await fetch(
        `/api/scoreboard?season_id=${encodeURIComponent(selectedSeasonId)}&period=all&mode=users&limit=1000`
      )
      if (!res.ok) throw new Error('Failed to fetch full scoreboard')
      const json = await res.json()

      const all: LeaderboardEntry[] = (json.leaderboard || []).map((t: any) => ({
        id: t.id,
        username: t.username,
        score: t.score ?? 0,
        rank: t.rank,
        picture: t.picture || null,
        progress: [],
      }))

      setLeaderboard(all)
    } catch (err) {
      console.error('Failed to fetch all leaderboard:', err)
      setLeaderboard([])
    } finally {
      setLoading(false)
    }
  }, [user, selectedSeasonId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  if (authLoading) return <Loader fullscreen color="text-orange-500" />
  if (!user) return null

  const currentSelectedSeason = seasons.find((s) => s.id === selectedSeasonId)
  const backHref = selectedSeasonId
    ? `/scoreboard?season=${selectedSeasonId === 'all' ? 'all' : (currentSelectedSeason?.number || selectedSeasonId)}`
    : '/scoreboard'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b101b]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <BackButton href={backHref} label="Back to Top 100" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1 uppercase">
              Season:
            </span>
            {seasons.map((s) => {
              const isSelected = selectedSeasonId === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSeasonChange(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'
                  }`}
                >
                  <span>Season #{s.number}</span>
                  {s.status === 'active' && (
                    <span className="text-[10px] px-1 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                      LIVE
                    </span>
                  )}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => handleSeasonChange('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs ${
                selectedSeasonId === 'all'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/50'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white'
              }`}
            >
              <span>🌐 All Season</span>
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
          <div>
            Menampilkan peringkat:{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {selectedSeasonId === 'all'
                ? 'Seluruh Musim (All Season)'
                : currentSelectedSeason
                ? currentSelectedSeason.name
                : 'Musim Terpilih'}
            </span>
          </div>
          <span>Showing {leaderboard.length} users</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader fullscreen color="text-orange-500" />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <ScoreboardTable
              leaderboard={leaderboard}
              currentUsername={user?.username}
              seasonId={selectedSeasonId}
            />
          </motion.div>
        )}
      </div>
    </div>
  )
}
