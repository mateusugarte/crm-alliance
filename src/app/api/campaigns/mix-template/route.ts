import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })
  }

  const body = await req.json() as { template?: string; count?: number }
  const { template, count = 1 } = body

  if (!template || typeof template !== 'string' || !template.trim()) {
    return NextResponse.json({ error: 'template obrigatório' }, { status: 400 })
  }

  const clampedCount = Math.min(Math.max(1, count), 50)
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const paragraphCount = template.trim().split(/\n\n+|\n/).filter(p => p.trim()).length
  const hasMultipleParagraphs = template.trim().includes('\n')

  const prompt = `Você é especialista em copywriting para WhatsApp.

Template original:
"""
${template.trim()}
"""

${hasMultipleParagraphs ? `ATENÇÃO: O template acima possui ${paragraphCount} bloco(s) separados por quebra de linha. CADA variação DEVE preservar exatamente a mesma estrutura de parágrafos — mantenha as mesmas quebras de linha nos mesmos lugares. No JSON, use \\n para representar cada quebra de linha.` : ''}

Gere ${clampedCount} variações únicas e naturais desta mensagem para WhatsApp.

Regras obrigatórias para cada variação:
- PRESERVE EXATAMENTE a estrutura de parágrafos (quebras de linha) do template original — não junte parágrafos separados nem quebre um único parágrafo em dois
- Mantenha o mesmo sentido e intenção da mensagem original
- Troque as PALAVRAS por sinônimos ou reformule as frases completamente dentro de cada parágrafo
- NÃO apenas adicione emojis, pontuação ou acentos como única mudança
- Use português brasileiro informal, como alguém enviaria no WhatsApp
- Tamanho similar ao template original por parágrafo (não escreva muito mais longo)
- Cada variação deve ser claramente diferente das outras

Exemplo com parágrafos (se o template tiver):
Template: "Oi [nome], tudo bem?\\nTenho uma novidade incrível sobre o La Reserva."
Variação correta: "Olá [nome], como você tá?\\nTenho uma novidade especial sobre o La Reserva." ✅
Variação ERRADA: "Oi [nome], tudo bem? Tenho uma novidade incrível sobre o La Reserva." ❌ (juntou parágrafos)

Exemplos de mudanças corretas:
- "oii tudo bem com voce" → "olaa, como você tá?" ✅
- "oi, posso te ajudar?" → "e aí, posso te dar uma força?" ✅

Exemplos do que NÃO é correto:
- "oii tudo bem com voce" → "oiii tudo bem com você? 😊" ❌ (apenas emoji)
- "oi, posso te ajudar?" → "oi, posso te ajudar!!" ❌ (apenas pontuação)

Retorne APENAS um objeto JSON com a chave "messages" contendo um array de ${clampedCount} strings.
Use \\n para representar quebras de linha dentro das strings.
Formato exato: {"messages": ["variação 1", "variação 2", ...]}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
      temperature: 0.92,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? '{"messages":[]}'
    let messages: string[] = []

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const arr = parsed.messages ?? parsed.variations ?? parsed.variants ?? Object.values(parsed)[0]
      if (Array.isArray(arr)) {
        messages = (arr as unknown[]).filter((m): m is string => typeof m === 'string').slice(0, clampedCount)
      }
    } catch {
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        const arr = JSON.parse(match[0]) as unknown[]
        messages = arr.filter((m): m is string => typeof m === 'string').slice(0, clampedCount)
      }
    }

    // Fill any missing slots with the original template
    while (messages.length < clampedCount) {
      messages.push(template.trim())
    }

    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: 'Erro ao gerar variações' }, { status: 500 })
  }
}
