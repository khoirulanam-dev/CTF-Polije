"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Trophy, Medal, Award, Flame, Shield, Flag, Calendar, Users, Target, ArrowRight } from 'lucide-react'

import TitlePage from '@/components/custom/TitlePage'
import Footer from '@/components/custom/Footer'
import Loader from '@/components/custom/loading'
import ImageWithFallback from '@/components/ImageWithFallback'
import { getPublicSeasons, getSeasonArchives } from '@/lib/seasons'
import { Season, SeasonArchive, TopPlayerArchive, TopChallengeArchive } from '@/types'

let cachedSeasonsState: {
  seasons: Season[]
  archives: SeasonArchive[]
  selectedSeasonNumber: number
} | null = null

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>(() => cachedSeasonsState?.seasons || [])
  const [archives, setArchives] = useState<SeasonArchive[]>(() => cachedSeasonsState?.archives || [])
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const sParam = new URLSearchParams(window.location.search).get('season')
      if (sParam) return parseInt(sParam) || 1
    }
    return cachedSeasonsState?.selectedSeasonNumber || 1
  })
  const [loading, setLoading] = useState(() => !cachedSeasonsState)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!cachedSeasonsState) setLoading(true)
        const [publicSeasons, seasonArchives] = await Promise.all([
          getPublicSeasons(),
          getSeasonArchives(),
        ])

        if (!mounted) return
        setSeasons(publicSeasons)
        setArchives(seasonArchives)

        let initialNumber = selectedSeasonNumber
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const sParam = params.get('season')
          if (sParam) {
            initialNumber = parseInt(sParam) || 1
          } else if (!cachedSeasonsState) {
            if (seasonArchives.length > 0) {
              initialNumber = seasonArchives[0].season_number
            } else if (publicSeasons.length > 0) {
              initialNumber = publicSeasons[0].number
            }
          }
        }
        setSelectedSeasonNumber(initialNumber)

        cachedSeasonsState = {
          seasons: publicSeasons,
          archives: seasonArchives,
          selectedSeasonNumber: initialNumber,
        }
      } catch (err) {
        console.error('Error fetching season data:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => { mounted = false }
  }, [selectedSeasonNumber])

  const currentSeason = seasons.find((s) => s.number === selectedSeasonNumber) || null
  const currentArchive = archives.find((a) => a.season_number === selectedSeasonNumber) || null

  const topPlayers: TopPlayerArchive[] = currentArchive?.top_players || []
  const top1 = topPlayers[0] || null
  const top2 = topPlayers[1] || null
  const top3 = topPlayers[2] || null
  const otherPlayers = topPlayers.slice(3)

  const topChallenges: TopChallengeArchive[] = currentArchive?.top_challenges || []
  const mostSolved = topChallenges.length > 0 ? topChallenges[0] : null
  const hardestSolved = topChallenges.length > 1 ? [...topChallenges].sort((a, b) => a.solves_count - b.solves_count)[0] : null

  if (loading && seasons.length === 0 && archives.length === 0) {
    return (
      <div className="flex flex-col min-h-[calc(100lvh-60px)] bg-slate-950 text-slate-100 items-center justify-center space-y-4">
        <Loader size={48} color="text-orange-500" />
        <p className="text-sm font-medium text-slate-400">Memuat riwayat season &amp; Hall of Fame...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100lvh-60px)] bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden
        className="fixed inset-0 -z-30 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.12)_0%,_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(79,70,229,0.12)_0%,_transparent_60%)]"
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-20 pointer-events-none opacity-15 bg-[repeating-linear-gradient(180deg,_rgba(148,163,184,0.12)_0px,_rgba(148,163,184,0.12)_2px,_transparent_2px,_transparent_6px)]"
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Title */}
        <div className="text-center space-y-3">
          <TitlePage>🏆 Hall of Fame &amp; Riwayat Season</TitlePage>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
            Jejak kejayaan para peretas dan klasemen akhir musim-musim kompetisi di platform ctfpolije.my.id.
          </p>
        </div>

        {/* Season Selector Tabs */}
        <div className="flex items-center justify-center gap-2 flex-wrap pb-2">
          {seasons.length > 0 ? (
            seasons.map((s) => {
              const isSelected = s.number === selectedSeasonNumber
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSeasonNumber(s.number)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-blue-400/50'
                      : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300'
                  }`}
                >
                  <span>Season #{s.number}: {s.name}</span>
                  {s.status === 'active' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                      LIVE
                    </span>
                  )}
                  {s.status === 'draft' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 font-bold flex items-center gap-1">
                      <span>🚀</span> SOON
                    </span>
                  )}
                  {s.status === 'archived' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                      ARSIP
                    </span>
                  )}
                </button>
              )
            })
          ) : (
            <button
              onClick={() => setSelectedSeasonNumber(1)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
            >
              Season 1 (Arsip)
            </button>
          )}
        </div>

        {/* Active Season Banner if selected is Active */}
        {currentSeason?.status === 'active' && !currentArchive && (
          <div className="p-8 rounded-3xl bg-gradient-to-br from-blue-950/60 via-slate-900/80 to-slate-950 border border-blue-500/30 text-center space-y-4 shadow-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              MUSIM SEDANG BERJALAN
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              {currentSeason.name}
            </h3>
            <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
              {currentSeason.description || 'Kompetisi musim ini sedang berlangsung aktif! Tantang dirimu dan selesaikan seluruh soal untuk mencetak poin.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
              <Link
                href="/challenges"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 transition flex items-center gap-2"
              >
                🚩 Buka Tantangan Soal <ArrowRight size={16} />
              </Link>
              <Link
                href="/scoreboard"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm transition flex items-center gap-2"
              >
                🏆 Klasemen Live Scoreboard
              </Link>
            </div>
          </div>
        )}

        {/* Draft / Upcoming Season Banner if selected is Draft */}
        {currentSeason?.status === 'draft' && (
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-violet-950/50 via-slate-900/90 to-slate-950 border border-violet-500/30 text-center space-y-5 shadow-2xl relative overflow-hidden">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/40 text-violet-300 text-xs font-bold tracking-wider uppercase">
              <span className="h-2 w-2 rounded-full bg-violet-400 animate-ping" />
              <span>🚀 COMING SOON</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {currentSeason.name}
            </h3>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              {currentSeason.description || 'Musim kompetisi baru sedang dalam tahap persiapan matang oleh tim developer dan pembuat soal CTF Politeknik Negeri Jember. Soal-soal baru yang menantang akan segera dibuka untuk seluruh peserta.'}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto pt-2 text-left">
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400 font-medium">Status Kompetisi</div>
                <div className="text-sm font-bold text-violet-300 flex items-center gap-1.5">
                  <span>🔒</span> Menunggu Rilis
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400 font-medium">Klasemen & Poin</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>✨</span> Mulai 0 Poin
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <div className="text-xs text-slate-400 font-medium">First Blood</div>
                <div className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  <span>🩸</span> Siap Diperebutkan
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
              <Link
                href="/challenges"
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 transition flex items-center gap-2"
              >
                <span>🚩</span> Buka Soal Musim Aktif
              </Link>
            </div>
          </div>
        )}

        {/* Podium Hall of Fame (Top 3) */}
        {topPlayers.length > 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
                <Trophy className="text-amber-400" size={22} />
                Podium Juara Season #{selectedSeasonNumber}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Tiga peretas terbaik peraih akumulasi skor tertinggi di akhir musim
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end max-w-4xl mx-auto pt-8">
              {/* Rank 2 (Silver) */}
              {top2 && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="order-2 md:order-1 p-6 rounded-2xl bg-gradient-to-b from-slate-800/80 via-slate-900/90 to-slate-950 border border-slate-400/30 text-center relative shadow-xl backdrop-blur-md"
                >
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-slate-300 text-slate-900 font-extrabold text-lg shadow-lg ring-4 ring-slate-800">
                    🥈
                  </div>
                  <div className="mt-4 flex justify-center">
                    <div className="relative">
                      <ImageWithFallback
                        src={top2.avatar_url || ''}
                        alt={top2.username}
                        size={64}
                        className="rounded-full ring-2 ring-slate-300"
                      />
                    </div>
                  </div>
                  <h4 className="font-bold text-base text-slate-100 mt-3 truncate">
                    {top2.username}
                  </h4>
                  <div className="text-xs text-slate-400">Juara 2</div>
                  <div className="text-xl font-extrabold text-slate-200 mt-2 font-mono">
                    {top2.score.toLocaleString()} <span className="text-xs font-normal text-slate-400">pts</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    🎯 {top2.total_solves} Solves
                  </div>
                </motion.div>
              )}

              {/* Rank 1 (Gold) */}
              {top1 && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="order-1 md:order-2 p-7 rounded-3xl bg-gradient-to-b from-amber-500/20 via-slate-900/95 to-slate-950 border-2 border-amber-400/50 text-center relative shadow-2xl shadow-amber-500/10 backdrop-blur-md md:-translate-y-4"
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 text-slate-950 font-black text-2xl shadow-xl shadow-amber-400/30 ring-4 ring-slate-900">
                    👑
                  </div>
                  <div className="mt-5 flex justify-center">
                    <div className="relative">
                      <ImageWithFallback
                        src={top1.avatar_url || ''}
                        alt={top1.username}
                        size={80}
                        className="rounded-full ring-4 ring-amber-400 shadow-xl"
                      />
                    </div>
                  </div>
                  <h4 className="font-black text-lg text-amber-200 mt-3 truncate">
                    {top1.username}
                  </h4>
                  <div className="text-xs font-semibold text-amber-400">Juara 1 &bull; Champion</div>
                  <div className="text-2xl font-black text-amber-300 mt-2 font-mono">
                    {top1.score.toLocaleString()} <span className="text-xs font-normal text-amber-400/80">pts</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    🎯 {top1.total_solves} Solves Selesai
                  </div>
                </motion.div>
              )}

              {/* Rank 3 (Bronze) */}
              {top3 && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="order-3 p-6 rounded-2xl bg-gradient-to-b from-amber-900/30 via-slate-900/90 to-slate-950 border border-amber-700/30 text-center relative shadow-xl backdrop-blur-md"
                >
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-amber-700 text-amber-100 font-extrabold text-lg shadow-lg ring-4 ring-slate-800">
                    🥉
                  </div>
                  <div className="mt-4 flex justify-center">
                    <div className="relative">
                      <ImageWithFallback
                        src={top3.avatar_url || ''}
                        alt={top3.username}
                        size={64}
                        className="rounded-full ring-2 ring-amber-600"
                      />
                    </div>
                  </div>
                  <h4 className="font-bold text-base text-slate-100 mt-3 truncate">
                    {top3.username}
                  </h4>
                  <div className="text-xs text-slate-400">Juara 3</div>
                  <div className="text-xl font-extrabold text-amber-400/90 mt-2 font-mono">
                    {top3.score.toLocaleString()} <span className="text-xs font-normal text-slate-400">pts</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    🎯 {top3.total_solves} Solves
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Season Statistics Summary */}
        {currentArchive && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Target size={15} /> Total Tantangan
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {currentArchive.stats.total_challenges || 0} Soal
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Flame size={15} className="text-amber-400" /> Total Solves
              </div>
              <div className="text-2xl font-bold text-amber-300 mt-1">
                {currentArchive.stats.total_solves || 0}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Users size={15} /> Total Peserta
              </div>
              <div className="text-2xl font-bold text-white mt-1">
                {currentArchive.stats.total_users || 0} Hacker
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Calendar size={15} /> Status Musim
              </div>
              <div className="text-sm font-semibold text-slate-200 mt-1">
                Diarsipkan &bull; Permanen
              </div>
            </div>
          </div>
        )}

        {/* Highlights: Top Soal Favorit & Tersulit */}
        {(mostSolved || hardestSolved) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mostSolved && (
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <Flame size={12} /> Soal Paling Populer (Solves Terbanyak)
                  </span>
                  <span className="text-xs text-slate-400">{mostSolved.category}</span>
                </div>
                <h4 className="font-bold text-base text-slate-100">{mostSolved.title}</h4>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>🎯 {mostSolved.solves_count} Peserta Berhasil Solve</span>
                  <span>⭐ {mostSolved.points} Poin</span>
                </div>
              </div>
            )}

            {hardestSolved && (
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20 flex items-center gap-1">
                    <Shield size={12} /> Soal Paling Tangguh (Paling Sedikit Solves)
                  </span>
                  <span className="text-xs text-slate-400">{hardestSolved.category}</span>
                </div>
                <h4 className="font-bold text-base text-slate-100">{hardestSolved.title}</h4>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>🎯 Hanya {hardestSolved.solves_count} Peserta Berhasil Solve</span>
                  <span>⭐ {hardestSolved.points} Poin</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full Leaderboard Table of Archived Season */}
        {otherPlayers.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-200">
              Klasemen Lengkap Season #{selectedSeasonNumber}
            </h3>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-400">
                    <tr>
                      <th className="px-5 py-3 w-16 text-center">Rank</th>
                      <th className="px-5 py-3">Hacker / Peserta</th>
                      <th className="px-5 py-3 text-center">Solves</th>
                      <th className="px-5 py-3 text-right">Skor Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {otherPlayers.map((player) => (
                      <tr key={player.user_id} className="hover:bg-slate-800/30 transition">
                        <td className="px-5 py-3 text-center font-mono font-bold text-slate-400">
                          #{player.rank}
                        </td>
                        <td className="px-5 py-3 flex items-center gap-3">
                          <ImageWithFallback
                            src={player.avatar_url || ''}
                            alt={player.username}
                            size={30}
                            className="rounded-full"
                          />
                          <span className="font-semibold text-slate-100">{player.username}</span>
                        </td>
                        <td className="px-5 py-3 text-center font-mono text-slate-300">
                          {player.total_solves}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-blue-400">
                          {player.score.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
