import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/lib/supabase/types'

export type AdminRole = 'adm' | 'corretor'

export async function getCurrentUserProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, user: null, profile: null, isAdm: false }
  }

  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name, role, badge_color, created_at')
    .eq('id', user.id)
    .single()

  const profile = data as UserProfile | null
  await recordUserAccess(supabase)

  return {
    supabase,
    user,
    profile,
    isAdm: profile?.role === 'adm',
  }
}

export async function requireAdm() {
  const context = await getCurrentUserProfile()

  if (!context.user) {
    redirect('/login')
  }

  if (!context.isAdm) {
    redirect('/dashboard')
  }

  return context
}

async function recordUserAccess(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const headerStore = await headers()
    const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()

    await supabase.rpc('record_user_access_event', {
      p_ip_address: forwardedFor || headerStore.get('x-real-ip'),
      p_user_agent: headerStore.get('user-agent'),
    } as never)
  } catch {
    // O acesso nao deve falhar por causa do log de auditoria.
  }
}
