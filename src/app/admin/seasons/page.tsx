"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trophy, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  Archive, 
  AlertTriangle, 
  Trash2, 
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldAlert,
  Copy,
  Check,
  Eye
} from 'lucide-react'

import BackButton from '@/components/custom/BackButton'
import Loader from '@/components/custom/loading'
import TitlePage from '@/components/custom/TitlePage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface SeasonItem {
  id: string
  number: number
  name: string
  description?: string | null
  status: 'draft' | 'active' | 'archived'
  started_at?: string | null
  ended_at?: string | null
  challenge_count?: number
  active_challenge_count?: number
}

export default function AdminSeasonsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [seasons, setSeasons] = useState<SeasonItem[]>([])
  const [activeSeason, setActiveSeason] = useState<SeasonItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)

  // Dialog Buat Season
  const [openCreate, setOpenCreate] = useState(false)
  const [createData, setCreateData] = useState({
    number: 2,
    name: '',
    description: '',
  })
  const [savingCreate, setSavingCreate] = useState(false)

  // Dialog Aktivasi Season
  const [activateTarget, setActivateTarget] = useState<SeasonItem | null>(null)
  const [activating, setActivating] = useState(false)

  // Copy helper
  const [copiedSql, setCopiedSql] = useState(false)

  const fetchSeasons = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/admin/seasons', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()
      if (data.table_missing) {
        setTableMissing(true)
        setSeasons([])
        setActiveSeason(null)
      } else if (res.ok) {
        setTableMissing(false)
        setSeasons(data.seasons || [])
        setActiveSeason(data.activeSeason || null)

        // Tentukan nomor season berikutnya secara otomatis
        const maxNum = (data.seasons || []).reduce((max: number, s: SeasonItem) => Math.max(max, s.number), 1)
        setCreateData((prev) => ({
          ...prev,
          number: maxNum + 1,
          name: `Season ${maxNum + 1}: Cyber Frontier`,
        }))
      } else {
        toast.error(data.error || 'Gagal memuat daftar season')
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Gagal memuat season')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (authLoading) return
      if (!user) {
        router.push('/login')
        return
      }
      const adminCheck = await isAdmin()
      if (!mounted) return
      if (!adminCheck) {
        router.push('/challenges')
        return
      }
      fetchSeasons()
    })()

    return () => { mounted = false }
  }, [user, authLoading, router])

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createData.name.trim()) {
      toast.error('Nama season wajib diisi')
      return
    }

    setSavingCreate(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/admin/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          number: Number(createData.number),
          name: createData.name.trim(),
          description: createData.description.trim(),
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal membuat season')

      toast.success(`Season ${createData.number} berhasil dibuat dalam status Draft!`)
      setOpenCreate(false)
      fetchSeasons()
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat season')
    } finally {
      setSavingCreate(false)
    }
  }

  const handleActivateSeason = async () => {
    if (!activateTarget) return
    setActivating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/admin/seasons/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newSeasonId: activateTarget.id,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal mengaktifkan season')

      toast.success(result.message || 'Season berhasil diaktifkan!')
      setActivateTarget(null)
      fetchSeasons()
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengaktifkan season')
    } finally {
      setActivating(false)
    }
  }

  const handleDeleteSeason = async (s: SeasonItem) => {
    if (!confirm(`Hapus ${s.name}? Soal yang ditautkan ke season ini akan dilepas.`)) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch(`/api/admin/seasons?id=${s.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal menghapus season')

      toast.success('Season berhasil dihapus')
      fetchSeasons()
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus season')
    }
  }

  if (authLoading || loading) return <Loader fullscreen color="text-orange-500" />
  if (!user) return null

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20 relative overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden
        className="fixed inset-0 -z-30 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.12)_0%,_transparent_60%),radial-gradient(ellipse_at_bottom,_rgba(79,70,229,0.12)_0%,_transparent_60%)]"
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <BackButton href="/admin" label="Kembali ke Admin Panel" />
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm font-medium hover:bg-slate-800 text-slate-300 transition flex items-center gap-1.5"
            >
              <Layers size={15} /> Kelola Soal
            </Link>
            <Link
              href="/seasons"
              target="_blank"
              className="px-3.5 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs sm:text-sm font-medium hover:bg-blue-500/20 text-blue-400 transition flex items-center gap-1.5"
            >
              <ExternalLink size={15} /> Lihat Halaman Riwayat Publik
            </Link>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <TitlePage>⚡ Manajemen Season CTF</TitlePage>
            <p className="text-sm text-slate-400 mt-1">
              Atur siklus musim kompetisi, arsipkan data historis (Top Player & Soal), serta siapkan soal baru untuk Season berikutnya.
            </p>
          </div>

          <Button
            onClick={() => setOpenCreate(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2 self-start"
          >
            <Plus size={16} /> Buat Season Baru (Draft)
          </Button>
        </div>

        {/* Missing Table Warning Notice */}
        {tableMissing && (
          <Card className="border-amber-500/30 bg-amber-500/10 text-amber-200">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-300 text-base">Tabel Database Belum Dibuat</h4>
                  <p className="text-xs sm:text-sm text-amber-200/90 mt-1">
                    Tabel <code className="bg-amber-950/60 px-1.5 py-0.5 rounded text-amber-300">public.seasons</code> dan <code className="bg-amber-950/60 px-1.5 py-0.5 rounded text-amber-300">public.season_archives</code> belum ada di database Supabase Anda.
                  </p>
                  <p className="text-xs text-amber-200/80 mt-1">
                    Buka Supabase Dashboard &gt; SQL Editor, lalu jalankan file SQL migrasi yang telah kami siapkan di:
                    <br />
                    <code className="text-xs bg-slate-900 text-slate-200 px-2 py-1 rounded inline-block mt-1 font-mono">
                      supabase/migrations/20260922_seasons_system.sql
                    </code>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Season Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2 bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <CardHeader className="pb-3 border-b border-slate-800/60 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                <CardTitle className="text-slate-100 text-base sm:text-lg flex items-center gap-2">
                  <span>🟢 Season Aktif Saat Ini</span>
                </CardTitle>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                LIVE &amp; SCORING
              </span>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {activeSeason ? (
                <>
                  <div>
                    <h3 className="text-2xl font-black text-white flex items-center gap-2">
                      {activeSeason.name}
                      <span className="text-sm font-normal text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-700">
                        Season #{activeSeason.number}
                      </span>
                    </h3>
                    <p className="text-sm text-slate-300 mt-1 max-w-xl">
                      {activeSeason.description || 'Tidak ada deskripsi season.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="text-xs text-slate-400">Total Soal Season</div>
                      <div className="text-lg font-bold text-white mt-0.5">
                        {activeSeason.challenge_count || 0} Soal
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="text-xs text-slate-400">Status Soal</div>
                      <div className="text-lg font-bold text-emerald-400 mt-0.5">
                        {activeSeason.active_challenge_count || 0} Aktif
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 col-span-2 sm:col-span-1">
                      <div className="text-xs text-slate-400">Dimulai Pada</div>
                      <div className="text-xs sm:text-sm font-medium text-slate-200 mt-1">
                        {activeSeason.started_at ? new Date(activeSeason.started_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-slate-400">
                  <p>Belum ada season aktif. Buat season baru atau jalankan migrasi database.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Guide Card */}
          <Card className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-5 space-y-3">
            <h4 className="font-semibold text-slate-100 flex items-center gap-2">
              <span>💡 Alur Pergantian Season</span>
            </h4>
            <ol className="text-xs text-slate-400 space-y-2.5 list-decimal pl-4">
              <li>
                <strong className="text-slate-200">Buat Season 2 (Draft)</strong>: Buat wadah baru tanpa mempengaruhi soal aktif.
              </li>
              <li>
                <strong className="text-slate-200">Isi Soal di Menu Admin</strong>: Tambahkan soal-soal baru dan tautkan ke Season 2. Soal berstatus draft <em>tidak akan tampil ke user</em>.
              </li>
              <li>
                <strong className="text-slate-200">Klik &quot;Up Season Ini&quot;</strong>: Season 1 akan otomatis diarsipkan bersama snapshot Top Player, dan Season 2 langsung live!
              </li>
            </ol>
          </Card>
        </div>

        {/* Seasons List */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Calendar size={18} className="text-blue-400" />
            Daftar Seluruh Musim (Seasons)
          </h3>

          <div className="grid grid-cols-1 gap-4">
            {seasons.map((s) => (
              <div
                key={s.id}
                className={`p-5 rounded-2xl border transition backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4
                  ${
                    s.status === 'active'
                      ? 'bg-slate-900/90 border-blue-500/40 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500/30'
                      : s.status === 'draft'
                      ? 'bg-slate-900/50 border-amber-500/30 hover:border-amber-500/50'
                      : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                  }`}
              >
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      Season #{s.number}
                    </span>
                    <h4 className="font-bold text-slate-100 text-base">{s.name}</h4>
                    {s.status === 'active' && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Sedang Aktif
                      </span>
                    )}
                    {s.status === 'draft' && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                        Persiapan (Draft)
                      </span>
                    )}
                    {s.status === 'archived' && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 flex items-center gap-1">
                        <Archive size={12} /> Diarsipkan
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-slate-400 line-clamp-2">
                    {s.description || 'Tidak ada keterangan tambahan.'}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
                    <span>
                      📦 <strong>{s.challenge_count || 0} Soal</strong> ({s.active_challenge_count || 0} aktif)
                    </span>
                    {s.status === 'draft' && (
                      <span className="text-amber-400/90 italic">
                        *Soal tersembunyi dari user biasa sampai di-up
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
                  <Link
                    href={`/challenges?preview_season=${s.id}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-xs font-medium text-indigo-300 transition flex items-center gap-1.5"
                    title="Lihat preview tampilan soal di halaman challenges sebagai peserta"
                  >
                    <Eye size={14} /> Preview Soal
                  </Link>

                  <Link
                    href={`/admin?season=${s.id}`}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition"
                  >
                    Kelola Soal ({s.challenge_count || 0})
                  </Link>

                  {s.status === 'draft' && (
                    <>
                      <Button
                        onClick={() => setActivateTarget(s)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-1.5 h-auto rounded-xl font-semibold shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={14} /> Up Season Ini 🚀
                      </Button>
                      <button
                        onClick={() => handleDeleteSeason(s)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                        title="Hapus Draft Season"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}

                  {s.status === 'archived' && (
                    <Link
                      href={`/seasons?season=${s.number}`}
                      target="_blank"
                      className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-blue-400 transition flex items-center gap-1"
                    >
                      <Trophy size={13} /> Lihat Arsip
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Buat Season Baru */}
      <AnimatePresence>
        {openCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5 text-slate-100"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Plus size={18} className="text-blue-400" />
                  Buat Season Baru
                </h3>
                <button
                  onClick={() => setOpenCreate(false)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSeason} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nomor Season</Label>
                    <Input
                      type="number"
                      min={1}
                      value={createData.number}
                      onChange={(e) => setCreateData({ ...createData, number: parseInt(e.target.value) || 1 })}
                      className="bg-slate-950 border-slate-800 text-slate-100"
                      required
                    />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label>Nama Season</Label>
                    <Input
                      value={createData.name}
                      onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                      placeholder="Contoh: Season 2: Cyber Renaissance"
                      className="bg-slate-950 border-slate-800 text-slate-100"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Deskripsi / Tema Kompetisi</Label>
                  <Textarea
                    value={createData.description}
                    onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                    placeholder="Tuliskan tema atau gambaran tantangan di musim ini..."
                    rows={3}
                    className="bg-slate-950 border-slate-800 text-slate-100"
                  />
                </div>

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                  ℹ️ Season baru akan dibuat dalam status <strong>Draft</strong>. Anda dapat menyiapkan soal-soal baru secara leluasa tanpa terlihat oleh user biasa sampai Anda menekan tombol <strong>Up Season Ini</strong>.
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenCreate(false)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingCreate}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                  >
                    {savingCreate ? 'Menyimpan...' : 'Simpan Draft Season'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Aktivasi Season */}
      <AnimatePresence>
        {activateTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5 text-slate-100"
            >
              <div className="flex items-center gap-3 text-emerald-400">
                <div className="p-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">
                    Konfirmasi Peluncuran Season
                  </h3>
                  <p className="text-xs text-slate-400">
                    Aktifkan {activateTarget.name}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p>
                  Dengan mengaktifkan <strong>{activateTarget.name} (Season #{activateTarget.number})</strong>:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400 text-xs">
                  {activeSeason ? (
                    <li>
                      <strong>{activeSeason.name}</strong> akan otomatis diarsipkan. Seluruh riwayat klasemen akhir (Podium Juara 1-3) dan statistik soal tersimpan secara permanen.
                    </li>
                  ) : null}
                  <li>
                    Soal-soal baru yang telah Anda siapkan di {activateTarget.name} akan otomatis diaktifkan dan dapat dikerjakan oleh seluruh peserta.
                  </li>
                  <li>
                    Skor dan perolehan solves akan dimulai untuk musim kompetisi baru ini.
                  </li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  disabled={activating}
                  onClick={() => setActivateTarget(null)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  disabled={activating}
                  onClick={handleActivateSeason}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {activating ? 'Memproses Arsip & Aktivasi...' : 'Ya, Aktifkan Season Ini Sekarang 🚀'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}
