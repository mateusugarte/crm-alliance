import { describe, expect, it } from 'vitest'
import { buildLeadBrief, exclusionReason, readableContent, safeFirstName, type BriefInteraction } from './lead-brief'

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

  it('exclui bot identificado da UNIASSELVI mesmo com nome de pessoa', () => {
    expect(exclusionReason('João Silva', [
      'Olá! Sou a inteligência artificial da UNIASSELVI e posso ajudar com sua matrícula.',
    ])).toMatch(/atendimento autom/i)
  })

  it('exclui número comercial com resposta automática de indisponibilidade', () => {
    expect(exclusionReason('Ao Comercial', [
      'Agradecemos sua mensagem. Não estamos disponíveis no momento, mas entraremos em contato assim que possível.',
    ])).toMatch(/atendimento autom/i)
  })

  it('exclui empresa que responde com troca automática de número', () => {
    expect(exclusionReason('Bruto Barbearia', [
      'Estamos com um novo número para melhor atendê-los: https://wa.me/message/4CLU4DZI3UVQG1',
    ])).toMatch(/atendimento autom/i)
  })

  it('exclui candidato a emprego sem confundir vaga de garagem', () => {
    expect(exclusionReason('Paulo', [
      'Boa tarde, gostaria de encaminhar meu currículo para trabalhar com vocês.',
    ])).toMatch(/procura emprego/i)
  })

  it('exclui corretor que quer parceria para vender o empreendimento', () => {
    expect(exclusionReason('Dair', [
      'Sou corretor e gostaria de trabalhar com o empreendimento e vender o La Reserva.',
    ])).toMatch(/parceria comercial/i)
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

describe('fornecedores e payloads crus', () => {
  it('exclui quem quer prestar serviço para a obra', () => {
    // Caso real: Arthur Franco estava como lead_quente e receberia campanha
    // perguntando se queria agendar visita ao apartamento.
    expect(exclusionReason('Arthur Franco', [
      'Bom dia. Gostaria de tratar sobre o La Reserva',
      'Quero participar das cotações para execução de serviços específicos na obra',
      'Me refiro ao escopo de: Elétrica; automação; monitoramento, TI, SDAI e afins.',
    ])).toMatch(/prestar servi/i)
  })

  it('não exclui comprador que fala de acabamento', () => {
    expect(exclusionReason('Raqueli', [
      'Closet, banheiro com banheira e varanda gourmet seriam essenciais pra mim',
    ])).toBeNull()
  })

  it('lê texto de payloads JSON concatenados', () => {
    // O webhook às vezes grava dois objetos na mesma linha; JSON.parse falhava
    // no conjunto e as chaves iam parar dentro da mensagem enviada ao cliente.
    const cru = '{"text":"Bom dia","previewType":0} {"text":"Gostaria de tratar sobre o La Reserva"}'
    expect(readableContent(cru)).toBe('Bom dia Gostaria de tratar sobre o La Reserva')
  })

  it('lê payload JSON simples', () => {
    expect(readableContent('{"text":"Financia também?"}')).toBe('Financia também?')
  })

  it('devolve texto puro sem alteração', () => {
    expect(readableContent('  Qual   o prazo? ')).toBe('Qual o prazo?')
  })
})

describe('fornecedores que se apresentam pelo próprio ramo', () => {
  it('exclui locador de escoramento metálico', () => {
    expect(exclusionReason('Marcos Pashal', [
      'Boa tarde. Me chamo Marcos, sou consultor técnico comercial da Pashal Alugadora',
      'Então. Eu trabalho com locação de escoramento metálico, o motivo do meu contato é exatamente esse',
    ])).toMatch(/prestar servi/i)
  })

  it('exclui prestador de imagens aéreas', () => {
    expect(exclusionReason('Lead', [
      'Tudo certo. Já conheço. Gostaria de apresentar meu trabalho. Trabalho com imagens aéreas com drone, se caso tiverem interesse, posso mandar a tabela de serviços',
    ])).toMatch(/prestar servi/i)
  })

  it('não exclui comprador que trabalha em algum ramo sem oferecer nada', () => {
    expect(exclusionReason('Carla', [
      'Trabalho em Vitória mas quero morar em Castelo. Qual o valor do apartamento de 2 quartos?',
    ])).toBeNull()
  })
})

describe('público e fatos estruturados', () => {
  it('manda contato sem evidência comercial para revisão humana', () => {
    const brief = buildLeadBrief(lead({ stage: 'lead_frio' }), [msg('Oi, tudo bem por aí?')])
    expect(brief.audience.type).toBe('unknown')
    expect(brief.audience.status).toBe('review')
  })

  it('marca comprador quando existe sinal comercial verificável', () => {
    const brief = buildLeadBrief(lead({ stage: 'lead_frio' }), [
      msg('Queria entender as condições de financiamento e entrada.'),
    ])
    expect(brief.audience).toMatchObject({ type: 'buyer', status: 'eligible' })
    expect(brief.facts.some(fact => fact.kind === 'financing' && fact.safe_for_copy)).toBe(true)
  })

  it('preserva valor antigo para auditoria, mas proíbe sua cópia', () => {
    const brief = buildLeadBrief(lead(), [msg('Consigo dar R$ 125.000 de entrada')])
    const budget = brief.facts.find(fact => fact.kind === 'budget')
    expect(budget?.quote).toContain('125.000')
    expect(budget?.safe_for_copy).toBe(false)
    expect(budget?.source).toBe('lead_message')
  })

  it('bloqueia automaticamente a coluna fornecedores', () => {
    const brief = buildLeadBrief(lead({ stage: 'fornecedores' }), [])
    expect(brief.audience).toMatchObject({ type: 'supplier', status: 'blocked' })
    expect(brief.eligible).toBe(false)
  })
})
