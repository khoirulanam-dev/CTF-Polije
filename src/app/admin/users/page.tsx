'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Wifi,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Loader from '@/components/custom/loading'
import { useAuth } from '@/contexts/AuthContext'
import { usePresence } from '@/contexts/PresenceContext'
import { isAdmin } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { UserRole } from '@/types'

type ManagedUser = {
  id: string
  email: string
  username: string
  role: UserRole
  created_at: string
  updated_at: string
  last_seen_at: string | null
}

type UserForm = {
  email: string
  username: string
  password: string
  role: UserRole
}

const EMPTY_FORM: UserForm = {
  email: '',
  username: '',
  password: '',
  role: 'user',
}

const ROLE_LABELS: Record<UserRole, string> = {
  user: 'User',
  contributor: 'Contributor',
  admin: 'Admin',
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function roleClass(role: UserRole) {
  if (role === 'admin') return 'border-rose-500/30 bg-rose-500/10 text-rose-300'
  if (role === 'contributor') return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
  return 'border-sky-500/30 bg-sky-500/10 text-sky-300'
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { onlineUsers } = usePresence()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadUsers = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sesi login tidak ditemukan.')

      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Gagal mengambil data user.')

      setUsers(data.users || [])
    } catch (error: any) {
      toast.error(error?.message || 'Gagal mengambil data user.')
    } finally {
      setLoadingUsers(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    if (loading) return () => { mounted = false }

    if (!user) {
      setAuthorized(false)
      router.push('/challenges')
      return () => { mounted = false }
    }

    ;(async () => {
      const allowed = await isAdmin()
      if (!mounted) return

      if (!allowed) {
        setAuthorized(false)
        router.push('/challenges')
        return
      }

      setAuthorized(true)
      await loadUsers()
    })()

    return () => { mounted = false }
  }, [loading, user, router, loadUsers])

  const onlineUserList = useMemo(
    () => users.filter((managedUser) => Boolean(onlineUsers[managedUser.id])),
    [users, onlineUsers],
  )

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users

    return users.filter((managedUser) =>
      [managedUser.username, managedUser.email, managedUser.role]
        .some((value) => value.toLowerCase().includes(query)),
    )
  }, [search, users])

  const openCreate = () => {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (managedUser: ManagedUser) => {
    setEditingUser(managedUser)
    setForm({
      email: managedUser.email,
      username: managedUser.username,
      password: '',
      role: managedUser.role,
    })
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sesi login tidak ditemukan.')

      const body: Record<string, string> = {
        email: form.email,
        username: form.username,
        role: form.role,
      }
      if (form.password) body.password = form.password
      if (editingUser) body.id = editingUser.id

      const response = await fetch('/api/admin/users', {
        method: editingUser ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan user.')

      toast.success(editingUser ? 'User berhasil diperbarui.' : 'User berhasil ditambahkan.')
      setFormOpen(false)
      setEditingUser(null)
      await loadUsers()
    } catch (error: any) {
      toast.error(error?.message || 'Gagal menyimpan user.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (managedUser: ManagedUser) => {
    if (managedUser.id === user?.id) {
      toast.error('Anda tidak dapat menghapus akun sendiri.')
      return
    }
    setDeleteTarget(managedUser)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    const target = deleteTarget
    const previousUsers = users
    setDeleteTarget(null)
    setDeletingId(target.id)
    setUsers((currentUsers) => currentUsers.filter((managedUser) => managedUser.id !== target.id))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sesi login tidak ditemukan.')

      const response = await fetch(`/api/admin/users?id=${encodeURIComponent(managedUser.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus user.')

      toast.success('User berhasil dihapus.')
    } catch (error: any) {
      setUsers(previousUsers)
      toast.error(error?.message || 'Gagal menghapus user.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading || authorized === null) return <Loader fullscreen color="text-orange-500" />
  if (!user || !authorized) return null

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">Admin Panel</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Kelola akun, role, dan pantau user yang sedang online.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/admin')}>
              Kembali ke Admin
            </Button>
            <Button type="button" onClick={openCreate}>
              <UserPlus className="h-4 w-4" /> Tambah User
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-gray-200 dark:border-gray-700 dark:bg-gray-800">
            <CardContent className="flex items-center gap-3 p-5">
              <span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-500">
                <Wifi className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sedang online</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{onlineUserList.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 dark:border-gray-700 dark:bg-gray-800">
            <CardContent className="flex items-center gap-3 p-5">
              <span className="rounded-xl bg-blue-500/10 p-3 text-blue-500">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total user</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{users.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-200 dark:border-gray-700 dark:bg-gray-800">
            <CardContent className="flex items-center gap-3 p-5">
              <span className="rounded-xl bg-violet-500/10 p-3 text-violet-500">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Admin / Contributor</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {users.filter((managedUser) => managedUser.role !== 'user').length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-gray-200 dark:border-gray-700 dark:bg-gray-800">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg text-gray-900 dark:text-white">User yang sedang online</CardTitle>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Data realtime dari presence platform
            </div>
          </CardHeader>
          <CardContent>
            {onlineUserList.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada user online yang terdeteksi.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {onlineUserList.map((managedUser) => (
                  <div key={managedUser.id} className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-medium">{managedUser.username}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({ROLE_LABELS[managedUser.role]})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200 dark:border-gray-700 dark:bg-gray-800">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg text-gray-900 dark:text-white">Semua User</CardTitle>
            <div className="flex w-full gap-2 sm:w-auto">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari username, email, atau role..."
                className="min-w-0 flex-1 sm:w-72"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => loadUsers(true)} disabled={refreshing} title="Refresh">
                <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="py-8"><Loader color="text-orange-500" /></div>
            ) : filteredUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">User tidak ditemukan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">User</th>
                      <th className="px-3 py-3">Email</th>
                      <th className="px-3 py-3">Role</th>
                      <th className="px-3 py-3">Bergabung</th>
                      <th className="px-3 py-3">Last seen</th>
                      <th className="px-3 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/70">
                    {filteredUsers.map((managedUser) => {
                      const isOnline = Boolean(onlineUsers[managedUser.id])
                      return (
                        <tr key={managedUser.id} className="text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/30">
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${isOnline ? 'text-emerald-500' : 'text-gray-400'}`}>
                              <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                              {isOnline ? 'Online' : 'Offline'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold text-gray-900 dark:text-white">{managedUser.username}</div>
                            <div className="font-mono text-[10px] text-gray-400">{managedUser.id.slice(0, 8)}...</div>
                          </td>
                          <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{managedUser.email || '-'}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${roleClass(managedUser.role)}`}>
                              {ROLE_LABELS[managedUser.role]}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{formatDate(managedUser.created_at)}</td>
                          <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
                            {isOnline ? 'Sekarang' : formatDateTime(managedUser.last_seen_at)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => openEdit(managedUser)}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button type="button" variant="destructive" size="sm" onClick={() => handleDelete(managedUser)} disabled={deletingId !== null}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Tambah User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-user-email">Email</Label>
              <Input
                id="admin-user-email"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-username">Username</Label>
              <Input
                id="admin-user-username"
                required
                minLength={3}
                maxLength={25}
                value={form.username}
                onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))}
                placeholder="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-password">
                Password {editingUser && <span className="text-xs font-normal text-gray-500">(kosongkan jika tidak diubah)</span>}
              </Label>
              <Input
                id="admin-user-password"
                type="password"
                required={!editingUser}
                minLength={8}
                value={form.password}
                onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                placeholder={editingUser ? 'Password baru (opsional)' : 'Minimal 8 karakter'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-user-role">Role</Label>
              <select
                id="admin-user-role"
                value={form.role}
                onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value as UserRole }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Tambah User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null)
        }}
      >
        <DialogContent className="border-red-500/20 bg-white dark:bg-gray-900 sm:max-w-md">
          <DialogHeader className="items-center text-center sm:items-start sm:text-left">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-gray-900 dark:text-white">Hapus user?</DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              User <strong className="text-gray-900 dark:text-gray-200">{deleteTarget?.username}</strong> akan dihapus permanen dari sistem. Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletingId !== null}>
              Batal
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={deletingId !== null}>
              {deletingId ? 'Menghapus...' : 'Ya, Hapus User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
