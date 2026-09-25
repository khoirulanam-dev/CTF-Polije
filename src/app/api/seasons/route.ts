import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET(req: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 })
    }

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
    let includeDrafts = false

    if (token && supabaseServiceKey) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey)
      const { data: authData } = await authClient.auth.getUser(token)

      if (authData.user) {
        const adminClient = createClient(supabaseUrl, supabaseServiceKey)
        const { data: profile } = await adminClient
          .from('users')
          .select('is_admin, role')
          .eq('id', authData.user.id)
          .maybeSingle()

        includeDrafts = profile?.is_admin === true || profile?.role === 'admin' || profile?.role === 'contributor'
      }
    }

    const publicClient = createClient(supabaseUrl, supabaseAnonKey, token
      ? { global: { headers: { Authorization: `Bearer ${token}` } } }
      : undefined)
    const queryClient = includeDrafts && supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey)
      : publicClient

    const { data: seasons, error } = await queryClient
      .from('seasons')
      .select('id, number, name, description, status, started_at, ended_at, created_at')
      .in('status', includeDrafts ? ['active', 'archived', 'draft'] : ['active', 'archived'])
      .order('number', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ seasons: seasons || [] }, {
      headers: {
        'Cache-Control': includeDrafts
          ? 'private, no-cache'
          : 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch (err) {
    console.error('Error fetching public seasons:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
