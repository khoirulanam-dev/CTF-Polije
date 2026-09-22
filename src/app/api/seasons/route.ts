import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: seasons, error } = await supabase
      .from('seasons')
      .select('id, number, name, description, status, started_at, ended_at, created_at')
      .order('number', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ seasons: seasons || [] })
  } catch (err: any) {
    console.error('Error fetching public seasons:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
