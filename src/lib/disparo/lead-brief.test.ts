import { describe, expect, it } from 'vitest'
import { buildLeadBrief, exclusionReason, safeFirstName, type BriefInteraction } from './lead-brief'

const lead = (over: Partial<Parameters<typeof buildLeadBrief>[0]> = {}) => ({
  id: 'lead-1', name: 'Ana Paula', phone: '5527999999999',
  stage: 'lead_morno', summary: null, intention: null, ...over,
})

const msg = (text: string, inbound = true): BriefInteraction => ({
  lead_id: 'lead-1',
  direction: inbound ? 'inbound' : 'outbound',
  sender_type: inbound ? 'lead' : 'bot',
  content: text,
  created_at: new Date().toISOString(),
})

describe('exclusão de contatos', () => {
  it('não exclui comprador que falou de vaga de garagem', () => {
    // Caso real do banco: a regra antiga procurava `emprego|vaga|currículo` e
    // descartava este lead — que negociava a unidade 03 com o pai — como
    // candidato a emprego, por causa de "vaga de garagem".
    const inbound = [
      'acho que só isso vamos para os valores',
      'bom dia!! vou encaminhar toda a proposta pro meu pai, pra ele analisar certinho',
      'Amigo repassando as perguntas do meu pai vaga de garagem, conseguiria 2? a unidade 03 é sol da manhã?',
      'certo, muito obrigado por enquanto meu amigo',
    ]
    expect(exclusionReason('Luis', inbound)).toBeNull()
  })

  it('exclui atendente automático de outra empresa', () => {
    const inbound = [
      'Seja bem vindo(a) ao nosso canal de atendimento. O time VC Negócios Imobiliários está disponível.',
      'Acesse os nossos principais canais aqui: https://linktr.ee/cottavitor',
      'Nosso horário de almoço é de 12:00 às 13:00 horas.',
    ]
    expect(exclusionReason('Vc Imobiliários', inbound)).toMatch(/atendimento autom/i)
  })

  it('exclui bot que repete a mesma mensagem em loop', () => {
    const repetida = 'Olá, Boa noite! Bem-vindo ao mundo Estácio! Curioso para começar a faculdade com desconto?'
    expect(exclusionReason('Lead', Array.from({ length: 8 }, () => repetida))).toMatch(/atendimento autom/i)
  })

  it('continua excluindo quem declarou não ter interesse', () => {
    expect(exclusionReason('Marcos', ['obrigado mas não tenho interesse'])).toMatch(/não tem interesse/i)
  })
})

describe('nome seguro na saudação', () => {
  it('rejeita nome de empresa no plural masculino', () => {
    // "Vc Imobiliários" passava e virava "Olá, Vc!".
    expect(safeFirstName('Vc Imobiliários')).toBeNull()
  })

  it('rejeita placeholders do CRM', () => {
    expect(safeFirstName('Lead')).toBeNull()
    expect(safeFirstName('Teste probe')).toBeNull()
  })

  it('aceita nome de pessoa', () => {
    expect(safeFirstName('Ana Paula Ferreira')).toBe('Ana')
  })
})

describe('escolha da âncora', () => {
  it('prefere o fato mais valioso, não a última fala', () => {
    const brief = buildLeadBrief(lead(), [
      msg('Então seria pra morar e eu possuo um lote avaliado mais ou menos em R$ 125.000,00'),
      msg('Entendi, Ana Paula.', false),
      msg('Seria de 2 quartos pode ser o mais basico'),
    ])
    expect(brief.anchor?.quote).toContain('125.000')
    expect(brief.angle).toBe('financiamento')
  })

  it('não ancora numa despedida', () => {
    const brief = buildLeadBrief(lead({ name: 'Luis' }), [
      msg('vaga de garagem, conseguiria 2? a unidade 03 é sol da manhã?'),
      msg('certo, muito obrigado por enquanto meu amigo'),
    ])
    expect(brief.anchor?.quote).toContain('unidade 03')
  })

  it('detecta objeção e escolhe o ângulo de objeção', () => {
    const brief = buildLeadBrief(lead({ name: 'Willian' }), [
      msg('Bom dia, tive q mudar de ideia, vou ter q deixar mais pra frente pra outra oportunidade'),
    ])
    expect(brief.angle).toBe('objecao')
  })

  it('detecta pedido de consultor', () => {
    const brief = buildLeadBrief(lead({ name: 'Eduardo' }), [
      msg('Entendi, bacana! Como seria a forma de financiamento?'),
      msg('Como posso ver com eles ?'),
    ])
    expect(brief.angle).toBe('consultor')
  })

  it('marca modo sparse quando só houve mensagem automática de anúncio', () => {
    const brief = buildLeadBrief(lead({ name: 'Lead' }), [
      msg('Olá! Tenho interesse e queria mais informações, por favor.'),
    ])
    expect(brief.mode).toBe('sparse')
    expect(brief.anchor).toBeNull()
    expect(brief.safeName).toBeNull()
  })
})
