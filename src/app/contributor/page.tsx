'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { 
  Plus, Edit3, Trash2, Eye, Flag, AlertCircle, 
  CheckCircle2, RefreshCw, ArrowLeft, Lock, FileText,
  Calendar, Award, Sparkles, ExternalLink
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isContributor, isAdmin } from '@/lib/auth'
import { getPublicSeasons } from '@/lib/seasons'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import DifficultyBadge from '@/components/custom/DifficultyBadge'
import CustomBadge from '@/components/ui/CustomBadge'
import { Season, Attachment } from '@/types'
import { parseChallengeHints, ChallengeHintItem, validateHintCost } from '@/lib/hints'

const CATEGORIES = ['Web Exploitation', 'Cryptography', 'Forensics', 'Reverse Engineering', 'Binary Exploitation', 'OSINT', 'Misc', 'Intro']
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Impossible']

export default function ContributorPage() {
  const router = useRouter()
  const { user, loading } = useAuth()

  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [challenges, setChallenges] = useState<any[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Filter
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Form modal state
  const [formOpen, setFormOpen] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Flag view modal state
  const [flagModalOpen, setFlagModalOpen] = useState(false)
  const [viewingFlag, setViewingFlag] = useState<{ title: string; flag: string } | null>(null)

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingLoading, setDeletingLoading] = useState(false)

  // Form fields
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Web Exploitation',
    points: 100 as number | '',
    max_points: '' as number | '',
    difficulty: 'Medium',
    flag: '',
    is_dynamic: false,
    min_points: '' as number | '',
    decay_per_solve: '' as number | '',
    season_id: '',
    hint: [] as ChallengeHintItem[],
    attachments: [] as Attachment[],
  })

  // 1. Auth & role check
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }

    const checkRole = async () => {
      // 1. Admin dilarang keras akses /contributor - langsung redirect ke /admin
      if (user.is_admin || user.role === 'admin') {
        toast.error('Admin mengelola tantangan melalui Panel Admin.')
        router.replace('/admin')
        return
      }

      const admin = await isAdmin()
      if (admin) {
        toast.error('Admin mengelola tantangan melalui Panel Admin.')
        router.replace('/admin')
        return
      }

      // 2. Hanya kontributor yang boleh akses
      const isContribRole = (user.role === 'contributor' || user.is_contributor) && !user.is_admin
      const contrib = isContribRole || (await isContributor())
      if (!contrib) {
        toast.error('Akses ditolak: Halaman ini khusus untuk pembuat/kontributor soal.')
        router.replace('/challenges')
        return
      }
      setAuthorized(true)
    }

    checkRole()
  }, [user, loading, router])

  // 2. Fetch data (challenges & seasons)
  const fetchData = async () => {
    try {
      setLoadingData(true)
      const token = (await import('@/lib/supabase')).supabase.auth.getSession().then(({ data }) => data.session?.access_token || '')
      const authToken = await token

      const [chalRes, seaData] = await Promise.all([
        fetch('/api/contributor/challenges', {
          headers: { Authorization: `Bearer ${authToken}` }
        }).then(r => r.json()),
        getPublicSeasons().catch(() => [])
      ])

      if (chalRes.challenges) {
        setChallenges(chalRes.challenges)
      } else if (chalRes.error) {
        toast.error(chalRes.error)
      }

      setSeasons(seaData || [])
    } catch (err: any) {
      console.error('Failed to load contributor data:', err)
      toast.error('Gagal memuat data soal kontributor')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (authorized) {
      fetchData()
    }
  }, [authorized])

  // Only allowed seasons for contributor (active and draft, NO archived)
  const allowedSeasons = useMemo(() => {
    return seasons.filter(s => s.status === 'active' || s.status === 'draft')
  }, [seasons])

  // Filtered challenges
  const filteredChallenges = useMemo(() => {
    return challenges.filter(c => {
      const matchesSeason = selectedSeasonFilter === 'all'
        ? true
        : c.season_id === selectedSeasonFilter

      const matchesSearch = searchQuery.trim() === '' || 
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesSeason && matchesSearch
    })
  }, [challenges, selectedSeasonFilter, searchQuery])

  // Open Form for New Challenge
  const handleOpenAdd = () => {
    const defaultSeason = allowedSeasons.find(s => s.status === 'active') || allowedSeasons[0]
    if (!defaultSeason) {
      toast.error('Belum ada season yang tersedia untuk upload soal.')
      return
    }

    setEditingChallenge(null)
    setFormData({
      title: '',
      description: '',
      category: 'Web Exploitation',
      points: 100,
      max_points: '',
      difficulty: 'Medium',
      flag: '',
      is_dynamic: false,
      min_points: '',
      decay_per_solve: '',
      season_id: defaultSeason.id,
      hint: [] as ChallengeHintItem[],
      attachments: [],
    })
    setShowPreview(false)
    setFormOpen(true)
  }

  // Open Form for Editing Challenge
  const handleOpenEdit = (ch: any) => {
    const fallbackSeason = allowedSeasons.find(s => s.status === 'active') || allowedSeasons[0]
    setEditingChallenge(ch)
    setFormData({
      title: ch.title || '',
      description: ch.description || '',
      category: ch.category || 'Web Exploitation',
      points: ch.points || 100,
      max_points: ch.max_points || '',
      difficulty: ch.difficulty || 'Medium',
      flag: ch.flag || '',
      is_dynamic: Boolean(ch.is_dynamic),
      min_points: ch.min_points || '',
      decay_per_solve: ch.decay_per_solve || '',
      season_id: ch.season_id || fallbackSeason?.id || '',
      hint: parseChallengeHints(ch.hint, ch.points),
      attachments: ch.attachments || [],
    })
    setShowPreview(false)
    setFormOpen(true)
  }

  // Form Submit (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 1. Validasi Flag POLIJE{.......}
    const cleanFlag = formData.flag.trim()
    if (!cleanFlag && !editingChallenge) {
      toast.error('Flag wajib diisi!')
      return
    }

    if (cleanFlag) {
      const flagRegex = /^POLIJE\{[ -~]+\}$/
      if (!flagRegex.test(cleanFlag)) {
        toast.error('Format flag tidak sesuai! Flag WAJIB menggunakan format: POLIJE{.......}')
        return
      }
    }

    // 2. Season wajib dipilih dan harus aktif atau draft.
    if (!formData.season_id || formData.season_id === 'none') {
      toast.error('Pilih season terlebih dahulu sebelum menyimpan soal.')
      return
    }

    const targetSeason = allowedSeasons.find(s => s.id === formData.season_id)
    if (!targetSeason) {
      toast.error('Season tidak tersedia atau sudah berakhir.')
      return
    }

    // 3. Validasi Hint untuk Kontributor (maksimal 50 poin untuk berbayar)
    const activeHints = formData.hint.filter(h => (h.content || '').trim() !== '')

    for (let i = 0; i < activeHints.length; i++) {
      const h = activeHints[i]
      const cost = Number(h.cost) || 0
      if (cost > 0 && (cost < 1 || cost > 50)) {
        toast.error(`Hint #${i + 1} berbayar harus bernilai antara 1 sampai 50 poin!`)
        return
      }
    }

    setSubmitting(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const payload = {
        challengeId: editingChallenge?.id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        points: Number(formData.points) || 100,
        max_points: formData.max_points ? Number(formData.max_points) : null,
        difficulty: formData.difficulty,
        is_dynamic: formData.is_dynamic,
        min_points: formData.min_points ? Number(formData.min_points) : 0,
        decay_per_solve: formData.decay_per_solve ? Number(formData.decay_per_solve) : 0,
        season_id: formData.season_id,
        hint: activeHints.map(h => ({
          content: h.content.trim(),
          cost: Math.max(0, Math.min(50, Number(h.cost) || 0)),
        })),
        attachments: formData.attachments.filter(a => a.url?.trim() !== ''),
        flag: cleanFlag,
      }

      const method = editingChallenge ? 'PUT' : 'POST'
      const res = await fetch('/api/contributor/challenges', {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Gagal menyimpan soal')
      }

      toast.success(editingChallenge ? 'Soal berhasil diperbarui!' : 'Soal baru berhasil ditambahkan!')
      setFormOpen(false)
      fetchData()
    } catch (err: any) {
      console.error('Submit error:', err)
      toast.error(err.message || 'Gagal menyimpan tantangan')
    } finally {
      setSubmitting(false)
    }
  }

  // Delete challenge handler
  const handleDelete = async () => {
    if (!deletingId) return
    setDeletingLoading(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(`/api/contributor/challenges?id=${deletingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Gagal menghapus soal')
      }

      toast.success('Soal berhasil dihapus')
      setDeleteModalOpen(false)
      setDeletingId(null)
      fetchData()
    } catch (err: any) {
      console.error('Delete error:', err)
      toast.error(err.message || 'Gagal menghapus soal')
    } finally {
      setDeletingLoading(false)
    }
  }

  if (loading || authorized === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 font-mono">
        <RefreshCw className="animate-spin text-purple-400 mr-2" size={20} />
        <span>Memverifikasi hak akses kontributor...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Top Header Banner */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-500/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={13} className="text-purple-400" />
                  Role Kontributor Soal
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  @{user?.username}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Panel Kontribusi Soal
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Buat dan kelola tantangan CTF buatan Anda untuk musim aktif maupun draft musim berikutnya. Seluruh soal buatan Anda akan tampil di daftar soal peserta.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap shrink-0">
              <Link
                href="/challenges"
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-2 shadow-sm"
              >
                <ArrowLeft size={15} />
                <span>Lihat Halaman Soal</span>
              </Link>
              <Button
                onClick={handleOpenAdd}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
              >
                <Plus size={18} />
                <span>Buat Soal Baru</span>
              </Button>
            </div>
          </div>

          {/* Quick Notice Banner */}
          <div className="mt-6 pt-4 border-t border-purple-500/20 flex items-center gap-2 text-xs text-purple-200/90 font-mono">
            <AlertCircle size={15} className="text-amber-400 shrink-0" />
            <span>
              <strong>Peraturan Kontributor:</strong> Soal hanya dapat didaftarkan pada season <em>Live (Aktif)</em> atau <em>Coming Soon (Draft)</em>. Format Flag wajib <code className="bg-purple-900/60 px-1.5 py-0.5 rounded text-pink-300 font-bold">POLIJE&#123;...&#125;</code>.
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-400 font-medium">Total Soal Buatan Saya</p>
            <p className="text-2xl font-extrabold text-white mt-1 font-mono">{challenges.length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-400 font-medium">Total Solves (Peserta)</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
              {challenges.reduce((acc, c) => acc + (c.total_solves || 0), 0)}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-400 font-medium">Season Diizinkan</p>
            <p className="text-2xl font-extrabold text-purple-400 mt-1 font-mono">{allowedSeasons.length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-400 font-medium">Status Akun</p>
            <p className="text-sm font-bold text-blue-400 mt-2 font-mono flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-blue-400" />
              Kontributor Aktif
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs font-semibold text-slate-400">Filter Season:</div>
            <Select value={selectedSeasonFilter} onValueChange={setSelectedSeasonFilter}>
              <SelectTrigger className="w-52 bg-slate-950 border-slate-700 text-xs">
                <SelectValue placeholder="Pilih Season" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                <SelectItem value="all">Semua Soal ({challenges.length})</SelectItem>
                {seasons.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    Season #{s.number}: {s.name} ({s.status.toUpperCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-72">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari judul soal atau kategori..."
              className="bg-slate-950 border-slate-700 text-xs text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Challenges List Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden">
          {loadingData ? (
            <div className="py-20 text-center text-slate-400 font-mono text-sm flex items-center justify-center gap-2">
              <RefreshCw className="animate-spin text-purple-400" size={18} />
              <span>Memuat tantangan Anda...</span>
            </div>
          ) : filteredChallenges.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="text-4xl">📝</div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Belum Ada Tantangan</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery 
                    ? 'Tidak ada tantangan yang cocok dengan pencarian Anda.' 
                    : 'Anda belum membuat tantangan untuk filter ini. Mulai buat tantangan pertama Anda!'}
                </p>
              </div>
              <Button
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition"
              >
                + Buat Soal Sekarang
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3.5 px-4 font-semibold">Tantangan</th>
                    <th className="py-3.5 px-4 font-semibold">Kategori</th>
                    <th className="py-3.5 px-4 font-semibold">Difficulty</th>
                    <th className="py-3.5 px-4 font-semibold">Poin</th>
                    <th className="py-3.5 px-4 font-semibold">Season</th>
                    <th className="py-3.5 px-4 font-semibold">Solves</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredChallenges.map(c => {
                    const season = c.seasons
                    const isDraft = season?.status === 'draft'
                    const isLive = season?.status === 'active'

                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-4">
                          <div className="font-bold text-white text-sm">{c.title}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Author: @{c.author || user?.username}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <CustomBadge label={c.category} color="bg-blue-900/60 text-blue-300 border-blue-700/50" />
                        </td>
                        <td className="py-4 px-4">
                          <DifficultyBadge difficulty={c.difficulty} />
                        </td>
                        <td className="py-4 px-4 font-mono font-bold text-amber-300">
                          🪙 {c.points}
                        </td>
                        <td className="py-4 px-4">
                          {season ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isLive 
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : isDraft
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : 'bg-slate-700 text-slate-300 border-slate-600'
                            }`}>
                              S#{season.number}: {season.name} ({season.status.toUpperCase()})
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px]">Global</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-slate-300">
                          {c.total_solves || 0} solves
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {c.flag && (
                              <button
                                type="button"
                                title="Lihat Flag"
                                onClick={() => {
                                  setViewingFlag({ title: c.title, flag: c.flag })
                                  setFlagModalOpen(true)
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                              >
                                <Flag size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Edit Soal"
                              onClick={() => handleOpenEdit(c)}
                              className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 transition"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              title="Hapus Soal"
                              onClick={() => {
                                setDeletingId(c.id)
                                setDeleteModalOpen(true)
                              }}
                              className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-300 transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* MODAL: Form Tambah / Edit Challenge */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl w-full bg-slate-900 border border-slate-700 text-slate-100 shadow-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto font-sans scroll-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <span>{editingChallenge ? '✏ Edit Tantangan' : '➕ Buat Tantangan Baru'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Dynamic Author Badge */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-purple-300 font-semibold">Author (Dinamis):</span>
                <span className="font-mono font-bold text-white">@{editingChallenge?.author || user?.username}</span>
              </div>
              <span className="text-[11px] text-purple-300/80 italic">Otomatis dari akun login Anda</span>
            </div>

            {/* Target Season (Restricted to Active & Draft) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-slate-300">Target Season</Label>
                <span className="text-[11px] text-amber-400 font-mono">Hanya Season Live &amp; Coming Soon</span>
              </div>
              <Select
                value={formData.season_id}
                onValueChange={v => setFormData(prev => ({ ...prev, season_id: v }))}
              >
                <SelectTrigger className="bg-slate-950 border-slate-700 text-xs">
                  <SelectValue placeholder="Pilih Season..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                  {allowedSeasons.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      Season #{s.number}: {s.name} ({s.status === 'active' ? 'LIVE' : 'COMING SOON'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title & Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-300 mb-1">Judul Soal</Label>
                <Input
                  required
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Misal: Web Token Hijack"
                  className="bg-slate-950 border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-300 mb-1">Kategori</Label>
                <Select
                  value={formData.category}
                  onValueChange={v => setFormData(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Points & Difficulty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-300 mb-1">Poin</Label>
                <Input
                  type="number"
                  min={1}
                  required
                  value={formData.points}
                  onChange={e => setFormData(prev => ({ ...prev, points: e.target.value === '' ? '' : Number(e.target.value) }))}
                  className="bg-slate-950 border-slate-700 text-xs font-mono text-white"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-300 mb-1">Difficulty</Label>
                <Select
                  value={formData.difficulty}
                  onValueChange={v => setFormData(prev => ({ ...prev, difficulty: v }))}
                >
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    {DIFFICULTIES.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description with Markdown Preview */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-slate-300">Deskripsi Tantangan</Label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition"
                >
                  {showPreview ? 'Kembali ke Edit' : 'Lihat Preview Markdown'}
                </button>
              </div>

              {showPreview ? (
                <div className="border border-slate-700 rounded-xl p-4 bg-slate-950 text-xs font-sans min-h-[120px] max-h-60 overflow-y-auto">
                  <MarkdownRenderer content={formData.description || '*Belum ada deskripsi*'} />
                </div>
              ) : (
                <Textarea
                  required
                  rows={5}
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Deskripsi soal, cerita latar, atau instruksi pengerjaan..."
                  className="bg-slate-950 border-slate-700 text-xs text-white font-mono"
                />
              )}
            </div>

            {/* Flag Input with Strict POLIJE{...} validation */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-slate-300">Flag Jawaban</Label>
                <span className="text-[11px] font-mono text-slate-400">
                  Format wajib: <span className="text-pink-400 font-bold">POLIJE&#123;.......&#125;</span>
                </span>
              </div>
              <Input
                required={!editingChallenge}
                value={formData.flag}
                onChange={e => setFormData(prev => ({ ...prev, flag: e.target.value }))}
                placeholder={editingChallenge ? 'Biarkan kosong untuk mempertahankan flag lama' : 'POLIJE{jawaban_rahasia_anda}'}
                className={`font-mono text-xs text-white bg-slate-950 border ${
                  formData.flag && !/^POLIJE\{[ -~]+\}$/.test(formData.flag.trim())
                    ? 'border-red-500 focus:ring-red-400'
                    : 'border-slate-700 focus:ring-purple-400'
                }`}
              />
              {formData.flag && !/^POLIJE\{[ -~]+\}$/.test(formData.flag.trim()) && (
                <p className="text-xs text-red-400 font-mono mt-1">
                  ⚠ Format tidak valid! Flag harus diawali dengan &quot;POLIJE&#123;&quot; dan diakhiri dengan &quot;&#125;&quot;.
                </p>
              )}
            </div>

            {/* Hints Section */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-slate-300">Hints (Petunjuk Opsional)</Label>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, hint: [...(prev.hint || []), { content: '', cost: 0 }] }))}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300"
                >
                  + Tambah Hint
                </button>
              </div>
              {(!formData.hint || formData.hint.length === 0) ? (
                <p className="text-xs text-slate-500 italic">Belum ada petunjuk (hints) ditambahkan</p>
              ) : (
                <div className="space-y-3 mt-2">
                  {formData.hint.map((h: any, idx: number) => {
                    const content = typeof h === 'string' ? h : (h?.content || '')
                    const cost = typeof h === 'string' ? 10 : (h?.cost ?? 0)
                    const isFree = cost === 0
                    return (
                      <div key={idx} className="p-3 border border-slate-800 rounded-lg bg-slate-950/70 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-purple-300">
                            Hint #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = (formData.hint || []).filter((_: any, i: number) => i !== idx)
                              setFormData(prev => ({ ...prev, hint: next }))
                            }}
                            className="text-xs text-slate-400 hover:text-red-400 transition"
                          >
                            ✕ Hapus
                          </button>
                        </div>
                        <Input
                          value={content}
                          onChange={e => {
                            const next = [...formData.hint]
                            next[idx] = { content: e.target.value, cost }
                            setFormData(prev => ({ ...prev, hint: next }))
                          }}
                          placeholder={`Isi petunjuk (hint) #${idx + 1}...`}
                          className="bg-slate-900 border-slate-700 text-xs text-white placeholder:text-slate-600"
                        />
                        <div className="flex flex-wrap items-center gap-3 pt-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 font-medium">Tipe:</span>
                            <div className="flex rounded-md border border-slate-700 overflow-hidden text-xs">
                              <button
                                type="button"
                                className={`px-2.5 py-1 font-medium transition ${
                                  isFree
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                                }`}
                                onClick={() => {
                                  const next = [...formData.hint]
                                  next[idx] = { content, cost: 0 }
                                  setFormData(prev => ({ ...prev, hint: next }))
                                }}
                              >
                                Gratis (0 pts)
                              </button>
                              <button
                                type="button"
                                className={`px-2.5 py-1 font-medium transition ${
                                  !isFree
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                                }`}
                                onClick={() => {
                                  const next = [...formData.hint]
                                  const defaultCost = cost > 0 && cost <= 50 ? cost : 10
                                  next[idx] = { content, cost: defaultCost }
                                  setFormData(prev => ({ ...prev, hint: next }))
                                }}
                              >
                                Berbayar
                              </button>
                            </div>
                          </div>

                          {!isFree && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-400 font-medium">Biaya:</span>
                              <Input
                                type="number"
                                min={1}
                                max={50}
                                value={cost || ''}
                                onChange={e => {
                                  const rawVal = parseInt(e.target.value) || 0
                                  const clamped = Math.max(1, Math.min(50, rawVal))
                                  const next = [...formData.hint]
                                  next[idx] = { content, cost: clamped }
                                  setFormData(prev => ({ ...prev, hint: next }))
                                }}
                                placeholder="1 - 50"
                                className="w-20 h-7 text-xs bg-slate-900 border-slate-700 text-white"
                              />
                              <span className="text-[11px] text-amber-400/80 font-mono">
                                (1 - 50 poin)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-slate-300">Lampiran / Link File</Label>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    attachments: [...prev.attachments, { name: '', url: '', type: 'file' }] 
                  }))}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300"
                >
                  + Tambah Lampiran
                </button>
              </div>
              {formData.attachments.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Belum ada lampiran</p>
              ) : (
                <div className="space-y-2 mt-1">
                  {formData.attachments.map((att, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        value={att.name}
                        onChange={e => {
                          const next = [...formData.attachments]
                          next[idx] = { ...next[idx], name: e.target.value }
                          setFormData(prev => ({ ...prev, attachments: next }))
                        }}
                        placeholder="Nama file / Label"
                        className="col-span-4 bg-slate-950 border-slate-700 text-xs text-white"
                      />
                      <Input
                        value={att.url}
                        onChange={e => {
                          const next = [...formData.attachments]
                          next[idx] = { ...next[idx], url: e.target.value }
                          setFormData(prev => ({ ...prev, attachments: next }))
                        }}
                        placeholder="https://... atau /files/..."
                        className="col-span-6 bg-slate-950 border-slate-700 text-xs text-white font-mono"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = formData.attachments.filter((_, i) => i !== idx)
                          setFormData(prev => ({ ...prev, attachments: next }))
                        }}
                        className="col-span-2 text-slate-400 hover:text-red-400"
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFormOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
              >
                {submitting ? 'Menyimpan...' : (editingChallenge ? 'Simpan Perubahan' : 'Terbitkan Soal')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Lihat Flag */}
      <Dialog open={flagModalOpen} onOpenChange={setFlagModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Flag size={16} className="text-pink-400" />
              <span>Flag Soal: {viewingFlag?.title}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-pink-300 break-all select-all mt-2">
            {viewingFlag?.flag}
          </div>
          <DialogFooter className="mt-4 flex justify-end">
            <Button
              type="button"
              onClick={() => {
                if (viewingFlag?.flag) {
                  navigator.clipboard.writeText(viewingFlag.flag)
                  toast.success('Flag berhasil disalin!')
                }
                setFlagModalOpen(false)
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
            >
              Salin &amp; Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Konfirmasi Hapus */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md bg-slate-900 border border-slate-700 text-slate-100 rounded-2xl p-6 font-sans">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-400 flex items-center gap-2">
              <Trash2 size={16} />
              <span>Hapus Tantangan?</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            Apakah Anda yakin ingin menghapus tantangan ini? Tantangan dan seluruh data flag akan dihapus secara permanen.
          </p>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteModalOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={deletingLoading}
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
            >
              {deletingLoading ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
