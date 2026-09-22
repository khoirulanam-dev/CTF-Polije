import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { validatePassword } from '@/lib/password'
import { verifyTurnstileToken } from '@/lib/turnstile'

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,25}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  try {
    const clientKey = req.headers.get('x-real-ip')?.trim() || 'unknown-client'
    const { data: rateLimited, error: rateLimitError } = await supabase.rpc(
      'check_registration_rate_limit',
      { p_key: `contributor:${clientKey}`, p_max_attempts: 3, p_window_seconds: 900 },
    )

    if (rateLimitError) {
      return NextResponse.json(
        { message: 'Registrasi sementara tidak tersedia. Silakan coba lagi nanti.' },
        { status: 503 },
      )
    }

    if (rateLimited === true) {
      return NextResponse.json(
        { message: 'Terlalu banyak percobaan registrasi. Coba lagi dalam 15 menit.' },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim().toLowerCase()
    const username = String(body.username || '').trim()
    const password = String(body.password || '')
    const turnstileToken = String(body.turnstile_token || '')

    const captcha = await verifyTurnstileToken(turnstileToken, req)
    if (!captcha.success) {
      return NextResponse.json(
        { message: captcha.error || 'CAPTCHA tidak valid.' },
        { status: 400 },
      )
    }

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json({ message: 'Email tidak valid.' }, { status: 400 })
    }

    if (!USERNAME_PATTERN.test(username)) {
      return NextResponse.json(
        { message: 'Username harus 3-25 karakter alfanumerik, underscore, atau tanda minus.' },
        { status: 400 },
      )
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ message: passwordError }, { status: 400 })
    }

    const allowedDomains = (process.env.REGISTER_ALLOWED_DOMAINS || '')
      .split(',')
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean)

    if (allowedDomains.length > 0 && !allowedDomains.some((domain) => email.endsWith(domain))) {
      return NextResponse.json(
        { message: `Email harus berakhiran salah satu domain: ${allowedDomains.join(', ')}` },
        { status: 400 },
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ message: 'Konfigurasi server belum lengkap.' }, { status: 500 })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: existingUser, error: existingUserError } = await adminClient
      .from('users')
      .select('id')
      .ilike('username', username)
      .maybeSingle()

    if (existingUserError) throw existingUserError
    if (existingUser) {
      return NextResponse.json({ message: 'Username sudah digunakan.' }, { status: 400 })
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      // Verifikasi email sengaja belum diaktifkan; akan dibahas terpisah.
      email_confirm: true,
      user_metadata: { username, role: 'contributor' },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { message: authError?.message || 'Gagal membuat akun contributor.' },
        { status: 400 },
      )
    }

    const { error: profileError } = await adminClient.from('users').upsert({
      id: authData.user.id,
      username,
      role: 'contributor',
      is_admin: false,
    }, { onConflict: 'id' })

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: any) {
    console.error('Contributor registration error:', error)
    return NextResponse.json(
      { message: error?.message || 'Registrasi contributor gagal.' },
      { status: 500 },
    )
  }
}
