import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadTaskQueue } from '@/lib/central-do-dia/tasks'
import { zonedDayRange } from '@/lib/timezone'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileData } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  const profile = profileData as { role?: string } | null
  const week = request.nextUrl.searchParams.get('view') === 'week'
  const range = zonedDayRange(new Date(), week ? 'week' : 'day')

  try {
    const data = await loadTaskQueue(
      supabase,
      user.id,
      profile?.role === 'adm',
      range.startIso,
      range.endExclusiveIso,
      range.startDate,
      range.endExclusiveDate,
    )
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar tarefas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
