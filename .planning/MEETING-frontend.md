# Contribuicao: alliance-frontend
**Data:** 2026-03-28
**Contexto:** Analise pos-implementacao das fases 4, 5 e 6 (Kanban, Agenda, Interacoes)

---

## Bugs e Edge Cases Criticos

### kanban-board.tsx

**[BUG-01] Drag conflita com click no LeadCard**
`useDraggable` distribui `{...listeners}` no mesmo elemento do `onClick`. O `PointerSensor` com `distance: 5` mitiga, mas em dispositivos touch o delta raramente chega a 5px antes de disparar o click. Resultado: o modal abre no meio de um drag lento. Fix: usar `DragOverlay` e separar o handle de drag do wrapper clicavel.

**[BUG-02] Optimistic update do modal fica dessincronizado do card**
`selectedLead` e `leads[]` sao estados independentes. Se o usuario abre o modal de um lead, outro usuario arrasta esse mesmo lead para outra coluna via Realtime (quando implementado) e o modal ainda exibe o `stage` antigo. A funcao `handleTogglePause` ja sincroniza `selectedLead` mas `handleDragEnd` nao. Fix: derivar `selectedLead` do array `leads` em vez de estado separado.

**[BUG-03] onAssume e no-op**
`KanbanBoard` passa `onAssume={() => {}}` para `LeadDetailModal`. O botao "Assumir conversa" esta visualmente presente mas nao executa nada. Nao ha feedback de erro nem desativacao do botao.

**[BUG-04] Sem limite de colunas por tamanho de tela**
`min-w-[260px]` com 7 colunas = 1820px minimo. Em notebooks 1366px a ultima coluna fica inacessivel e o `overflow-x-auto` nao tem scroll hint visual.

### lead-detail-modal.tsx

**[BUG-05] Cores hardcoded violam o design system**
`STAGE_COLORS` usa valores hex literais (`#1E90FF`, `#FF8C00`, etc.) em vez dos tokens Tailwind (`alliance.blue`, `badge.morno`, etc.). O header usa `style={{ backgroundColor: '#0A2EAD' }}` em vez de `bg-alliance-dark`. Qualquer rebrand nos tokens nao propagara para o modal.

**[BUG-06] `tempoNoStage` usa `updated_at` — nao e o tempo no stage**
`updated_at` muda em qualquer update do lead (ex: `automation_paused`). O campo correto seria um `stage_changed_at` dedicado. Atualmente um lead que teve a automacao pausada hoje aparece "ha 3 minutos neste stage" mesmo estando no stage ha semanas.

**[BUG-07] `interaction_count` pode ser `null`/`undefined`**
O campo e renderizado diretamente sem fallback: `{lead.interaction_count}`. Se o banco retornar `null` (lead novo sem interacoes), o componente exibe "null interacoes".

### interacoes-client.tsx

**[BUG-08] `messages` nunca atualiza — `useState` sem setter exposto**
```typescript
const [messages] = useState<Interaction[]>(initialMessages)
```
O setter foi desestruturado mas nao guardado. Ao enviar uma mensagem via `onSend`, o fetch chama a API mas o estado local nao e atualizado. O chat nao mostra a mensagem enviada ate um reload completo da pagina.

**[BUG-09] `onSend` ignora o retorno e nao trata erros**
A funcao anonima passa `async` mas nao ha `try/catch`, nenhum toast de erro, nenhum estado de loading no botao de envio. Uma falha silenciosa da ao usuario a impressao que a mensagem foi enviada.

**[BUG-10] Ao trocar de lead, scroll nao resetado**
`ChatArea` tem um `useEffect` que chama `scrollIntoView` ao mudar `messages`. Mas ao trocar `activeLeadId`, as mensagens filtradas mudam e o scroll vai para o fim — correto. Porem se o lead anterior estava no meio do historico e o novo lead tem menos mensagens, pode nao haver scroll suficiente e o `bottomRef` pode estar acima da viewport sem disparar o effect. Baixa prioridade mas perceptivel em conversas longas seguidas de conversas curtas.

### leads-sidebar.tsx

**[BUG-11] `lead.name` pode ser string vazia — crash no `charAt(0)`**
O avatar usa `lead.name.charAt(0).toUpperCase()`. Se `name` for `""` ou `null` (leads capturados apenas por telefone), exibe um avatar em branco sem fallback para inicial do telefone.

**[BUG-12] Search filtra apenas `name` e `phone` localmente — lista limitada a 50 leads**
A pagina `interacoes/page.tsx` busca `.limit(50)`. Se o lead buscado estiver fora dos 50 mais recentes, a busca retorna vazio. O usuario nao sabe que existem mais leads fora da janela.

### agenda-client.tsx

**[BUG-13] `handleMeetingCreated` reconstroi `MeetingWithLead[]` com dados incompletos**
Ao recarregar reunioes apos criacao, o fetch retorna apenas `{ id, datetime, lead_id, assigned_to }`. O mapeamento usa `leads.find(l => l.id === m.lead_id)?.name ?? 'Lead'` mas `consultant_name` sempre fica `'Consultor'` e `consultant_color` fixo em `'#0A2EAD'`. Pills de reunioes recentes perdem a cor real do consultor ate o proximo reload full da pagina.

**[BUG-14] "+N mais" no calendario nao faz nada**
```typescript
<span className="... cursor-pointer hover:underline">
  +{dayMeetings.length - 2} mais
</span>
```
Nao ha handler de click. O usuario ve que existem mais reunioes mas nao consegue acessa-las.

**[BUG-15] Timezone nao considerado em `isSameDay`**
`isSameDay(new Date(m.datetime), day)` usa o timezone local do browser. Reunioes salvas em UTC podem aparecer no dia anterior ou seguinte dependendo do fuso do usuario. Necessario `parseISO` + `toZonedTime` (date-fns-tz) ou normalizacao consistente no banco.

---

## States Faltantes (empty/loading/error por pagina)

### /kanban

| Estado | Situacao atual | Necessidade |
|--------|---------------|-------------|
| Loading inicial | Sem skeleton — SSC aguarda silenciosamente | Skeleton de 7 colunas com 3-4 cards fantasma cada |
| Erro de fetch | `getLeads()` retorna `[]` em silencio — board aparece vazio como se nao houvesse leads | Toast de erro + estado visual "Nao foi possivel carregar leads" com botao retry |
| Board vazio (leads = 0) | Todas as colunas mostram "Arraste um lead aqui" — correto, mas sem CTA de criacao | Empty state central com botao "Criar primeiro lead" |
| Drag em curso | Sem DragOverlay — o card original fica `opacity-40`, mas nao ha preview floating | DragOverlay com card clone |
| Erro no move-stage | Toast de erro aparece + rollback — correto | Adicionar indicador visual no card durante a requisicao (opacity reduzida + spinner) |

### /interacoes

| Estado | Situacao atual | Necessidade |
|--------|---------------|-------------|
| Loading sidebar | Sem skeleton — lista aparece instantaneamente ou fica em branco | Skeleton de 5-6 itens na sidebar |
| Loading mensagens | Sem skeleton — area de chat em branco ate hidratar | Skeleton de 3-4 bolhas alternadas |
| Erro de fetch (page.tsx) | Retorna `[]` silenciosamente | Banner de erro no topo com mensagem clara |
| Enviando mensagem | Sem feedback visual — botao Send sempre clicavel | Loading spinner no botao + input desabilitado durante envio |
| Mensagem falhou | Sem tratamento | Bolha com indicador de falha + botao "Reenviar" |
| Lead sem historico | "Nenhuma mensagem ainda" — correto | Melhorar com ilustracao e instrucao contextual |

### /agenda

| Estado | Situacao atual | Necessidade |
|--------|---------------|-------------|
| Loading calendario | Sem skeleton | Skeleton do grid 7x5 |
| Criando reuniao | Dialog fecha apos submit sem feedback | Loading no botao "Criar" do dialog + toast de sucesso/erro |
| Erro ao criar | Sem tratamento no `CreateMeetingDialog` (nao foi lido mas inferido pelo padrao do projeto) | Toast de erro + dialog permanece aberto |
| Mes sem reunioes | Contador some (condicional `totalMeetingsThisMonth > 0`) — correto | Poderia manter o badge com "0 reunioes" para feedback de consistencia |

### /kanban — LeadDetailModal

| Estado | Situacao atual | Necessidade |
|--------|---------------|-------------|
| Toggle pause carregando | Sem feedback — botao clicavel imediatamente de novo | Desabilitar botao + spinner durante `fetch` |
| Assumir conversa carregando | no-op — nenhum feedback possivel | Implementar a acao e adicionar loading state |

---

## Features de Interacao (search, filter, keyboard)

### Kanban

**[FEAT-01] Busca global de leads no Kanban ausente**
O header do Kanban tem apenas "Etiquetas" e "+ Novo Lead". Nao ha como buscar um lead especifico sem percorrer visualmente todas as colunas. Necessita campo de busca que destaque cards correspondentes e diminua a opacidade dos demais.

**[FEAT-02] Filtros de coluna ausentes**
Nao e possivel filtrar por: `automation_paused`, `assigned_to`, `city`, `imovel_interesse`. Em pipelines com muitos leads isso torna impossivelidentificar subgrupos rapidamente.

**[FEAT-03] Ordenacao interna de coluna ausente**
Cards dentro de cada coluna aparecem em ordem de `updated_at` (desc) herdada da query. Nao ha ordenacao manual por drag dentro da coluna (sem SortableContext do @dnd-kit).

**[FEAT-04] Keyboard shortcuts ausentes no Kanban**
- `Escape` para fechar o modal — ja funciona via Sheet/Radix mas nao documentado
- `Arrow Keys` para navegar entre leads dentro de um modal seria valioso
- `Ctrl+F` para ativar busca

**[FEAT-05] "+ Novo Lead" sem funcionalidade**
Botao no header do KanbanPage nao tem handler. Necessita dialog de criacao rapida de lead com pelo menos `name` e `phone`.

**[FEAT-06] "Etiquetas" sem funcionalidade**
Botao presente mas sem acao. O ROADMAP menciona etiquetas mas nao implementa.

### Interacoes / Chat

**[FEAT-07] Scroll to bottom button ausente**
Ao rolar para cima no historico, nao ha botao flutuante para voltar ao fim. O `useEffect` sempre rola para baixo ao mudar `messages`, o que seria intrusivo se o usuario estiver lendo mensagens antigas.

**[FEAT-08] `Enter` para enviar ja implementado — `Shift+Enter` para nova linha ausente**
Atualmente `Enter` sempre envia. Mensagens longas com quebras de linha sao impossiveis de compor.

**[FEAT-09] Indicador de unread messages na sidebar ausente**
Nenhum badge numerico ou ponto de notificacao para indicar leads com mensagens nao lidas. A ordenacao por `lastMessageAt` ajuda mas nao e suficiente.

**[FEAT-10] Paginacao de mensagens ausente**
`interacoes/page.tsx` busca `.limit(500)` de interacoes para todos os 50 leads. Em producao isso vai ser 500 registros na memoria do cliente independente do lead ativo. Necessita busca lazy por lead ao selecionar.

**[FEAT-11] Sidebar sem unread count / badge de status de automacao insuficiente**
Apenas `PauseCircle` e `Bot` aparecem — nenhuma indicacao de "consultor X esta atendendo" ou de mensagem nao respondida ha X horas.

### Agenda

**[FEAT-12] Click em celula do calendario nao abre CreateMeetingDialog pre-preenchido**
Clicar em um dia especifico deveria abrir o dialog com a data pre-selecionada. Atualmente o unico acesso e o botao "Nova Reuniao" no toolbar.

**[FEAT-13] Visualizacao diaria/semanal ausente**
Apenas visao mensal. Dias com muitas reunioes ficam truncados em "+N mais" sem expandir. Uma visao de semana com horarios resolveria o overflow de pills.

**[FEAT-14] Click em pill de reuniao nao abre detalhes**
`MeetingPill` e um elemento visual sem interacao. Nao ha como ver detalhes, editar ou cancelar uma reuniao existente.

---

## Realtime — O que falta

### Kanban — Realtime nao implementado (KBAN-07 pendente)

O ROADMAP exige: "Two browser tabs: moving a card in one updates the other in real time."

**O que e necessario:**

1. **Canal `leads` no KanbanBoard** — subscribe em `UPDATE` da tabela `leads`:
   ```typescript
   supabase
     .channel('kanban-leads')
     .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
       setLeads(prev => prev.map(l => l.id === payload.new.id ? payload.new as Lead : l))
     })
     .subscribe()
   ```

2. **Conflito de estado local vs Realtime** — se o usuario esta arrastando um card enquanto chega um UPDATE do Realtime para esse mesmo lead, o estado pode colidir. Necessita lock otimista: ignorar updates do Realtime para o `leadId` que esta sendo arrastado no momento.

3. **Novo lead criado por outro usuario** — evento `INSERT` nao e tratado. Um lead criado via webhook do WhatsApp aparece no banco mas nao no Kanban de outros usuarios.

4. **Presenca (quem esta vendo qual lead)** — nao esta no ROADMAP obrigatorio mas seria valioso para evitar dois consultores tentando assumir o mesmo lead simultaneamente.

### Chat / Interacoes — Realtime critico e nao implementado (INAT-08 pendente)

Este e o item de maior impacto operacional. Consultores atualmente precisam recarregar a pagina para ver novas mensagens.

**O que e necessario:**

1. **Canal `interactions` por lead ativo:**
   ```typescript
   // Ao selecionar um lead, subscribe no canal desse lead
   // Ao trocar de lead, unsubscribe do anterior
   supabase
     .channel(`chat-${activeLeadId}`)
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'interactions',
       filter: `lead_id=eq.${activeLeadId}`
     }, (payload) => {
       setMessages(prev => [...prev, payload.new as Interaction])
     })
     .subscribe()
   ```

2. **Cleanup obrigatorio** — o channel deve ser removido no `useEffect` cleanup ao trocar `activeLeadId` ou desmontar. Channels acumulados causam vazamento de memoria e duplicacao de eventos.

3. **Atualizacao do `lastMessage` na sidebar** — quando uma nova interacao chega para o lead ativo, o item na `LeadsSidebar` deve atualizar `lastMessage` e `lastMessageAt` e reordenar a lista. Isso requer ou um segundo canal na tabela `leads` (UPDATE de `updated_at`) ou reordenacao local apos INSERT em `interactions`.

4. **Badge de online/digitando** — fora do escopo do ROADMAP v1 mas viavel com Supabase Presence.

### Kanban + Chat — Sincronizacao de `automation_paused`

Quando um consultor pausa a automacao no Kanban (modal), o ChatHeader da tela de Interacoes ainda mostra "IA ativa" para outro consultor na mesma tela. Necessita canal compartilhado ou invalidacao de dados.

---

## Proximas Features do ROADMAP nao implementadas

### Phase 7: WhatsApp + IA (nao iniciado)

- **Webhook Meta GET/POST** — rota `/api/webhooks/whatsapp` ausente. Sem isso nenhuma mensagem WhatsApp entra no sistema.
- **HMAC SHA-256 validation** — validacao de `X-Hub-Signature-256` ausente em todas as rotas de webhook.
- **Agente IA com contexto** — o fluxo N8N descrito no MASTER-PLAN (name, stage, intention, imovel, summary, historico) nao existe. Atualmente a IA (se houver) opera sem contexto do CRM.
- **Auto-avanco de stage** — `>= 5 interacoes → lead_morno`, `>= 10 → lead_quente` nao implementado.
- **Atualizacao de `summary`** — campo existe no schema mas nunca e escrito apos respostas da IA.

### Phase 9: Disparos (nao iniciado)

- Pagina `/disparos` ausente.
- CSV upload com validacao E.164 ausente.
- TemplateSelector (Meta API) ausente.
- Progress bar Realtime de campanha ausente.

### Features de Fase 4 pendentes (KBAN-04 a KBAN-08 parcialmente ausentes)

- **"Assumir conversa"** — botao presente no modal mas `onAssume={() => {}}`. Necessita: `PATCH /api/leads/{id}/assign` + atualizar `assigned_to` com `user.id` + mudar badge do card de "agente de IA" para nome do consultor com `badge_color`.
- **Etiquetas** — botao presente na pagina sem funcionalidade.
- **Criacao de lead manual** — "+ Novo Lead" sem handler.
- **DragOverlay** — arrasto sem preview floating.
- **`badge_color` do banco nos cards** — atualmente o badge "Consultor" usa `bg-gray-100` fixo. O ROADMAP exige a cor do `user_profiles.badge_color`.

### Features de Fase 5 pendentes

- **Sync Kanban → Agenda** — mover card para `reuniao_agendada` deveria abrir `CreateMeetingDialog` com lead pre-preenchido. Nao implementado.
- **Detalhes de reuniao ao clicar no pill** — pill e puramente visual.
- **Cancelar/editar reuniao** — sem funcionalidade de CRUD completo.

### Features de Fase 6 pendentes

- **`sender_id` nas mensagens** — o schema do MASTER-PLAN adiciona `sender_id` em `interactions` para distinguir IA vs corretor, mas `MessageBubble` usa apenas `message.direction` e o prop `isIA` derivado do lead — nao da mensagem individual. Ao assumir a conversa e responder, a mensagem ainda aparece com o badge "agente de IA".
- **Envio real via Meta API** — `/api/leads/{id}/send-message` pode nao chamar a Meta API (nao lido, mas a integracao depende de Phase 7).

---

## Prioridade Maxima (top 5)

| # | Item | Impacto | Arquivo(s) |
|---|------|---------|-----------|
| 1 | **Realtime no Chat** — consultores precisam recarregar a pagina para ver mensagens novas. Bloqueia uso operacional da tela de Interacoes. | Critico | `interacoes-client.tsx` |
| 2 | **BUG-08: `messages` sem setter** — mensagens enviadas manualmente nao aparecem no chat sem reload. A feature de envio manual existe mas e invisivel para o usuario. | Critico | `interacoes-client.tsx` |
| 3 | **BUG-03: `onAssume` no-op** — botao principal do modal sem acao. Um botao proeminente que nao faz nada danifica a credibilidade do sistema. | Alto | `kanban-board.tsx`, `lead-detail-modal.tsx` |
| 4 | **Realtime no Kanban** — KBAN-07 e criterio de aceite da Phase 4. Multiplos consultores trabalhando simultaneamente verao dados desatualizados. | Alto | `kanban-board.tsx` |
| 5 | **BUG-05: cores hardcoded no modal** — viola a regra absoluta do CLAUDE.md. Qualquer ajuste de tokens nao propagara e cria inconsistencia visual com o resto do sistema. | Medio-alto | `lead-detail-modal.tsx` |
