import { ShieldCheck, Clock3, UserCheck, Users } from '@/lib/icons'
import { requireAdm } from '@/lib/auth/admin'
import { CreateUserForm } from '@/components/configuracoes/create-user-form'
import { createSystemUser } from './actions'
import type { LoginLog } from '@/lib/supabase/types'

type UserAccessOverview = {
  id: string
  email: string
  full_name: string | null
  role: 'adm' | 'corretor' | null
  badge_color: string | null
  created_at: string
  confirmed_at: string | null
  last_sign_in_at: string | null
  last_login_at: string | null
  login_count: number
  login_count_7d: number
  login_count_30d: number
}

function formatDate(value: string | null) {
  if (!value) return 'Nunca'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function daysSince(value: string | null) {
  if (!value) return 'Sem acesso'
  const diff = Date.now() - new Date(value).getTime()
  const days = Math.max(0, Math.floor(diff / 86_400_000))
  if (days === 0) return 'Hoje'
  if (days === 1) return '1 dia'
  return `${days} dias`
}

export default async function ConfiguracoesPage() {
  const { supabase } = await requireAdm()

  const [{ data: users }, { data: logs }] = await Promise.all([
    supabase.rpc('list_user_access_overview'),
    supabase
      .from('login_logs')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(100),
  ])

  const userRows = (users ?? []) as UserAccessOverview[]
  const logRows = (logs ?? []) as LoginLog[]
  const activeToday = userRows.filter((user) => daysSince(user.last_login_at || user.last_sign_in_at) === 'Hoje').length
  const totalAdm = userRows.filter((user) => user.role === 'adm').length
  const neverLogged = userRows.filter((user) => !user.last_login_at && !user.last_sign_in_at).length

  return (
    <div className="px-8 py-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold   text-alliance-blue/60">
            Configurações
          </p>
          <h1 className="mt-1 text-2xl font-bold text-alliance-dark dark:text-white">
            Usuários e acessos
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-ink-subtle">
            Controle quem acessa o CRM e acompanhe a rotina de login da equipe.
          </p>
        </div>
        <div className="rounded-lg border border-alliance-blue/15 bg-alliance-blue/10 px-3 py-2 text-sm font-semibold text-alliance-blue dark:text-blue-200">
          Acesso ADM
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <Users className="mb-3 size-5 text-alliance-blue" />
          <p className="text-2xl font-bold text-alliance-dark dark:text-white">{userRows.length}</p>
          <p className="text-sm text-ink-muted dark:text-ink-subtle">Usuários</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <ShieldCheck className="mb-3 size-5 text-alliance-blue" />
          <p className="text-2xl font-bold text-alliance-dark dark:text-white">{totalAdm}</p>
          <p className="text-sm text-ink-muted dark:text-ink-subtle">ADMs</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <UserCheck className="mb-3 size-5 text-emerald-500" />
          <p className="text-2xl font-bold text-alliance-dark dark:text-white">{activeToday}</p>
          <p className="text-sm text-ink-muted dark:text-ink-subtle">Acessaram hoje</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <Clock3 className="mb-3 size-5 text-amber-500" />
          <p className="text-2xl font-bold text-alliance-dark dark:text-white">{neverLogged}</p>
          <p className="text-sm text-ink-muted dark:text-ink-subtle">Nunca acessaram</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-6">
          <section className="overflow-hidden rounded-lg border border-line bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="border-b border-line px-5 py-4 dark:border-white/10">
              <h2 className="font-semibold text-alliance-dark dark:text-white">Usuários do sistema</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-surface-sunken text-xs   text-ink-muted dark:bg-white/5 dark:text-ink-subtle">
                  <tr>
                    <th className="px-5 py-3">Usuário</th>
                    <th className="px-5 py-3">Perfil</th>
                    <th className="px-5 py-3">Último acesso salvo</th>
                    <th className="px-5 py-3">Sem acessar</th>
                    <th className="px-5 py-3">Dias em 7d</th>
                    <th className="px-5 py-3">Dias em 30d</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line dark:divide-white/10">
                  {userRows.map((user) => {
                    const lastLogin = user.last_login_at || user.last_sign_in_at
                    return (
                      <tr key={user.id} className="text-ink">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-alliance-dark dark:text-white">
                            {user.full_name || user.email}
                          </div>
                          <div className="text-xs text-ink-muted">{user.email}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-md bg-surface-sunken px-2 py-1 text-xs font-semibold uppercase text-ink dark:bg-white/10 dark:text-ink-subtle">
                            {user.role ?? 'sem perfil'}
                          </span>
                        </td>
                        <td className="px-5 py-4">{formatDate(lastLogin)}</td>
                        <td className="px-5 py-4">{daysSince(lastLogin)}</td>
                        <td className="px-5 py-4">{user.login_count_7d}</td>
                        <td className="px-5 py-4">{user.login_count_30d}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-line bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="border-b border-line px-5 py-4 dark:border-white/10">
              <h2 className="font-semibold text-alliance-dark dark:text-white">Últimos acessos registrados</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-surface-sunken text-xs   text-ink-muted dark:bg-white/5 dark:text-ink-subtle">
                  <tr>
                    <th className="px-5 py-3">Usuário</th>
                    <th className="px-5 py-3">Perfil</th>
                    <th className="px-5 py-3">Origem</th>
                    <th className="px-5 py-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line dark:divide-white/10">
                  {logRows.map((log) => (
                    <tr key={log.id} className="text-ink">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-alliance-dark dark:text-white">
                          {log.full_name || log.email}
                        </div>
                        <div className="text-xs text-ink-muted">{log.email}</div>
                      </td>
                      <td className="px-5 py-4">{log.role}</td>
                      <td className="px-5 py-4">{log.source}</td>
                      <td className="px-5 py-4">{formatDate(log.logged_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <CreateUserForm action={createSystemUser} />
      </div>
    </div>
  )
}
