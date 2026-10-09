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
const { resolveUser } = await import('./register')
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
  it('numbers the leads and explains how to answer', () => {
    const message = formatCheckinQuestion('2026-10-08', state.lista)
    expect(message).toContain('CHECK-IN DE LIGAÇÕES · 08/10')
    expect(message).toContain('1. Maria · (28) 999990000')
    expect(message).toContain('2 leads foram qualificados')
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

function toolCall(id: string, numero: number, resultado: string) {
  return { id, type: 'function', function: { name: 'registrar_ligacao', arguments: JSON.stringify({ numero, resultado }) } }
}

describe('runCorretorCheckinAgent', () => {
  beforeEach(() => {
    create.mockReset()
    registrarCheckin.mockReset()
    registrarCheckin.mockResolvedValue({ status: 'registrado' })
  })

  it('registers each lead the broker mentions through the tool', async () => {
    create
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('a', 1, 'atendeu'),
        toolCall('b', 2, 'nao_ligou'),
      ] } }] })
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: 'ok' } }] })

    const result = await runCorretorCheckinAgent({
      corretorNome: 'Lucas', lista: state.lista, message: '1 atendeu, 2 não liguei',
    })

    expect(result).toEqual([
      { numero: 1, resultado: 'atendeu', status: 'registrado' },
      { numero: 2, resultado: 'nao_ligou', status: 'registrado' },
    ])
    expect(registrarCheckin).toHaveBeenCalledWith({
      leadId: 'lead-1', resultado: 'atendeu', corretorNome: 'Lucas', mensagem: '1 atendeu, 2 não liguei',
    })
  })

  it('refuses numbers outside the list, invalid results and repeated leads', async () => {
    create
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [
        toolCall('a', 9, 'atendeu'),
        toolCall('b', 1, 'talvez'),
        toolCall('c', 2, 'atendeu'),
        toolCall('d', 2, 'nao_atendeu'),
      ] } }] })
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: '' } }] })

    const result = await runCorretorCheckinAgent({
      corretorNome: '', lista: state.lista, message: 'texto',
    })

    expect(result).toEqual([{ numero: 2, resultado: 'atendeu', status: 'registrado' }])
    expect(registrarCheckin).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the message is not about the calls', async () => {
    create.mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: 'Bom dia!' } }] })

    const result = await runCorretorCheckinAgent({
      corretorNome: '', lista: state.lista, message: 'bom dia',
    })

    expect(result).toEqual([])
    expect(registrarCheckin).not.toHaveBeenCalled()
  })
})
