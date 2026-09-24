"use client"

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Copy, Check, ChevronDown, UsersRound } from 'lucide-react'
import ChallengeListItem from '@/components/admin/ChallengeListItem'
import ChallengeOverviewCard from '@/components/admin/ChallengeOverviewCard'
import RecentSolversList from '@/components/admin/RecentSolversList'
import ChallengeFormDialog from '@/components/admin/ChallengeFormDialog'

import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

import ChallengeFilterBar from '@/components/challenges/ChallengeFilterBar'
import Loader from "@/components/custom/loading"
import ConfirmDialog from '@/components/custom/ConfirmDialog'

import { useAuth } from '@/contexts/AuthContext'
import { isAdmin } from '@/lib/auth'
import { getChallenges, addChallenge, updateChallenge, setChallengeActive, deleteChallenge, getFlag, getSolversAll } from '@/lib/challenges'
import { getInfo } from '@/lib/users'
import { Challenge, Attachment } from '@/types'
import { parseChallengeHints, ChallengeHintItem } from '@/lib/hints'
import APP from '@/config'

export default function AdminPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [solvers, setSolvers] = useState<any[]>([])
  const [siteInfo, setSiteInfo] = useState<any | null>(null)
  const [seasons, setSeasons] = useState<any[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const seasonParam = params.get('season')
      if (seasonParam) return seasonParam
      const cached = sessionStorage.getItem('polije_admin_selected_season')
      if (cached) return cached
    }
    return ''
  })
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false)
  const seasonDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (seasonDropdownRef.current && !seasonDropdownRef.current.contains(event.target as Node)) {
        setSeasonDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Dialog / form state
  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState<Challenge | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [pendingDeleteDetail, setPendingDeleteDetail] = useState<Challenge | null>(null)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("")

  const askDelete = (id: string) => {
    setPendingDelete(id)
    const ch = challenges.find((c) => c.id === id)
    setPendingDeleteDetail(ch || null)
    setDeleteConfirmInput("")
    setConfirmOpen(true)
  }

  const emptyForm = {
    title: '',
    description: '',
    category: APP.challengeCategories?.[0] || 'Web',
    points: 100,
    max_points: 100,
    flag: '',
    hint: [] as ChallengeHintItem[],
    difficulty: 'Easy',
    attachments: [] as Attachment[],
    is_dynamic: false,
    min_points: 0,
    decay_per_solve: 0,
    season_id: null as string | null,
  }

  const [filters, setFilters] = useState({
    category: "all",
    difficulty: "all",
    search: "",
  })

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
  }

  const handleClearFilters = () => {
    setFilters({
      category: "all",
      difficulty: "all",
      search: "",
    })
  }

  const [formData, setFormData] = useState(() => ({ ...emptyForm }))

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (loading) return

      // if not logged in, redirect to challenges listing
      if (!user) {
        setAuthorized(false)
        router.push('/challenges')
        return
      }

      const adminCheck = await isAdmin()
      if (!mounted) return
      if (!adminCheck) {
        setAuthorized(false)
        router.push('/challenges')
        return
      }

      setAuthorized(true)

      try {
        const { supabase } = await import('@/lib/supabase')
        const sessionPromise = supabase.auth.getSession()

        const [challengesData, siteInfoData, sessionRes] = await Promise.all([
          getChallenges(undefined, true),
          getInfo(),
          sessionPromise,
        ])

        if (!mounted) return

        const token = sessionRes.data?.session?.access_token || ''
        let seasonsData: any[] = []

        try {
          const res = await fetch('/api/admin/seasons', {
            headers: { Authorization: `Bearer ${token}` }
          })
          const sData = await res.json()
          if (sData.seasons) {
            seasonsData = sData.seasons
          }
        } catch (err) {
          console.warn('Failed to load seasons:', err)
        }

        if (!mounted) return

        // Resolve active or selected season without flash
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
        const seasonParam = params?.get('season')
        const cachedSeason = typeof window !== 'undefined' ? sessionStorage.getItem('polije_admin_selected_season') : null
        const activeSeason = seasonsData.find((s: any) => s.status === 'active')

        let targetSeasonId = 'all'
        if (seasonParam) {
          targetSeasonId = seasonParam
        } else if (cachedSeason && (cachedSeason === 'all' || cachedSeason === 'unassigned' || seasonsData.some((s: any) => s.id === cachedSeason))) {
          targetSeasonId = cachedSeason
        } else if (activeSeason) {
          targetSeasonId = activeSeason.id
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem('polije_admin_selected_season', targetSeasonId)
        }

        // Apply all state changes in a single synchronous batch
        setSeasons(seasonsData)
        setSelectedSeasonId(targetSeasonId)
        setChallenges(challengesData)
        setSiteInfo(siteInfoData)
        setIsDataLoaded(true)

        fetchSolvers(0)
      } catch (err) {
        console.error('Error initializing admin data:', err)
      }
    })()

    return () => { mounted = false }
  }, [user, loading, router])

  const openAdd = () => {
    setEditing(null)
    const defaultSeason = selectedSeasonId !== 'all' && selectedSeasonId !== 'unassigned'
      ? selectedSeasonId
      : (seasons.find(s => s.status === 'active')?.id || null)
    setFormData({ ...emptyForm, season_id: defaultSeason })
    setOpenForm(true)
    setShowPreview(false)
  }

  const openEdit = (c: Challenge) => {
    const parsedHint = parseChallengeHints(c.hint, c.points)

    setEditing(c)
    setFormData({
      title: c.title,
      description: c.description || '',
      category: c.category || APP.challengeCategories?.[0] || 'Web',
      points: c.points || 100,
      max_points: c.max_points || c.points || 100,
      flag: c.flag || '',
      hint: parsedHint,
      difficulty: c.difficulty || 'Easy',
      attachments: c.attachments || [],
      is_dynamic: c.is_dynamic ?? false,
      min_points: c.min_points ?? 0,
      decay_per_solve: c.decay_per_solve ?? 0,
      season_id: (c as any).season_id || null,
    })
    setOpenForm(true)
    setShowPreview(false)
  }

  const fetchSolvers = async (offset = 0) => {
  const data = await getSolversAll(50, offset)
  setSolvers(prev => offset === 0 ? data : [...prev, ...data])
  }

  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  const [activeToast, setActiveToast] = useState<string | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const handleViewFlag = async (id: string) => {
    // Jika sedang ada request yang berjalan, abaikan request baru
    if (isRequesting) return

    // Clear timeout sebelumnya jika ada
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set flag bahwa sedang ada request
    setIsRequesting(true)

    // Dismiss toast yang aktif
    if (activeToast) {
      toast.dismiss(activeToast)
      setActiveToast(null)
    }

    // Tambah delay kecil untuk animasi dismiss
    await new Promise(resolve => setTimeout(resolve, 100))

    const flag = await getFlag(id)
    if (flag) {
      // Create new toast
      const renderToast = (isCopied: boolean) => (
        <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-lg rounded-lg p-4 min-w-[300px] max-w-[800px] border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <div className="font-medium text-sm text-gray-700 dark:text-gray-200">Flag:</div>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(flag)
                setCopySuccess(id)
                // Update toast content to show copied state
                toast.custom(renderToast(true), {
                  id: id,
                  duration: 6000,
                  position: 'top-right',
                })
                // Reset after 2 seconds
                setTimeout(() => {
                  setCopySuccess(null)
                  toast.custom(renderToast(false), {
                    id: id,
                    duration: 6000,
                    position: 'top-right',
                  })
                }, 2000)
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-indigo-100 dark:bg-indigo-900 hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 transition-colors"
            >
              {isCopied ? (
                <><Check size={14} /> Copied!</>
              ) : (
                <><Copy size={14} /> Copy Flag</>
              )}
            </button>
          </div>
          <div className="font-mono text-sm bg-indigo-50 dark:bg-gray-800 p-3 rounded break-all border-2 border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100">
            {flag}
          </div>
        </div>
      );

      const toastId = toast.custom(renderToast(false),
        {
          duration: 6000,
          position: 'top-right',
          id: id // Use challenge id as toast id
        }
      )
      setActiveToast(id)

      // Set timeout untuk mengizinkan request baru setelah 300ms
      timeoutRef.current = setTimeout(() => {
        setIsRequesting(false)
      }, 300)
    } else {
      if (activeToast) {
        toast.dismiss(activeToast)
      }
      const errorToastId = toast.error('Failed to take flag or you are not admin.')
      setActiveToast(errorToastId)

      // Set timeout untuk mengizinkan request baru setelah 300ms
      timeoutRef.current = setTimeout(() => {
        setIsRequesting(false)
      }, 300)
    }

    // Cleanup jika component unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setSubmitting(true)
    try {
      const payload: any = {
        title: (formData.title || '').trim(),
        description: (formData.description || '').trim(),
        category: (formData.category || '').trim(),
        points: Number(formData.points) || 0,
        hint: (formData.hint && formData.hint.length > 0) ? formData.hint.filter((h: any) => (h.content || '').trim() !== '') : null,
        difficulty: (formData.difficulty || '').trim(),
        attachments: (formData.attachments || []).filter((a) => (a.url || '').trim() !== ''),
  }
      if (typeof formData.is_dynamic !== 'undefined') payload.is_dynamic = formData.is_dynamic;
      if (typeof formData.min_points !== 'undefined') payload.min_points = Number(formData.min_points) || 0;
      if (typeof formData.decay_per_solve !== 'undefined') payload.decay_per_solve = Number(formData.decay_per_solve) || 0;
      payload.season_id = formData.season_id || null;
      payload.author = user?.username || 'Admin';
      payload.created_by = user?.id;

      if ((formData.flag || '').trim()) {
        const flagVal = formData.flag.trim()
        if (!/^POLIJE\{[ -~]+\}$/.test(flagVal)) {
          toast.error('Format flag wajib mengikuti: POLIJE{.......}')
          setSubmitting(false)
          return
        }
        payload.flag = flagVal
      }

      if (formData.is_dynamic) {
        payload.max_points = Number(formData.max_points) || Number(formData.points) || 0;
      }
      if (editing) {
        await updateChallenge(editing.id, payload)
      } else {
        if (!formData.flag.trim()) {
          toast.error('Flag is required for new challenges')
          setSubmitting(false)
          return
        }
        await addChallenge(payload)
      }

      const data = await getChallenges(undefined, true)
      setChallenges(data)
      setOpenForm(false)
      setEditing(null)
      setFormData({ ...emptyForm })
      toast.success('Challenge saved successfully')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to save challenge')
    } finally {
      setSubmitting(false)
    }
  }

  const doDelete = async (id: string) => {
    try {
      await deleteChallenge(id)
      const data = await getChallenges(undefined, true)
      setChallenges(data)
      toast.success('Challenge deleted successfully')
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Failed to delete challenge')
    }
  }

  const filteredChallenges = challenges.filter((c) => {
    if (selectedSeasonId && selectedSeasonId !== 'all') {
      if (selectedSeasonId === 'unassigned') {
        if ((c as any).season_id) return false
      } else {
        if ((c as any).season_id !== selectedSeasonId) return false
      }
    }
    if (filters.search && !c.title.toLowerCase().includes(filters.search.toLowerCase())) return false
    if (filters.category !== "all" && c.category !== filters.category) return false
    if (filters.difficulty !== "all" && c.difficulty !== filters.difficulty) return false
    return true
  })

  // hint handlers
  const addHint = () => setFormData(prev => ({ ...prev, hint: [...(prev.hint || []), { content: '', cost: 0 }] }))
  const updateHint = (i: number, field: 'content' | 'cost', v: any) => setFormData(prev => ({
    ...prev,
    hint: prev.hint.map((h, idx) => idx === i ? { ...h, [field]: v } : h)
  }))
  const removeHint = (i: number) => setFormData(prev => ({ ...prev, hint: prev.hint.filter((_, idx) => idx !== i) }))

  // attachments
  const addAttachment = () => setFormData(prev => ({ ...prev, attachments: [...prev.attachments, { name: '', url: '', type: 'file' }] }))
  const updateAttachment = (i: number, field: keyof Attachment, v: string) => setFormData(prev => ({ ...prev, attachments: prev.attachments.map((a, idx) => idx === i ? { ...a, [field]: v } : a) }))
  const removeAttachment = (i: number) => setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, idx) => idx !== i) }))

  if (loading || authorized === null || !isDataLoaded) return <Loader fullscreen color="text-orange-500" />
  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Kiri: Challenge List */}
          <motion.div
            className="lg:col-span-3 order-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="h-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                  <span>Challenge List</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      className="border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 font-semibold flex items-center gap-1.5"
                      onClick={() => router.push('/admin/seasons')}
                    >
                      ⚡ Seasons
                    </Button>
                    <Button variant="outline" onClick={() => router.push('/admin/users')}>
                      <UsersRound className="h-4 w-4" /> Users
                    </Button>
                    <Button variant="outline" onClick={() => router.push('/admin/event')}>Event Mode</Button>
                    <Button onClick={openAdd}>+ Add Challenge</Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {seasons.length > 0 && (
                  <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-gray-100 dark:border-gray-700/60 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Musim:</span>

                      {/* Tab Mandiri: Semua Soal */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSeasonId('all');
                          if (typeof window !== 'undefined') sessionStorage.setItem('polije_admin_selected_season', 'all');
                          setSeasonDropdownOpen(false);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 cursor-pointer ${
                          selectedSeasonId === 'all'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        Semua Soal ({challenges.length})
                      </button>

                      {/* Dropdown Khusus Season */}
                      <div className="relative" ref={seasonDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setSeasonDropdownOpen((prev) => !prev)}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold transition cursor-pointer ${
                            selectedSeasonId !== 'all'
                              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500/60 text-blue-700 dark:text-blue-300 shadow-xs'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          {selectedSeasonId !== 'all' && (
                            <span className="relative flex h-2 w-2">
                              <span
                                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                  seasons.find((s: any) => s.id === selectedSeasonId)?.status === 'active'
                                    ? 'bg-emerald-400'
                                    : seasons.find((s: any) => s.id === selectedSeasonId)?.status === 'draft'
                                    ? 'bg-amber-400'
                                    : 'bg-gray-400'
                                }`}
                              />
                              <span
                                className={`relative inline-flex rounded-full h-2 w-2 ${
                                  seasons.find((s: any) => s.id === selectedSeasonId)?.status === 'active'
                                    ? 'bg-emerald-500'
                                    : seasons.find((s: any) => s.id === selectedSeasonId)?.status === 'draft'
                                    ? 'bg-amber-500'
                                    : 'bg-gray-500'
                                }`}
                              />
                            </span>
                          )}

                          <span>
                            {selectedSeasonId !== 'all'
                              ? (() => {
                                  const s = seasons.find((s: any) => s.id === selectedSeasonId);
                                  return s ? `Season #${s.number}: ${s.name}` : 'Pilih Season';
                                })()
                              : 'Pilih Season'}
                          </span>

                          {selectedSeasonId !== 'all' && (() => {
                            const s = seasons.find((s: any) => s.id === selectedSeasonId);
                            if (!s) return null;
                            if (s.status === 'active') {
                              return (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                                  LIVE
                                </span>
                              );
                            }
                            if (s.status === 'draft') {
                              return (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30">
                                  DRAFT
                                </span>
                              );
                            }
                            if (s.status === 'archived') {
                              return (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium">
                                  ARSIP
                                </span>
                              );
                            }
                            return null;
                          })()}

                          <ChevronDown
                            size={14}
                            className={`text-gray-400 transition-transform duration-200 ${
                              seasonDropdownOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {/* Dropdown Popover (Hanya Season) */}
                        {seasonDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1.5 z-50 w-72 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-1.5 space-y-1 animate-in fade-in duration-150">
                            <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
                              Pilih Musim
                            </div>

                            {seasons.map((s: any) => {
                              const count = challenges.filter(c => (c as any).season_id === s.id).length;
                              const isSelected = selectedSeasonId === s.id;

                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSeasonId(s.id);
                                    if (typeof window !== 'undefined') sessionStorage.setItem('polije_admin_selected_season', s.id);
                                    setSeasonDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span>Season #{s.number}: {s.name}</span>
                                    {s.status === 'active' && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">
                                        LIVE
                                      </span>
                                    )}
                                    {s.status === 'draft' && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                                        DRAFT
                                      </span>
                                    )}
                                    {s.status === 'archived' && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 font-medium">
                                        ARSIP
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-gray-400 font-mono text-[11px]">({count})</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Menampilkan <strong className="text-gray-900 dark:text-white font-semibold">{filteredChallenges.length}</strong> dari {challenges.length} soal
                    </div>
                  </div>
                )}
                <div className="mb-4">
                  {/* Kategori terurut dari config, jika ada */}
                  {(() => {
                    const allCategories = Array.from(new Set(challenges.map(c => c.category))).filter(Boolean)
                    const matchedCategorySet = new Set<string>()
                    const orderedCategories = [
                      ...(APP.challengeCategories || []).flatMap(p => {
                        const pLower = p.toLowerCase()
                        const found = allCategories.find(c => {
                          const cLower = c.toLowerCase()
                          return cLower.includes(pLower) || pLower.includes(cLower)
                        })
                        if (found && !matchedCategorySet.has(found)) {
                          matchedCategorySet.add(found)
                          return found
                        }
                        return [] as string[]
                      }),
                      ...allCategories.filter(c => !matchedCategorySet.has(c)).sort()
                    ]
                    return (
                      <ChallengeFilterBar
                        filters={filters}
                        categories={orderedCategories}
                        difficulties={Array.from(new Set(challenges.map(c => c.difficulty)))}
                        onFilterChange={handleFilterChange}
                        onClear={handleClearFilters}
                        showStatusFilter={false}
                      />
                    )
                  })()}
                </div>
                {filteredChallenges.length === 0 ? (
                  <motion.div
                    className="text-center py-8 text-gray-500"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    No challenges found
                  </motion.div>
                ) : (
                  <motion.div
                    className="divide-y border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                  >
                    {filteredChallenges
                      .slice()
                      .sort((a, b) => {
                        // Urutkan points descending
                        if (b.points !== a.points) return b.points - a.points;
                        // Jika points sama, urutkan berdasarkan urutan kategori di config
                        const catOrder = APP.challengeCategories || [];
                        const aIdx = catOrder.findIndex(c => c.toLowerCase() === (a.category || '').toLowerCase());
                        const bIdx = catOrder.findIndex(c => c.toLowerCase() === (b.category || '').toLowerCase());
                        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                        if (aIdx !== -1) return -1;
                        if (bIdx !== -1) return 1;
                        // Fallback: alfabet
                        return (a.category || '').localeCompare(b.category || '');
                      })
                      .map(ch => (
                        <ChallengeListItem
                          key={ch.id}
                          challenge={ch}
                          onEdit={openEdit}
                          onDelete={askDelete}
                          onViewFlag={handleViewFlag}
                          onToggleActive={async (id, checked) => {
                            const ok = await setChallengeActive(id, checked)
                            if (ok) {
                              setChallenges(prev => prev.map(c => c.id === id ? { ...c, is_active: checked } : c))
                              toast.success(`Challenge ${checked ? 'activated' : 'deactivated'}`)
                            }
                          }}
                        />
                      ))}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Kanan: Sidebar */}
          <motion.aside
            className="lg:col-span-1 order-2 lg:order-none flex flex-col gap-6 h-auto lg:h overflow-y-auto sticky top-0 scroll-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            {/* Overview */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <ChallengeOverviewCard challenges={challenges} info={siteInfo || undefined} />
            </motion.div>

            {/* Recent Solvers */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <RecentSolversList solvers={solvers} onViewAll={() => router.push('/admin/solvers')} />
            </motion.div>
          </motion.aside>
        </div>
      </main>

      <AnimatePresence>
        {openForm && (
          <ChallengeFormDialog
            open={openForm}
            editing={editing}
            formData={formData}
            submitting={submitting}
            showPreview={showPreview}
            onOpenChange={(v) => { if (!v) { setOpenForm(false); setEditing(null) } else setOpenForm(true) }}
            onSubmit={(e) => { e?.preventDefault(); handleSubmit(e) }}
            onChange={setFormData}
            onAddHint={addHint}
            onUpdateHint={updateHint}
            onRemoveHint={removeHint}
            onAddAttachment={addAttachment}
            onUpdateAttachment={updateAttachment}
            onRemoveAttachment={removeAttachment}
            setShowPreview={setShowPreview}
            categories={APP.challengeCategories || []}
            seasons={seasons}
          />
        )}
      </AnimatePresence>

      {/* Confirm dialog outside of mapping so it's global */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Challenge"
        description={
          <div>
            <div className="mb-2">Are you sure you want to delete this challenge? This action cannot be undone.</div>
            {pendingDeleteDetail && (
              <>
                <div className="mt-2 p-3 rounded bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 text-sm font-semibold flex flex-col gap-1">
                  <span>🏆 <b>Title:</b> <span className="font-mono">{pendingDeleteDetail.title}</span></span>
                  <span>📂 <b>Category:</b> <span className="font-mono">{pendingDeleteDetail.category}</span></span>
                  <span>⭐ <b>Points:</b> <span className="font-mono">{pendingDeleteDetail.is_dynamic ? `${pendingDeleteDetail.min_points}~${pendingDeleteDetail.max_points}` : pendingDeleteDetail.points}</span></span>
                  <span>🎯 <b>Difficulty:</b> <span className="font-mono">{pendingDeleteDetail.difficulty}</span></span>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type <b>{pendingDeleteDetail.title}</b> to confirm:
                  </label>
                  <input
                    type="text"
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    value={deleteConfirmInput}
                    onChange={e => setDeleteConfirmInput(e.target.value)}
                    autoFocus
                  />
                </div>
              </>
            )}
          </div>
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (pendingDelete) {
            await doDelete(pendingDelete)
            setPendingDelete(null)
            setPendingDeleteDetail(null)
            setDeleteConfirmInput("")
            setConfirmOpen(false)
          }
        }}
        // @ts-ignore
        confirmDisabled={!!pendingDeleteDetail && deleteConfirmInput !== pendingDeleteDetail.title}
      />
    </div>
  )
}
