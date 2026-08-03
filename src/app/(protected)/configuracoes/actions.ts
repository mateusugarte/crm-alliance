'use server'

import { revalidatePath } from 'next/cache'
import { requireAdm } from '@/lib/auth/admin'
import { createServiceClient } from '@/lib/supabase/service'

type CreateUserState = {
  ok?: boolean
  message?: string
}

export async function createSystemUser(
  _state: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  await requireAdm()

  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const role = String(formData.get('role') ?? 'corretor') === 'adm' ? 'adm' : 'corretor'

  if (!fullName || !email || password.length < 8) {
    return { ok: false, message: 'Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.' }
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY não está configurada no servidor.' }
  }

  const service = createServiceClient()
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error || !data.user) {
    return { ok: false, message: error?.message ?? 'Não foi possível criar o usuário.' }
  }

  const { error: profileError } = await service
    .from('user_profiles')
    .upsert({
      id: data.user.id,
      full_name: fullName,
      role,
      badge_color: role === 'adm' ? '#0A2EAD' : '#6366f1',
    } as never)

  if (profileError) {
    return { ok: false, message: profileError.message }
  }

  revalidatePath('/configuracoes')
  return { ok: true, message: 'Usuário criado com sucesso.' }
}
