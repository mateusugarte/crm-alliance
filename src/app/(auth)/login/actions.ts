'use server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type LoginProfile = {
  full_name: string | null
  role: 'adm' | 'corretor'
}

export async function signIn(formData: FormData): Promise<{ error: string } | never> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'E-mail e senha são obrigatórios.' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Credenciais inválidas. Verifique seu e-mail e senha.' }
  }

  if (data.user) {
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('full_name, role')
      .eq('id', data.user.id)
      .single()
    const profile = profileData as LoginProfile | null

    const headerStore = await headers()
    const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim()

    await supabase.from('login_logs').insert({
      user_id: data.user.id,
      email: data.user.email ?? email,
      full_name: profile?.full_name ?? data.user.user_metadata?.full_name ?? null,
      role: profile?.role ?? 'corretor',
      ip_address: forwardedFor || headerStore.get('x-real-ip'),
      user_agent: headerStore.get('user-agent'),
    } as never)
  }

  redirect('/dashboard')
}
