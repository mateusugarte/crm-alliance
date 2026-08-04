import { NextRequest, NextResponse } from 'next/server'
import { endOfDay, endOfWeek, startOfDay, startOfWeek } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { loadTaskQueue } from '@/lib/central-do-dia/tasks'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileData } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  const profile = profileData as { role?: string } | null
  const week = request.nextUrl.searchParams.get('view') === 'week'
  const now = new Date()
  const start = week ? startOfWeek(now, { weekStartsOn: 1 }) : startOfDay(now)
  const end = week ? endOfWeek(now, { weekStartsOn: 1 }) : endOfDay(now)

  try {
    try {
      const service = createServiceClient()
      const { error } = await service.rpc('verificar_prazos' as never)
      if (error) throw error
    } catch (deadlineError) {
      console.error('[tasks] failed to refresh deadlines', deadlineError)
    }
    const data = await loadTaskQueue(supabase, user.id, profile?.role === 'adm', start.toISOString(), end.toISOString())
    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar tarefas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
