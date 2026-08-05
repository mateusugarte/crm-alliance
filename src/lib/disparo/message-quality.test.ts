import { describe, expect, it } from 'vitest'
import { fallbackMessage, hasBlocker, inspectMessage, repairMessage } from './message-quality'
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

  it('normaliza falsa continuidade mesmo quando existe conversa real', () => {
    const limpo = sanitizeCampaignTheme(TEMA, 'conversation')
    expect(limpo).not.toMatch(/último contato/i)
    expect(limpo).not.toMatch(/pega uma valorização/i)
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

  it('detecta problema mesmo quando chamado duas vezes seguidas', () => {
    // Os padrões globais guardavam lastIndex entre chamadas de .test(), então a
    // segunda verificação do mesmo texto dava negativo.
    const ruim = 'Olá! Tem valorização garantida até a entrega. Faz sentido?'
    expect(inspectMessage(ruim, 'conversation', null).map(i => i.code)).toContain('promessa_de_valorizacao')
    expect(inspectMessage(ruim, 'conversation', null).map(i => i.code)).toContain('promessa_de_valorizacao')
  })
})

describe('reativação não pode cobrar memória do lead frio', () => {
  const bloqueios = (message: string, tema = '') =>
    inspectMessage(message, 'conversation', 'Ana', tema)
      .filter(issue => issue.severity === 'bloqueio')
      .map(issue => issue.code)

  it('bloqueia abertura citando o que o cliente disse', () => {
    // Saída real de produção. O lead é frio, não lembra da conversa, e abrir
    // assim soa como quem consultou um dossiê.
    expect(bloqueios('Oi, Ana. Você mencionou o lote avaliado e buscava um 2 quartos. A obra avançou. Faz sentido?'))
      .toContain('abertura_cobrando_memoria')
  })

  it('bloqueia mesmo com travessão ou vírgula depois do nome', () => {
    expect(bloqueios('Oi, Arthur — você comentou sobre os escopos de elétrica, certo? A obra avançou. Vamos falar?'))
      .toContain('abertura_cobrando_memoria')
  })

  it('bloqueia pedido de confirmação de memória', () => {
    expect(bloqueios('Oi, Ana! A obra avançou muito por aqui. Você ainda procura um 2 quartos?'))
      .toContain('pede_confirmacao_de_memoria')
  })

  it('bloqueia número velho vindo do histórico', () => {
    // Preço e parcela mudam; repetir o que foi dito meses atrás quebra a
    // confiança na hora em que o cliente confere.
    expect(bloqueios('Oi, Ana! A obra avançou. A prestação ficou em torno de R$ 9.449 em 56 parcelas. Vamos conversar?'))
      .toContain('numero_velho_do_historico')
  })

  it('aceita número quando ele vem da própria campanha', () => {
    const tema = 'A fundação está concluída e as unidades partem de R$ 535.000.'
    expect(bloqueios('Oi, Ana! A obra avançou e as unidades partem de R$ 535.000. Quer ver as condições?', tema))
      .not.toContain('numero_velho_do_historico')
  })

  it('aprova a mensagem que abre pela obra e trata o interesse como possibilidade', () => {
    const boa = 'Oi, Ana! Passando pra contar que a obra do La Reserva avançou: a fundação está concluída e em breve começamos a subir os andares.\n\nSe a busca por 2 quartos ainda fizer sentido, posso levantar condições atualizadas.\n\nQuer que eu faça isso?'
    expect(bloqueios(boa)).toHaveLength(0)
  })

  it('não bloqueia referência leve no meio do texto', () => {
    const boa = 'Oi, Ana! A obra do La Reserva avançou e a fundação está concluída.\n\nComo você buscava um 2 quartos, achei que valia compartilhar a novidade.\n\nQuer que eu levante as condições?'
    expect(bloqueios(boa)).toHaveLength(0)
  })
})

describe('mensagem de segurança', () => {
  it('respeita as próprias regras do sistema', () => {
    // A primeira versão colava o tema cru depois da saudação, e o texto-base do
    // corretor contém a frase proibida sobre "tomar a melhor decisão".
    const message = fallbackMessage(
      sanitizeCampaignTheme(`${TEMA}\n\nEstou aqui pra te ajudar a tomar a melhor decisão.`, 'no_history'),
      null, 'no_history', 'Faz sentido pra você?',
    )
    expect(message).not.toMatch(/tomar a melhor decis/i)
    expect(message).not.toMatch(/último contato/i)
    expect(hasBlocker(inspectMessage(message, 'no_history', null))).toBe(false)
    expect(message).toContain('?')
  })

  it('usa o nome quando ele é confiável e preserva os parágrafos', () => {
    const message = fallbackMessage(sanitizeCampaignTheme(TEMA, 'sparse'), 'Ana', 'sparse', 'Faz sentido?')
    expect(message.startsWith('Olá, Ana!')).toBe(true)
    expect(message).toContain('\n\n')
  })
})

describe('detalhe inventado sobre o cliente', () => {
  const contextoAna = 'Seria de 2 quartos pode ser o mais basico\nEntão seria pra morar e eu possuo um lote avaliado em R$ 125.000'
  const contextoGustavo = 'Financia também? Qual prazo pra ficar pronto?'

  it('bloqueia lote e quartos num lead que nunca falou disso', () => {
    // Falha real: o modelo copiou o exemplo do prompt — que falava de lote e
    // de 2 quartos — para dentro da mensagem de um cliente sem nada disso.
    const vazado = 'Oi, Gustavo! A obra do La Reserva avançou e a fundação está concluída.\n\nLembrei de você por causa dos 2 quartos, e se aquele lote ainda estiver de pé dá pra usar como entrada.\n\nQuer que eu levante as condições?'
    const codes = inspectMessage(vazado, 'conversation', 'Gustavo', '', contextoGustavo).map(i => i.code)
    expect(codes).toContain('detalhe_nao_comprovado')
  })

  it('aceita o mesmo detalhe quando o cliente realmente falou dele', () => {
    const legitima = 'Oi, Ana! A obra do La Reserva avançou e a fundação está concluída.\n\nLembrei de você por causa dos 2 quartos — se aquele lote ainda estiver de pé, dá pra usar como parte da entrada.\n\nQuer que eu levante as condições?'
    const codes = inspectMessage(legitima, 'conversation', 'Ana', '', contextoAna).map(i => i.code)
    expect(codes).not.toContain('detalhe_nao_comprovado')
  })

  it('aceita detalhe que vem do texto da campanha', () => {
    const tema = 'Ainda temos coberturas disponíveis no La Reserva.'
    const codes = inspectMessage(
      'Oi, Gustavo! A obra avançou e ainda temos coberturas disponíveis. Quer conhecer?',
      'conversation', 'Gustavo', tema, contextoGustavo,
    ).map(i => i.code)
    expect(codes).not.toContain('detalhe_nao_comprovado')
  })

  it('não acusa nada quando não há contexto para comparar', () => {
    const codes = inspectMessage('Olá! A obra avançou. Quer saber mais?', 'sparse', null).map(i => i.code)
    expect(codes).not.toContain('detalhe_nao_comprovado')
  })
})

describe('vazamento e fatos atuais sem fonte', () => {
  it('bloqueia exposição do estado interno do CRM', () => {
    const codes = inspectMessage(
      'Oi, Ana! Não temos histórico seu cadastrado aqui, então falo direto. Quer conhecer o projeto?',
      'no_history', 'Ana', 'O projeto está com a obra em andamento.',
    ).map(issue => issue.code)
    expect(codes).toContain('estado_interno_do_crm')
  })

  it('bloqueia prazo e localização que não vieram da campanha', () => {
    const codes = inspectMessage(
      'Oi, Ana! O La Reserva, em Castelo, tem entrega prevista para fevereiro de 2030. Quer saber mais?',
      'conversation', 'Ana', 'A fundação está praticamente concluída.', 'demonstrou interesse em valores',
    ).map(issue => issue.code)
    expect(codes).toContain('fato_atual_sem_fonte')
  })

  it('bloqueia exagero de fundação quase concluída para concluída', () => {
    const codes = inspectMessage(
      'Oi, Ana! A fundação está concluída e logo começam os andares. Quer uma atualização?',
      'conversation', 'Ana', 'A fundação está praticamente concluída.', 'demonstrou interesse em valores',
    ).map(issue => issue.code)
    expect(codes).toContain('fato_da_campanha_exagerado')
  })

  it('bloqueia condição comercial qualificada sem fonte atual', () => {
    const codes = inspectMessage(
      'A obra avançou e pode ser um bom momento para avaliar condições de pagamento mais flexíveis. Quer receber?',
      'conversation', 'João', 'A fundação está praticamente concluída.',
      'demonstrou interesse em financiamento ou condições de pagamento',
    ).map(issue => issue.code)
    expect(codes).toContain('condicao_comercial_sem_fonte')
  })

  it('bloqueia a mesma oferta feita duas vezes', () => {
    const codes = inspectMessage(
      'A obra avançou. Se quiser, posso te mandar as condições atualizadas. Quer que eu te mande?',
      'conversation', 'João', 'A fundação está praticamente concluída.',
      'demonstrou interesse em financiamento ou condições de pagamento',
    ).map(issue => issue.code)
    expect(codes).toContain('cta_repetido')
  })
})
