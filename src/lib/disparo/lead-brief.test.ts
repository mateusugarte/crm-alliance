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
    // Texto real do banco: o robô de matrículas da Estácio conversando com a
    // Alice. Repare que ele diz "digitar", não "digite", e que o nome
    // cadastrado é só "Lead" — nenhum dos dois sinais isolados bastava.
    const repetida = 'Olá, Boa noite! Bem-vindo ao mundo Estácio! Curioso para começar a faculdade com desconto e praticidade? Eu te mostro rapidinho! Tem desconto, tem bolsa, tem novidade! E se quiser dar uma pausa, é só digitar "sair", certo?'
    expect(exclusionReason('Lead', Array.from({ length: 4 }, () => repetida))).toMatch(/atendimento autom/i)
  })

  it('exclui bot mesmo com poucas repetições, pelo texto', () => {
    const inbound = [
      'Olá! Bem-vindo ao mundo Estácio! Curioso para começar a faculdade com desconto? É só digitar "sair" para pausar.',
      'Como fiquei sem resposta, vou encerrar nossa conversa aqui. Para mais informações sobre cursos e ainda fazer a sua inscrição acesse: https://www.estacio.br/selecao',
    ]
    expect(exclusionReason('Lead', inbound)).toMatch(/atendimento autom/i)
  })

  it('não confunde lead que manda mensagens curtas repetidas', () => {
    // Duplicação de webhook é comum e não pode custar um lead real.
    expect(exclusionReason('Gustavo', [
      'Financia também?', 'Financia também?', 'Qual prazo pra ficar pronto?', 'Qual prazo pra ficar pronto?',
    ])).toBeNull()
  })

  it('continua excluindo quem declarou não ter interesse', () => {
    expect(exclusionReason('Marcos', ['obrigado mas não tenho interesse'])).toMatch(/não tem interesse/i)
  })

  it('não exclui quem recusou e depois voltou a negociar', () => {
    // Caso real do banco: o Romário abriu recusando e, nas mensagens seguintes,
    // perguntou sobre financiamento e definiu a faixa de preço. Excluir pela
    // mensagem mais antiga descartava um lead com orçamento declarado.
    expect(exclusionReason('Romário', [
      'Boa noite! No momento não tenho interesse, obrigado!',
      'Financia?',
      'Tá longe do meu orçamento, tem que ser um Ap de 300 a 350k',
    ])).toBeNull()
  })

  it('exclui quando a recusa é a última palavra sobre o assunto', () => {
    expect(exclusionReason('Samuel', [
      'Olá! Tenho interesse e queria mais informações, por favor.',
      'Qual o preço do imóvel?',
      'Boa tarde. Agradeço o envio do PDF mas não tenho interesse. Boas vendas, forte abraço.',
      'Pra vc tbm. Obrigado.',
    ])).toMatch(/não tem interesse/i)
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
