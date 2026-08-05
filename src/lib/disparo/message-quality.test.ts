import { describe, expect, it } from 'vitest'
import { hasBlocker, inspectMessage, repairMessage } from './message-quality'
import { sanitizeCampaignTheme } from './reactivation-message'

const TEMA = `As obras do La Reserva avançaram bastante desde o nosso último contato: a fundação já está praticamente concluída e, em breve, começamos a subir os andares.

Estou te mandando essa mensagem porque estamos em um bom momento: quem entra agora ainda pega uma valorização interessante até o fim da obra.

O projeto ainda faz sentido pra você?`

describe('saneamento do tema da campanha', () => {
  it('remove a frase de falsa continuidade quando o lead nunca conversou', () => {
    // Causa raiz do bug: o texto-base do corretor contém exatamente a frase que
    // o gate proíbe, então o modelo copiava e a mensagem era descartada.
    const limpo = sanitizeCampaignTheme(TEMA, 'no_history')
    expect(limpo).not.toMatch(/último contato/i)
    expect(limpo).toContain('fundação já está praticamente concluída')
  })

  it('mantém o tema intacto quando existe conversa real', () => {
    expect(sanitizeCampaignTheme(TEMA, 'conversation')).toBe(TEMA.trim())
  })
})

describe('severidade dos problemas', () => {
  it('trata promessa de valorização como bloqueio', () => {
    const issues = inspectMessage('Olá! A valorização garantida até a entrega é de 20%. Faz sentido?', 'conversation', 'Ana')
    expect(issues.some(i => i.code === 'promessa_de_valorizacao' && i.severity === 'bloqueio')).toBe(true)
  })

  it('não bloqueia mais por duas perguntas', () => {
    // Antes, dois "?" descartavam a mensagem inteira.
    const issues = inspectMessage(
      'Oi, Ana! A obra avançou bastante e a fundação está pronta. Você chegou a ver as fotos? O Apto 02 ainda faz sentido pra você?',
      'conversation', 'Ana',
    )
    expect(hasBlocker(issues)).toBe(false)
  })

  it('não bloqueia mensagem que fecha sem interrogação', () => {
    const issues = inspectMessage(
      'Eduardo, a obra avançou e a fundação está concluída. Quem entra nesta fase acompanha o potencial de valorização. Me avisa se quiser a tabela atualizada e as plantas.',
      'conversation', 'Eduardo',
    )
    expect(hasBlocker(issues)).toBe(false)
  })
})

describe('adaptação em vez de descarte', () => {
  it('remove a falsa continuidade e preserva o resto da mensagem', () => {
    const original = 'Olá! As obras do La Reserva avançaram bastante desde o nosso último contato: a fundação está concluída. O projeto faz sentido pra você?'
    const { message, repaired } = repairMessage(original, 'sparse', null, 'Faz sentido pra você?')
    expect(repaired).toContain('continuidade_sem_evidencia')
    expect(message).not.toMatch(/último contato/i)
    expect(message).toContain('fundação está concluída')
    expect(hasBlocker(inspectMessage(message, 'sparse', null))).toBe(false)
  })

  it('troca promessa por potencial', () => {
    const { message } = repairMessage(
      'Oi! Tem valorização garantida até a entrega. Faz sentido?', 'conversation', 'Ana', 'Faz sentido?',
    )
    expect(message).toContain('potencial de valorização')
    expect(message).not.toMatch(/garantida/i)
  })

  it('corrige saudação com nome inválido', () => {
    const { message, repaired } = repairMessage(
      'Olá, Vc! A obra avançou muito por aqui. Faz sentido pra você?', 'conversation', null, 'Faz sentido?',
    )
    expect(repaired).toContain('saudacao_com_nome_invalido')
    expect(message.startsWith('Olá!')).toBe(true)
    expect(message).not.toMatch(/Vc/)
  })

  it('acrescenta a pergunta de fechamento quando falta', () => {
    const { message, repaired } = repairMessage(
      'Eduardo, a obra avançou e a fundação está concluída.', 'conversation', 'Eduardo', 'Quer que eu agende essa conversa?',
    )
    expect(repaired).toContain('sem_pergunta')
    expect(message.endsWith('Quer que eu agende essa conversa?')).toBe(true)
  })

  it('não mexe numa mensagem que já está correta', () => {
    const boa = 'Oi, Ana! Você comentou que buscava um 2 quartos, então achei que valia atualizar: a fundação está concluída e em breve subimos os andares.\n\nO Apto 02 ainda faz sentido pra você?'
    const { message, repaired } = repairMessage(boa, 'conversation', 'Ana', 'Faz sentido?')
    expect(repaired).toHaveLength(0)
    expect(message).toBe(boa)
  })
})
