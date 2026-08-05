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

/** Frases que fingem um contato anterior que não existiu. */
export const FALSE_CONTINUITY = /(desde (?:o )?nosso [uú]ltimo contato|na nossa [uú]ltima conversa|como (?:conversamos|combinamos)|quando (?:falamos|conversamos)|lembrei da nossa conversa|retomando nossa conversa|voltando ao nosso contato)/gi

const GUARANTEED_RETURN = /(valoriza[cç][aã]o (?:garantida|certa|assegurada)|garantia de valoriza[cç][aã]o|com certeza vai valorizar|lucro garantido|retorno garantido)/gi

const BANNED_PHRASE = /estou aqui (?:para|pra) te ajudar a tomar a melhor decis[aã]o/gi

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

  if (GUARANTEED_RETURN.test(message)) {
    issues.push({
      code: 'promessa_de_valorizacao',
      severity: 'bloqueio',
      correction: 'nunca prometa valorização; fale sempre em potencial ou oportunidade',
    })
  }
  if (mode !== 'conversation' && FALSE_CONTINUITY.test(message)) {
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
  if (BANNED_PHRASE.test(message)) {
    issues.push({ code: 'frase_proibida', severity: 'ajuste', correction: 'não use a frase sobre ajudar a tomar a melhor decisão' })
  }

  // `test` com flag global avança lastIndex; zerar evita falso negativo depois.
  GUARANTEED_RETURN.lastIndex = 0
  FALSE_CONTINUITY.lastIndex = 0
  BANNED_PHRASE.lastIndex = 0

  return issues
}

/* -------------------------------------------------------------------------
   Conserto determinístico
   ---------------------------------------------------------------------- */

function tidy(value: string) {
  return value
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,;:])\s*\1+/g, '$1')
    .replace(/^[\s,;:-]+/gm, '')
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

  if (mode !== 'conversation' && FALSE_CONTINUITY.test(output)) {
    FALSE_CONTINUITY.lastIndex = 0
    // "avançaram bastante desde o nosso último contato:" → "avançaram bastante:"
    output = tidy(output.replace(FALSE_CONTINUITY, ''))
    repaired.push('continuidade_sem_evidencia')
  }
  FALSE_CONTINUITY.lastIndex = 0

  if (GUARANTEED_RETURN.test(output)) {
    GUARANTEED_RETURN.lastIndex = 0
    output = tidy(output.replace(GUARANTEED_RETURN, 'potencial de valorização'))
    repaired.push('promessa_de_valorizacao')
  }
  GUARANTEED_RETURN.lastIndex = 0

  if (BANNED_PHRASE.test(output)) {
    BANNED_PHRASE.lastIndex = 0
    output = tidy(output.replace(BANNED_PHRASE, 'fico à disposição'))
    repaired.push('frase_proibida')
  }
  BANNED_PHRASE.lastIndex = 0

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
 * Sem personalização e sem afirmação que o CRM não possa provar.
 */
export function fallbackMessage(campaignFacts: string, safeName: string | null) {
  const greeting = safeName ? `Olá, ${safeName}!` : 'Olá!'
  const body = campaignFacts.replace(FALSE_CONTINUITY, '').replace(/\s+/g, ' ').trim()
  FALSE_CONTINUITY.lastIndex = 0
  return tidy(`${greeting} ${body}`)
}

export function hasBlocker(issues: QualityIssue[]) {
  return issues.some(issue => issue.severity === 'bloqueio')
}
