# Sistema de Disparo — Documentação Técnica (Atualizada)

> Cobre o fluxo de envio de mensagens, acompanhamento em tempo real e o novo módulo de **Reativar Contatos**.
> Stack: Node.js + Express · Socket.io · UazAPI · Supabase (PostgreSQL)

---

## 1. Variáveis de Ambiente Necessárias

```env
# UazAPI — gateway WhatsApp
UAZAPI_BASE_URL=https://sua-instancia.uazapi.com
UAZAPI_TOKEN=<admin_token>

# Supabase
SUPABASE_URL=https://<projeto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# Frontend
FRONTEND_URL=https://seu-frontend.vercel.app
```

O `UAZAPI_TOKEN` é o token de admin da UazAPI — permite criar e listar instâncias.
Cada instância WhatsApp tem seu próprio **token de instância**, armazenado na tabela `wa_instances` e usado nos envios reais.

---

## 2. Estrutura de Dados no Supabase

### Tabela `campaigns` (inalterada)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Nome da campanha |
| `instance_id` | text | ID da instância WhatsApp |
| `template_id` | uuid | Template único (legado) |
| `template_ids` | uuid[] | Lista de templates |
| `interval_min` | integer | Intervalo mínimo entre envios (minutos) |
| `interval_max` | integer | Intervalo máximo entre envios (minutos) |
| `status` | text | `draft` / `running` / `paused` / `completed` / `cancelled` |
| `total_leads` | integer | Total de contatos |
| `sent_count` | integer | Enviados com sucesso |
| `failed_count` | integer | Falharam |
| `media_url` | text | URL de mídia opcional |
| `media_type` | text | `image`, `video`, `document` |

### Tabela `dispatches` (inalterada)
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `campaign_id` | uuid | FK para `campaigns` |
| `phone` | text | Número do destinatário |
| `status` | text | `pending` / `sent` / `failed` / `cancelled` |
| `message_sent` | text | Mensagem final após spin |
| `typing_delay` | integer | Duração do "digitando..." em ms (2000–3800ms) |
| `sent_at` | timestamptz | Momento do envio bem-sucedido |
| `error` | text | Mensagem de erro (se falhou) |

### NOVA Tabela `reactivation_campaigns`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Nome/label do disparo |
| `instance_id` | text | FK para `wa_instances` |
| `reference_messages` | text[] | Array com as 5 mensagens de referência escritas pelo usuário |
| `interval_min` | integer | Intervalo mínimo entre envios (minutos) |
| `interval_max` | integer | Intervalo máximo entre envios (minutos) |
| `status` | text | `draft` / `running` / `paused` / `completed` / `cancelled` |
| `total_leads` | integer | Total de contatos selecionados |
| `sent_count` | integer | Enviados com sucesso |
| `failed_count` | integer | Falharam |
| `created_at` | timestamptz | Data de criação |

### NOVA Tabela `reactivation_dispatches`
| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `reactivation_campaign_id` | uuid | FK para `reactivation_campaigns` |
| `contact_id` | uuid | FK para `contacts` |
| `phone` | text | Número do destinatário |
| `status` | text | `pending` / `sent` / `failed` / `cancelled` |
| `message_sent` | text | Mensagem final gerada pelo spin |
| `typing_delay` | integer | Delay de digitação em ms (2000–3800ms) |
| `interval_delay_ms` | integer | Delay exato gerado para o intervalo antes deste envio |
| `sent_at` | timestamptz | Momento do envio |
| `error` | text | Erro, se falhou |

### Alteração na Tabela `contacts`
Adicionar campo de rastreamento de reativações:
```sql
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reactivation_count integer DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_reactivated_at timestamptz;
```

### Funções RPC no Supabase
```sql
-- Existentes (mantidas)
increment_campaign_sent(p_campaign_id uuid)
increment_campaign_failed(p_campaign_id uuid)

-- Novas para reativação
increment_reactivation_sent(p_campaign_id uuid)
increment_reactivation_failed(p_campaign_id uuid)
```

---

## 3. Serviço UazAPI (`services/uazapi.js`) — inalterado

Mantém exatamente a mesma lógica: cliente admin + cliente de instância.

### Função principal de envio (inalterada)
```js
async function sendTextByToken(instanceToken, number, text, delay) {
  const client = getInstanceClient(instanceToken);
  const body = { number, text };
  if (delay !== undefined) body.delay = delay;
  const { data } = await client.post('/send/text', body);
  return data;
}
```

O campo `delay` simula o "digitando..." antes de entregar a mensagem. Timeout: 15 segundos.

---

## 4. Message Spinner (`services/spinner.js`) — inalterado para campanhas normais

O spinner original permanece **intacto** e é usado exclusivamente pelas campanhas normais.

Sintaxe de blocos:
```
{Olá|Oi|E aí}, tudo bem? Posso {te ajudar|te auxiliar}?
```

```js
function spin(templateContent) {
  const spun = spinBlocks(templateContent);
  return addNaturalVariation(spun).trim();
}
```

> O módulo de Reativação **não usa o spinner**. Ele usa geração via IA — veja seção 4.1.

---

## 4.1 NOVO: Serviço de Variação por IA (`services/ai-variation.js`)

O módulo de reativação substitui o spinner por geração de variações via **API da Anthropic (Claude)**. O usuário escreve 5 mensagens de referência com o mesmo contexto, e a IA gera uma mensagem única para cada contato, preservando o tom, intenção e contexto das referências.

### Variáveis de ambiente adicionais
```env
ANTHROPIC_API_KEY=<sua_chave_anthropic>
```

### Lógica do serviço

```js
// services/ai-variation.js
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Gera N variações únicas a partir de 5 mensagens de referência.
 * Cada variação preserva o contexto e tom das referências, mas é textualmente única.
 *
 * @param {string[]} referenceMessages - Array com exatamente 5 mensagens de referência
 * @param {number} count - Quantidade de variações a gerar (igual ao nº de dispatches)
 * @returns {Promise<string[]>} - Array de strings com as variações geradas
 */
async function generateVariations(referenceMessages, count) {
  const prompt = `Você é um especialista em copywriting para WhatsApp.

O usuário escreveu as 5 mensagens de referência abaixo. Todas têm o mesmo contexto e intenção.
Gere exatamente ${count} variações únicas com base nessas referências.

Regras obrigatórias:
- Cada variação deve ser textualmente diferente das outras e das referências
- Preserve o tom, contexto e intenção das mensagens originais
- Mensagens curtas e naturais, como uma pessoa enviaria no WhatsApp
- Não use linguagem corporativa ou formal demais
- Não adicione saudações genéricas como "Olá!" se não estiverem nas referências
- Cada variação em uma linha separada, sem numeração, sem prefixo, sem aspas

Mensagens de referência:
${referenceMessages.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Retorne apenas as ${count} variações, uma por linha, sem mais nada.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Garante que temos exatamente `count` variações
  if (lines.length < count) {
    // Se a IA retornou menos que o esperado, preenche ciclicamente
    while (lines.length < count) {
      lines.push(lines[lines.length % referenceMessages.length]);
    }
  }

  return lines.slice(0, count);
}

module.exports = { generateVariations };
```

### Como é chamado no prepare

```js
// Dentro de POST /api/reactivation/:id/prepare
const { generateVariations } = require('../services/ai-variation');

const dispatches = /* busca todos os dispatches pending */;
const variations = await generateVariations(
  campaign.reference_messages,  // array com as 5 mensagens do usuário
  dispatches.length
);

// Atribui uma variação única a cada dispatch
for (let i = 0; i < dispatches.length; i++) {
  dispatches[i].message_sent     = variations[i];
  dispatches[i].typing_delay     = getReactivationTypingDelay();
  dispatches[i].interval_delay_ms = getRandomDelay(campaign.interval_min, campaign.interval_max);
}
// Salva em batch no Supabase
```

### Tratamento de erro

Se a chamada à API da Anthropic falhar durante o prepare, retornar `502 Bad Gateway` com mensagem:
```json
{ "error": "Falha ao gerar variações de mensagem via IA. Tente novamente." }
```
Nenhum dispatch deve ser parcialmente atualizado — use transação ou atualize somente após gerar todas as variações com sucesso.

---

## 5. Scheduler (`services/scheduler.js`) — parcialmente alterado

### Delay entre mensagens (inalterado)
```js
function getRandomDelay(minMinutes, maxMinutes) {
  const minutes = Math.floor(minMinutes + Math.random() * (maxMinutes - minMinutes + 1));
  const seconds = Math.floor(Math.random() * 60);
  const ms      = Math.floor(Math.random() * 1000);
  return (minutes * 60 * 1000) + (seconds * 1000) + ms;
}
```

### NOVO: Delay de digitação para Reativação
O módulo de reativação usa uma faixa diferente da original:
```js
// Campanhas normais: 2000–5000ms
// Reativação: 2000–3800ms
function getReactivationTypingDelay() {
  const ms = 2000 + Math.floor(Math.random() * 1801); // 2000 a 3800ms
  return ms;
}
```

---

## 6. NOVO Módulo: Reativar Contatos

### 6.1 Visão Geral da Página

A nova rota `/reativar` exibe:

- **Cards de métricas:**
  - Contatos reengajados 1× (`reactivation_count = 1`)
  - Contatos reengajados 2× (`reactivation_count = 2`)
  - Contatos reengajados 3× (`reactivation_count = 3`)

- **Botão "Disparar"** — inicia o fluxo de criação de disparo de reativação

- **Recomendação fixa na UI:**
  > ⚠️ Recomendamos disparar para no máximo **10 contatos** a cada **4 horas** para evitar bloqueios.

- **Lista de disparos de reativação** em andamento ou finalizados

---

### 6.2 Fluxo de Criação — Passo a Passo (Modal/Wizard)

#### Passo 1 — Selecionar Contatos
- Exibe tabela de contatos com filtro por `reactivation_count` (0, 1, 2, 3+)
- Seleção via checkbox
- Alerta visual se o usuário selecionar mais de 10 contatos:
  > "Você selecionou X contatos. Recomendamos no máximo 10 por disparo."

#### Passo 2 — Redigir as 5 Mensagens de Referência
- **5 textareas** lado a lado (ou empilhadas), uma por mensagem de referência
- Label de cada campo: "Mensagem 1", "Mensagem 2" … "Mensagem 5"
- Instrução acima do campo:
  > "Escreva 5 versões da sua mensagem. Mantenha o mesmo contexto e intenção em todas — a IA vai criar uma variação exclusiva para cada contato."
- Todas as 5 devem ser preenchidas para avançar
- Botão "Próximo" ativo somente com todos os 5 campos preenchidos

#### Passo 3 — Selecionar Intervalo
- Dropdown ou radio buttons com opções pré-definidas:
  - Entre 2 a 4 min
  - Entre 4 a 5 min
  - Entre 5 a 8 min
  - Entre 8 a 12 min
- O usuário escolhe o range; o delay exato será gerado no "Preparar"

#### Passo 4 — Preparar Reativação (`POST /api/reactivation/:id/prepare`)

Ao clicar em **"Preparar Reativação"**, o backend:

1. Busca todos os `reactivation_dispatches` com `status = 'pending'`
2. Chama `generateVariations(campaign.reference_messages, dispatches.length)` — uma única chamada à API da Anthropic que retorna N mensagens únicas (uma por contato)
3. Para cada dispatch:

```js
dispatch.message_sent      = variations[i];              // variação única gerada pela IA
dispatch.typing_delay      = getReactivationTypingDelay(); // 2000–3800ms aleatório
dispatch.interval_delay_ms = getRandomDelay(interval_min, interval_max); // não-redondo
```

4. Salva todos os dispatches em batch somente após gerar **todas** as variações com sucesso

Cada contato recebe uma mensagem genuinamente diferente, com delays completamente não-redondos e independentes.

Após preparar, o frontend exibe um **resumo de confirmação**:
- Quantidade de contatos
- Prévia das primeiras 3 mensagens geradas pela IA
- Range de intervalo selecionado
- Botão "Confirmar e Iniciar"

---

### 6.3 API Endpoints — Reativação

```
POST /api/reactivation                   → Cria reactivation_campaign + dispatches
POST /api/reactivation/:id/prepare       → Pré-gera mensagem, typing_delay e interval_delay para cada dispatch
POST /api/reactivation/:id/start         → Inicia o runner de reativação
POST /api/reactivation/:id/pause         → Pausa o runner
POST /api/reactivation/:id/stop          → Encerra o runner
GET  /api/reactivation                   → Lista campanhas de reativação
GET  /api/reactivation/:id               → Detalhe + dispatches
GET  /api/reactivation/stats             → Retorna contagem de contatos por reactivation_count (1, 2, 3)
```

---

### 6.4 Loop de Execução da Reativação (`_executeReactivation`)

Segue a **mesma arquitetura** do `campaign-runner` existente, adaptada:

```
1. Busca reactivation_campaign no Supabase (instance_id, interval_min/max, message_template)
2. Atualiza status = 'running', emite reactivation:started via Socket.io

Loop (enquanto !runner.stopped):
  a. Se runner.paused → aguarda em loop de 500ms

  b. Busca próximo reactivation_dispatch com status = 'pending' (ORDER BY created_at LIMIT 1)
  c. Se nenhum → status = 'completed', emite reactivation:completed → fim

  d. Usa message_sent já preparado (obrigatório — sem prepare não inicia)
  e. Usa typing_delay já preparado (2000–3800ms)

  f. Chama uazapi.sendTextByToken(instance_token, phone, message, typingDelay)

  g. Sucesso:
     - reactivation_dispatches: status = 'sent', sent_at
     - RPC increment_reactivation_sent
     - contacts: reactivation_count + 1, last_reactivated_at = now()
     - Emite reactivation:dispatch:sent via Socket.io

  h. Falha:
     - reactivation_dispatches: status = 'failed', error
     - RPC increment_reactivation_failed
     - Emite reactivation:dispatch:failed via Socket.io

  i. Countdown entre envios:
     - Usa interval_delay_ms já preparado para o PRÓXIMO dispatch
     - Loop segundo a segundo:
         • Emite reactivation:countdown { remaining, total, paused }
         • Dorme 1000ms
     - Emite reactivation:countdown com remaining=0
```

> **Regra importante:** o disparo só pode ser iniciado se todos os dispatches tiverem `message_sent` e `typing_delay` preenchidos (ou seja, o "Preparar" foi executado). Caso contrário, retorna erro 400.

---

## 7. Socket.io — Eventos em Tempo Real

### Eventos existentes (inalterados)
| Evento | Payload |
|---|---|
| `campaign:started` | `{ campaignId }` |
| `campaign:paused` | `{ campaignId }` |
| `campaign:resumed` | `{ campaignId }` |
| `campaign:stopped` | `{ campaignId }` |
| `campaign:completed` | `{ campaignId }` |
| `campaign:countdown` | `{ campaignId, remaining, total, paused }` |
| `dispatch:sent` | `{ campaignId, dispatchId, phone, message }` |
| `dispatch:failed` | `{ campaignId, dispatchId, phone, error }` |

### NOVOS eventos para Reativação
| Evento | Payload | Quando |
|---|---|---|
| `reactivation:started` | `{ campaignId }` | Início do loop |
| `reactivation:paused` | `{ campaignId }` | Após pausar |
| `reactivation:resumed` | `{ campaignId }` | Ao retomar |
| `reactivation:stopped` | `{ campaignId }` | Após encerrar |
| `reactivation:completed` | `{ campaignId }` | Todos processados |
| `reactivation:countdown` | `{ campaignId, remaining, total, paused }` | A cada segundo |
| `reactivation:dispatch:sent` | `{ campaignId, dispatchId, phone, message }` | Envio bem-sucedido |
| `reactivation:dispatch:failed` | `{ campaignId, dispatchId, phone, error }` | Falha no envio |

---

## 8. Frontend — Nova Página `ReativarContatos.jsx`

```
/reativar
├── Cards de métricas (1×, 2×, 3× reengajados)
├── Botão "Disparar" → abre modal wizard
│    ├── Passo 1: Selecionar contatos (tabela filtrável)
│    ├── Passo 2: Redigir mensagem (textarea + preview spin)
│    ├── Passo 3: Selecionar intervalo (2–4min / 4–5min / 5–8min / 8–12min)
│    └── Botão "Preparar Reativação" → chama /prepare → exibe resumo → confirmar
└── Lista de reactivation_campaigns com status e progresso
     └── Link para /reativar/:id (detalhe com tabela de dispatches + countdown ao vivo)
```

### Consumo Socket.io no detalhe (`ReativarDetalhe.jsx`)
```js
socket.on('reactivation:dispatch:sent', (data) => {
  if (data.campaignId !== id) return;
  setDispatches(prev => prev.map(d =>
    d.id === data.dispatchId
      ? { ...d, status: 'sent', message_sent: data.message, sent_at: new Date().toISOString() }
      : d
  ));
});

socket.on('reactivation:countdown', (data) => {
  if (data.campaignId !== id) return;
  setCountdown(data);
});

socket.on('reactivation:completed', () => loadAll());
socket.on('reactivation:paused',    () => loadAll());
socket.on('reactivation:stopped',   () => loadAll());
```

---

## 9. Gerenciamento de Estado dos Runners (Reativação)

Mesmo padrão dos runners existentes, em Map separado:

```js
const activeReactivationRunners = new Map();
// key: reactivationCampaignId
// value: { paused: boolean, stopped: boolean }
```

Na inicialização do servidor:
```js
async function resetStaleReactivationRunners() {
  await supabase
    .from('reactivation_campaigns')
    .update({ status: 'paused' })
    .eq('status', 'running');
}
```

---

## 10. Diagrama do Fluxo de Reativação

```
Usuário clica "Disparar"
        │
        ▼
Modal Wizard (3 passos)
  1. Seleciona contatos (máx 10 recomendado)
  2. Redige mensagem com spin opcional
  3. Seleciona intervalo entre envios
        │
        ▼
Clica "Preparar Reativação"
POST /api/reactivation/:id/prepare
  → Chama Anthropic API com as 5 referências
  → Recebe N variações únicas (uma por contato)
  → Para cada dispatch:
      variations[i]            → message_sent único por contato
      getReactivationTypingDelay() → 2000–3800ms
      getRandomDelay(min, max) → intervalo não-redondo
        │
        ▼
Resumo exibido → usuário confirma
        │
        ▼
POST /api/reactivation/:id/start
        │
        ▼
_executeReactivation() em background
        │
        ▼
┌──────────────────────────────────────┐
│         LOOP DE REATIVAÇÃO           │
│                                      │
│  1. Próximo dispatch pending         │
│     └─ Vazio? → completed           │
│                                      │
│  2. message_sent + typing_delay      │
│     (já preparados)                  │
│                                      │
│  3. uazapi.sendTextByToken()         │
│     com typing_delay 2000–3800ms     │
│                                      │
│  4. Sucesso:                         │
│     reactivation_dispatches → sent  │
│     contacts.reactivation_count+1   │
│     io.emit(reactivation:dispatch:sent) │
│                                      │
│  5. Countdown com interval_delay_ms  │
│     (preparado, não-redondo)         │
│     io.emit(reactivation:countdown) │
│                                      │
└──────────────────────────────────────┘
        │
        ▼
reactivation_campaigns.status = 'completed'
io.emit('reactivation:completed')

Frontend (ReativarDetalhe.jsx)
  ├─ socket.on('reactivation:dispatch:sent')   → atualiza tabela
  ├─ socket.on('reactivation:dispatch:failed') → atualiza tabela
  ├─ socket.on('reactivation:countdown')       → atualiza barra
  └─ socket.on('reactivation:completed')       → recarrega dados
```

---

## 11. Pacotes NPM

### Backend
```json
{
  "express": "^4.x",
  "socket.io": "^4.x",
  "axios": "^1.x",
  "@supabase/supabase-js": "^2.x",
  "@anthropic-ai/sdk": "^0.x",
  "dotenv": "^16.x"
}
```

### Frontend
```json
{
  "socket.io-client": "^4.x",
  "react-router-dom": "^6.x"
}
```

---

## 12. Resumo das Diferenças em Relação ao Fluxo Original

| Aspecto | Campanhas Normais | Reativação |
|---|---|---|
| Fonte dos contatos | Nicho ou lista manual | Seleção manual por checkbox na UI |
| Template | Múltiplos templates no banco | 5 mensagens de referência redigidas no wizard |
| Geração de variação | Spinner `{a\|b}` + fillers | IA (Anthropic API) gera variações únicas por contato |
| Typing delay | 2000–5000ms | 2000–3800ms |
| Intervalo | Definido na criação | Selecionado via opções pré-definidas |
| Interval delay | Gerado no loop | Gerado no "Preparar" e salvo por dispatch |
| Contagem de envios | `contacts.sent_count` | `contacts.reactivation_count` |
| Recomendação de volume | Sem aviso fixo | Aviso: máx 10 contatos / 4 horas |
| Preparação obrigatória | Shuffle é opcional | Prepare é obrigatório para iniciar |
| Dependência externa extra | — | `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` |
