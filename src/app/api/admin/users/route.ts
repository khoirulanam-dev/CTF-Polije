import { NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,25}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = new Set(['user', 'contributor', 'admin'])

type UserRole = 'user' | 'contributor' | 'admin'

type AdminClient = SupabaseClient<any, 'public', 'public'>

type AdminCheck = {
  authorized: boolean
  error?: string
  userId?: string
  adminClient?: AdminClient
}

function effectiveRole(profile?: { is_admin?: boolean | null; role?: string | null }): UserRole {
  if (profile?.is_admin === true || profile?.role === 'admin') return 'admin'
  if (profile?.role === 'contributor') return 'contributor'
  return 'user'
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization')
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

async function verifyAdmin(req: Request): Promise<AdminCheck> {
  const token = getBearerToken(req)
  if (!token) return { authorized: false, error: 'Unauthorized' }
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return { authorized: false, error: 'Konfigurasi Supabase server belum lengkap' }
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: authData, error: authError } = await authClient.auth.getUser(token)
  if (authError || !authData.user) {
    return { authorized: false, error: 'Unauthorized' }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('is_admin, role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (profileError || effectiveRole(profile || undefined) !== 'admin') {
    return { authorized: false, error: 'Forbidden: Admin access required' }
  }

  return { authorized: true, userId: authData.user.id, adminClient }
}

async function listAuthUsers(adminClient: AdminClient) {
  const authUsers: any[] = []

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    })
    if (error) throw error

    authUsers.push(...(data.users || []))
    if (!data.users || data.users.length < 1000) break
  }

  return authUsers
}

function validateUserInput(input: {
  email?: unknown
  username?: unknown
  password?: unknown
  role?: unknown
}, requirePassword: boolean) {
  const email = String(input.email || '').trim().toLowerCase()
  const username = String(input.username || '').trim()
  const password = input.password == null ? '' : String(input.password)
  const role = String(input.role || 'user')

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { error: 'Email tidak valid.' }
  }
  if (!USERNAME_PATTERN.test(username)) {
    return { error: 'Username harus 3-25 karakter alfanumerik, underscore, atau tanda minus.' }
  }
  if (!VALID_ROLES.has(role)) {
    return { error: 'Role tidak valid.' }
  }
  if (requirePassword && password.length < 8) {
    return { error: 'Password minimal 8 karakter.' }
  }
  if (!requirePassword && password && password.length < 8) {
    return { error: 'Password minimal 8 karakter.' }
  }

  return { email, username, password, role: role as UserRole }
}

async function ensureUsernameAvailable(
  adminClient: AdminClient,
  username: string,
  excludeId?: string,
) {
  let query = adminClient
    .from('users')
    .select('id')
    .ilike('username', username)
    .limit(1)

  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return !data
}

async function countAdmins(adminClient: AdminClient) {
  const { data, error } = await adminClient
    .from('users')
    .select('id, is_admin, role')

  if (error) throw error
  return (data || []).filter((profile) => effectiveRole(profile) === 'admin').length
}

export async function GET(req: Request) {
  try {
    const adminCheck = await verifyAdmin(req)
    if (!adminCheck.authorized || !adminCheck.adminClient) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const { adminClient } = adminCheck
    const [{ data: profiles, error: profilesError }, authUsers] = await Promise.all([
      adminClient
        .from('users')
        .select('id, username, is_admin, role, created_at, updated_at')
        .order('username', { ascending: true }),
      listAuthUsers(adminClient),
    ])

    if (profilesError) throw profilesError

    const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]))
    const users = authUsers.map((authUser) => {
      const profile = profilesById.get(authUser.id)
      const role = effectiveRole(profile)

      return {
        id: authUser.id,
        email: authUser.email || '',
        username:
          profile?.username ||
          authUser.user_metadata?.username ||
          authUser.email?.split('@')[0] ||
          'User',
        role,
        score: 0,
        created_at: profile?.created_at || authUser.created_at,
        updated_at: profile?.updated_at || authUser.updated_at || authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at || null,
      }
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Error fetching admin users:', error)
    return NextResponse.json({ error: 'Gagal mengambil data user.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const adminCheck = await verifyAdmin(req)
    if (!adminCheck.authorized || !adminCheck.adminClient) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const validated = validateUserInput(body, true)
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const { adminClient } = adminCheck
    if (!(await ensureUsernameAvailable(adminClient, validated.username))) {
      return NextResponse.json({ error: 'Username sudah digunakan.' }, { status: 409 })
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: validated.email,
      password: validated.password,
      email_confirm: true,
      user_metadata: { username: validated.username },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'Gagal membuat akun autentikasi.' },
        { status: 400 },
      )
    }

    const role = validated.role
    const { error: profileError } = await adminClient.from('users').upsert({
      id: authData.user.id,
      username: validated.username,
      role,
      is_admin: role === 'admin',
    }, { onConflict: 'id' })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: validated.email,
        username: validated.username,
        role,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating admin user:', error)
    return NextResponse.json({ error: error?.message || 'Gagal membuat user.' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const adminCheck = await verifyAdmin(req)
    if (!adminCheck.authorized || !adminCheck.adminClient) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const id = String(body.id || '').trim()
    if (!id) return NextResponse.json({ error: 'User ID wajib diisi.' }, { status: 400 })

    const validated = validateUserInput(body, false)
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const { adminClient } = adminCheck
    const { data: currentProfile, error: currentProfileError } = await adminClient
      .from('users')
      .select('id, is_admin, role')
      .eq('id', id)
      .maybeSingle()

    if (currentProfileError) throw currentProfileError
    const currentRole = effectiveRole(currentProfile || undefined)

    if (id === adminCheck.userId && validated.role !== 'admin') {
      return NextResponse.json({ error: 'Admin yang sedang login tidak dapat menurunkan role dirinya sendiri.' }, { status: 400 })
    }

    if (currentRole === 'admin' && validated.role !== 'admin' && (await countAdmins(adminClient)) <= 1) {
      return NextResponse.json({ error: 'Minimal harus ada satu admin.' }, { status: 400 })
    }

    if (!(await ensureUsernameAvailable(adminClient, validated.username, id))) {
      return NextResponse.json({ error: 'Username sudah digunakan.' }, { status: 409 })
    }

    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(id)
    if (authUserError || !authUserData.user) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 })
    }

    const authUpdates: { email?: string; password?: string; email_confirm?: boolean } = {}
    if (validated.email !== (authUserData.user.email || '').toLowerCase()) {
      authUpdates.email = validated.email
      authUpdates.email_confirm = true
    }
    if (validated.password) authUpdates.password = validated.password

    if (Object.keys(authUpdates).length > 0) {
      const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(id, authUpdates)
      if (updateAuthError) {
        return NextResponse.json({ error: updateAuthError.message }, { status: 400 })
      }
    }

    const { error: profileError } = await adminClient.from('users').upsert({
      id,
      username: validated.username,
      role: validated.role,
      is_admin: validated.role === 'admin',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (profileError) throw profileError

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating admin user:', error)
    return NextResponse.json({ error: error?.message || 'Gagal memperbarui user.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const adminCheck = await verifyAdmin(req)
    if (!adminCheck.authorized || !adminCheck.adminClient) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 })
    }

    const id = new URL(req.url).searchParams.get('id')?.trim()
    if (!id) return NextResponse.json({ error: 'User ID wajib diisi.' }, { status: 400 })
    if (id === adminCheck.userId) {
      return NextResponse.json({ error: 'Anda tidak dapat menghapus akun sendiri.' }, { status: 400 })
    }

    const { adminClient } = adminCheck
    const { data: profile, error: profileError } = await adminClient
      .from('users')
      .select('id, is_admin, role')
      .eq('id', id)
      .maybeSingle()

    if (profileError) throw profileError
    if (!profile) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 })

    if (effectiveRole(profile) === 'admin' && (await countAdmins(adminClient)) <= 1) {
      return NextResponse.json({ error: 'Admin terakhir tidak dapat dihapus.' }, { status: 400 })
    }

    const { error: authError } = await adminClient.auth.admin.deleteUser(id)
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    // Usually removed by the FK cascade; this also handles profiles without a cascade.
    await adminClient.from('users').delete().eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting admin user:', error)
    return NextResponse.json({ error: error?.message || 'Gagal menghapus user.' }, { status: 500 })
  }
}
