'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Save, UserPlus } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type CreateUserState = {
  ok?: boolean
  message?: string
}

type CreateUserFormProps = {
  action: (state: CreateUserState, formData: FormData) => Promise<CreateUserState>
}

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="bg-alliance-blue text-white hover:bg-alliance-blue/90">
      {pending ? <Save className="size-4 animate-pulse" /> : <UserPlus className="size-4" />}
      {pending ? 'Criando...' : 'Criar usuário'}
    </Button>
  )
}

export function CreateUserForm({ action }: CreateUserFormProps) {
  const [state, formAction] = useActionState(action, {})

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div>
        <h2 className="text-base font-semibold text-alliance-dark dark:text-white">Criar usuário</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Novos usuários entram como corretor por padrão, salvo quando ADM for selecionado.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
          Nome
          <Input name="full_name" placeholder="Nome do usuário" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
          E-mail
          <Input name="email" type="email" placeholder="email@alliance.com.br" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
          Senha temporária
          <Input name="password" type="password" minLength={8} placeholder="Mínimo 8 caracteres" required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200">
          Perfil
          <select
            name="role"
            defaultValue="corretor"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            <option value="corretor">Corretor</option>
            <option value="adm">ADM</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className={state.ok ? 'text-sm text-emerald-600' : 'text-sm text-red-500'}>
          {state.message}
        </p>
        <SubmitButton />
      </div>
    </form>
  )
}

