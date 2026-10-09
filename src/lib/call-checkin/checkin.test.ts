import { beforeEach, describe, expect, it, vi } from 'vitest'

const create = vi.fn()
const registrarCheckin = vi.fn()

vi.mock('@/lib/ai/openai-client', () => ({
  CHAT_MODEL: 'test-model',
  getOpenAI: () => ({ chat: { completions: { create } } }),
}))

vi.mock('./register', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./register')>()),
  registrarCheckin: (...args: unknown[]) => registrarCheckin(...args),
}))

vi.mock('@/lib/central-do-dia/db', () => ({ centralQuery: vi.fn(), centralTransaction: vi.fn() }))

const { activeList } = await import('./config')
const { checkinComment, resolveUser } = await import('./register')
const { runCorretorCheckinAgent } = await import('./corretor-agent')
const { formatCheckinQuestion, parseGroupMessages } = await import('./service')

const GRUPO = '120363429109259182@g.us'

const state = {
  grupo_whatsapp: GRUPO,
  data: '2026-10-08',
  lista: [
    { numero: 1, lead_id: 'lead-1', nome: 'Maria', telefone: '(28) 999990000' },
    { numero: 2, lead_id: 'lead-2', nome: 'José', telefone: '(28) 999990001' },
  ],
  enviado_em: '2026-10-08T20:00:00.000Z',
  cursor_ms: Date.parse('2026-10-08T20:00:00.000Z'),
}

describe('parseGroupMessages', () => {
  const ts = 1_791_489_600_000

  it('keeps only text from people in the check-in group, oldest first', () => {
    const messages = parseGroupMessages({ messages: [
      { messageid: 'b', chatid: GRUPO, fromMe: false, messageTimestamp: ts + 2000, senderName: 'João', text: '2 não liguei' },
      { messageid: 'a', chatid: GRUPO, fromMe: false, messageTimestamp: ts + 1000, senderName: 'Lucas', text: '1 atendeu' },
      { messageid: 'c', chatid: GRUPO, fromMe: true, messageTimestamp: ts + 3000, text: 'CHECK-IN DE LIGAÇÕES' },
      { messageid: 'd', chatid: 'outro@g.us', fromMe: false, messageTimestamp: ts + 4000, text: '1 ok' },
      { messageid: 'e', chatid: GRUPO, fromMe: false, messageTimestamp: ts + 5000, text: '' },
    ] }, GRUPO)

    expect(messages.map((m) => m.id)).toEqual(['a', 'b'])
    expect(messages[0]).toEqual({ id: 'a', timestampMs: ts + 1000, senderName: 'Lucas', text: '1 atendeu' })
  })

  it('accepts timestamps in seconds and a bare array', () => {
    const [msg] = parseGroupMessages([{ id: 'x', chatid: GRUPO, messageTimestamp: 1_791_489_600, content: { text: 'ok' } }], GRUPO)
    expect(msg.timestampMs).toBe(1_791_489_600_000)
    expect(msg.text).toBe('ok')
  })
})

describe('formatCheckinQuestion', () => {
  it('asks which leads were called, listing them by name', () => {
    const message = formatCheckinQuestion('2026-10-08', state.lista)
    expect(message).toContain('CHECK-IN DE LIGAÇÕES · 08/10')
    expect(message).toContain('Quais desses leads receberam contato via ligação?')
    expect(message).toContain('1. Maria · (28) 999990000')
    expect(message).toContain('Maria liguei\nJosé não liguei')
  })
})

describe('checkinComment', () => {
  it('records who answered and whether they called', () => {
    expect(checkinComment({ data: '08/10', respondente: 'Lucas Alliance', resposta: 'ligou' }))
      .toBe('Check-in de ligacoes (08/10): Lucas Alliance respondeu no grupo que LIGOU para este lead.')
    expect(checkinComment({ data: '08/10', respondente: 'João', resposta: 'nao_ligou' }))
      .toBe('Check-in de ligacoes (08/10): João respondeu no grupo que NAO LIGOU para este lead.')
    expect(checkinComment({ data: '08/10', respondente: '', resposta: 'ligou', detalhe: 'caixa_postal' }))
      .toBe('Check-in de ligacoes (08/10): Corretor respondeu no grupo que LIGOU para este lead (caiu na caixa postal).')
  })
})

describe('activeList', () => {
  it('keeps the list for 72 hours after it was sent', () => {
    expect(activeList(state, new Date('2026-10-09T12:00:00.000Z'))).toHaveLength(2)
    expect(activeList(state, new Date('2026-10-12T12:00:00.000Z'))).toEqual([])
  })
})

describe('resolveUser', () => {
  const profiles = [
    { id: 'adm', full_name: 'Administrador', role: 'adm' as const },
    { id: 'u-joao', full_name: 'João Souza', role: 'corretor' as const },
    { id: 'u-lucas', full_name: 'Lucas Silva', role: 'corretor' as const },
  ]

  it('matches the broker by first name ignoring accents', () => {
    expect(resolveUser(profiles, 'joao', null)?.id).toBe('u-joao')
  })

  it('falls back to the lead owner and then to the ADM', () => {
    expect(resolveUser(profiles, 'Pedro', 'u-lucas')?.id).toBe('u-lucas')
    expect(resolveUser(profiles, '', null)?.id).toBe('adm')
  })
})

function toolCall(id: string, args: Record<string, unknown>) {
  return { id, type: 'function', function: { name: 'registrar_ligacao', arguments: JSON.stringify(args) } }
}

describe('runCorretorCheckinAgent', () => {
  beforeEach(() => {
    create.mockReset()
    registrarCheckin.mockReset()
    registrarCheckin.mockResolvedValue({ status: 'registrado' })
  })

  it('registers each lead the broker mentions, in the name of who answered', async () => {
    create
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('a', { numero: 1, resposta: 'ligou' }),
        toolCall('b', { numero: 2, resposta: 'nao_ligou' }),
      ] } }] })
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: 'ok' } }] })

    const result = await runCorretorCheckinAgent({
      corretorNome: 'Lucas', lista: state.lista, message: 'Maria liguei, José não liguei',
    })

    expect(result).toEqual([
      { numero: 1, lead: 'Maria', resposta: 'ligou', detalhe: null, status: 'registrado' },
      { numero: 2, lead: 'José', resposta: 'nao_ligou', detalhe: null, status: 'registrado' },
    ])
    expect(registrarCheckin).toHaveBeenCalledWith({
      leadId: 'lead-1', resposta: 'ligou', detalhe: null, respondente: 'Lucas', mensagem: 'Maria liguei, José não liguei',
    })
  })

  it('keeps the call detail only when the broker called', async () => {
    create
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('a', { numero: 1, resposta: 'ligou', detalhe: 'caixa_postal' }),
        toolCall('b', { numero: 2, resposta: 'nao_ligou', detalhe: 'atendeu' }),
      ] } }] })
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: '' } }] })

    const result = await runCorretorCheckinAgent({ corretorNome: 'Lucas', lista: state.lista, message: 'x' })

    expect(result.map((item) => item.detalhe)).toEqual(['caixa_postal', null])
  })

  it('refuses numbers outside the list, invalid answers and repeated leads', async () => {
    create
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('a', { numero: 9, resposta: 'ligou' }),
        toolCall('b', { numero: 1, resposta: 'talvez' }),
        toolCall('c', { numero: 2, resposta: 'ligou' }),
        toolCall('d', { numero: 2, resposta: 'nao_ligou' }),
      ] } }] })
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: '' } }] })

    const result = await runCorretorCheckinAgent({ corretorNome: '', lista: state.lista, message: 'texto' })

    expect(result).toEqual([{ numero: 2, lead: 'José', resposta: 'ligou', detalhe: null, status: 'registrado' }])
    expect(registrarCheckin).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the message is not about the calls', async () => {
    create.mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: 'Bom dia!' } }] })

    const result = await runCorretorCheckinAgent({ corretorNome: '', lista: state.lista, message: 'bom dia' })

    expect(result).toEqual([])
    expect(registrarCheckin).not.toHaveBeenCalled()
  })
})
