/**
 * Controle de qualidade da mensagem de reativação.
 *
 * O gate anterior era binário: qualquer flag zerava a mensagem inteira
 * (`message: flags.length ? '' : message`). Isso tratava risco jurídico e
 * preferência de estilo com a mesma severidade — uma mensagem correta que
 * terminasse em "Me avisa se quiser a tabela." era descartada igual a uma que
 * prometia valorização garantida.
 *
 * Aqui cada problema tem severidade e, quando possível, conserto determinístico:
 *
 *   bloqueio → não pode ir para o lead. Tenta reparar; se não der, regenera.
 *   ajuste   → conserta no código e segue. Nunca impede o envio.
 *
 * O retorno nunca é vazio: se tudo falhar, entra uma mensagem de segurança
 * montada com os fatos da campanha, sem personalização inventada.
 */

import type { ContextMode } from './lead-brief'

export type Severity = 'bloqueio' | 'ajuste'

export interface QualityIssue {
  code: string
  severity: Severity
  /** Instrução para o modelo, usada quando é preciso regenerar. */
  correction: string
}

/**
 * Padrões em duas formas por regex.
 *
 * `RegExp` com a flag `g` guarda `lastIndex` entre chamadas de `.test()`, o que
 * faz o mesmo texto dar positivo numa chamada e negativo na seguinte. Como
 * estes padrões são usados tanto para detectar quanto para substituir, cada um
 * tem uma variante sem estado (`test`) e uma global (`all`, para `replace`).
 */
function pattern(source: string) {
  return { test: new RegExp(source, 'i'), all: new RegExp(source, 'gi') }
}

const CONTINUITY_SOURCE = '(?:desde (?:o )?nosso [uú]ltimo contato|na nossa [uú]ltima conversa|como (?:conversamos|combinamos)|quando (?:falamos|conversamos)|lembrei da nossa conversa|retomando nossa conversa|voltando ao nosso contato)'

/** Frases que fingem um contato anterior que não existiu. */
export const FALSE_CONTINUITY = pattern(CONTINUITY_SOURCE)

const GUARANTEED_RETURN = pattern('(?:valoriza[cç][aã]o (?:garantida|certa|assegurada)|garantia de valoriza[cç][aã]o|com certeza (?:vai|irá) valorizar|lucro garantido|retorno garantido|rentabilidade garantida)')

const BANNED_PHRASE = pattern('estou aqui (?:para|pra) te ajudar a tomar a melhor decis[aã]o')

const INVALID_GREETING = /^((?:oi|ol[aá]|bom dia|boa tarde|boa noite)[,!]?\s+)(lead|n[aã]o|teste|rh|contato|cliente|vc)\b[,!]?\s*/i

/* -------------------------------------------------------------------------
   Diagnóstico
   ---------------------------------------------------------------------- */

export function inspectMessage(
  message: string,
  mode: ContextMode,
  safeName: string | null,
): QualityIssue[] {
  const issues: QualityIssue[] = []
  const questionCount = (message.match(/\?/g) ?? []).length

  if (GUARANTEED_RETURN.test.test(message)) {
    issues.push({
      code: 'promessa_de_valorizacao',
      severity: 'bloqueio',
      correction: 'nunca prometa valorização; fale sempre em potencial ou oportunidade',
    })
  }
  if (mode !== 'conversation' && FALSE_CONTINUITY.test.test(message)) {
    issues.push({
      code: 'continuidade_sem_evidencia',
      severity: 'bloqueio',
      correction: 'este lead nunca conversou com a gente; não cite contato ou conversa anterior',
    })
  }
  if (!safeName && INVALID_GREETING.test(message)) {
    issues.push({
      code: 'saudacao_com_nome_invalido',
      severity: 'bloqueio',
      correction: 'não use nome na saudação, porque o nome cadastrado não é uma pessoa',
    })
  }
  if (message.length > 700) {
    issues.push({
      code: 'mensagem_longa_demais',
      severity: 'bloqueio',
      correction: 'reduza para no máximo 520 caracteres',
    })
  }

  if (message.length < 120) {
    issues.push({ code: 'mensagem_curta_demais', severity: 'ajuste', correction: 'desenvolva um pouco mais' })
  }
  if (questionCount === 0) {
    issues.push({ code: 'sem_pergunta', severity: 'ajuste', correction: 'termine com uma pergunta fácil de responder' })
  }
  if (questionCount > 2) {
    issues.push({ code: 'perguntas_em_excesso', severity: 'ajuste', correction: 'faça no máximo uma pergunta' })
  }
  if (BANNED_PHRASE.test.test(message)) {
    issues.push({ code: 'frase_proibida', severity: 'ajuste', correction: 'não use a frase sobre ajudar a tomar a melhor decisão' })
  }

  return issues
}

/* -------------------------------------------------------------------------
   Conserto determinístico
   ---------------------------------------------------------------------- */

function tidy(value: string) {
  return value
    .replace(/[ \t]{2,}/g, ' ')
    // Espaço antes de pontuação sobra quando um trecho é removido do meio.
    .replace(/[ \t]+([,.:;!?])/g, '$1')
    .replace(/([,;:])\s*\1+/g, '$1')
    // Limpa só espaço horizontal no início da linha: usar `\s` aqui apagava a
    // linha em branco entre parágrafos e achatava a mensagem inteira.
    .replace(/^[ \t,;:-]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Reescreve os problemas que têm solução textual óbvia.
 *
 * É o que o usuário pediu: quando o lead cai na trava, adaptar a mensagem para
 * se enquadrar em vez de jogá-la fora.
 */
export function repairMessage(
  message: string,
  mode: ContextMode,
  safeName: string | null,
  fallbackQuestion: string,
): { message: string; repaired: string[] } {
  let output = message
  const repaired: string[] = []

  if (mode !== 'conversation' && FALSE_CONTINUITY.test.test(output)) {
    // "avançaram bastante desde o nosso último contato:" → "avançaram bastante:"
    output = tidy(output.replace(FALSE_CONTINUITY.all, ''))
    repaired.push('continuidade_sem_evidencia')
  }

  if (GUARANTEED_RETURN.test.test(output)) {
    output = tidy(output.replace(GUARANTEED_RETURN.all, 'potencial de valorização'))
    repaired.push('promessa_de_valorizacao')
  }

  if (BANNED_PHRASE.test.test(output)) {
    output = tidy(output.replace(BANNED_PHRASE.all, 'fico à disposição'))
    repaired.push('frase_proibida')
  }

  if (!safeName && INVALID_GREETING.test(output)) {
    output = tidy(output.replace(INVALID_GREETING, 'Olá! '))
    repaired.push('saudacao_com_nome_invalido')
  }

  if (!output.includes('?')) {
    output = tidy(`${output}\n\n${fallbackQuestion}`)
    repaired.push('sem_pergunta')
  }

  return { message: output, repaired }
}

/**
 * Mensagem de segurança, usada só quando a geração falha por completo.
 *
 * Passa pelo MESMO reparo das mensagens geradas. A primeira versão colava o
 * tema cru depois da saudação e, com isso, a rede de segurança era a única
 * saída do sistema que não respeitava as próprias regras — o texto-base do
 * corretor costuma conter a frase proibida sobre "ajudar a tomar a melhor
 * decisão", e ela ia direto para o lead.
 */
export function fallbackMessage(
  campaignFacts: string,
  safeName: string | null,
  mode: ContextMode,
  closingQuestion: string,
) {
  const greeting = safeName ? `Olá, ${safeName}!` : 'Olá!'
  // Preserva os parágrafos do tema em vez de achatar tudo numa linha só.
  const body = campaignFacts
    .split(/\n{2,}/)
    .map(block => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')

  const { message } = repairMessage(`${greeting} ${body}`, mode, safeName, closingQuestion)
  return message
}

export function hasBlocker(issues: QualityIssue[]) {
  return issues.some(issue => issue.severity === 'bloqueio')
}
