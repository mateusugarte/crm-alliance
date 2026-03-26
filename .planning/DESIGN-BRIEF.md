# Design Brief — CRM Alliance

## Tokens de cor Alliance

| Token Tailwind | Hex | Propósito |
|---|---|---|
| `alliance.blue` | `#1E90FF` | Azul vivo — títulos de página, pills de mensagem inbound, CTAs secundários, célula de hoje no calendário, lead frio no Kanban |
| `alliance.dark` | `#0A2EAD` | Azul escuro — sidebar de Interações, cards featured do Dashboard, botão "Entrar", badge padrão (IA e ADM) |
| `alliance.mid` | `#1565C0` | Azul médio — blob do header e nav (`BlobHeader`) |
| `alliance.card` | `#F0F0F0` | Cinza claro — cards secundários do Dashboard |
| `alliance.col` | `#E8E8E8` | Cinza suave — fundo das colunas do Kanban |
| `alliance.input` | `#D9D9D9` | Cinza médio — campos de input, fundos neutros |
| `alliance.chat` | `#CCCCCC` | Cinza — área de chat nas Interações (fundo da janela de mensagens) |

## Tokens de badge/status

| Token Tailwind | Hex | Propósito |
|---|---|---|
| `badge.joao` | `#FF6B00` | Badge do consultor João (cor dinâmica via `user_profiles.badge_color`) |
| `badge.mateus` | `#3D3D3D` | Badge do consultor Mateus — padrão para novos corretores |
| `badge.ia` | `#0A2EAD` | Badge "agente de IA" — lead sem consultor atribuído |
| `badge.quente` | `#FF4500` | Status Lead Quente — coluna Kanban + indicador visual |
| `badge.morno` | `#FF8C00` | Status Lead Morno — coluna Kanban + indicador visual |
| `badge.frio` | `#1E90FF` | Status Lead Frio — coluna Kanban + indicador visual |

> Nota: a cor de cada consultor é lida dinamicamente de `user_profiles.badge_color` no banco — os tokens acima são os valores de seed iniciais.

---

## Componentes críticos por fase

### Phase 1 — Design System

Componentes: `blob-bottom`, `blob-header`, `nav-shell`, `alliance-badge`, `alliance-card`, `page-transition`

**Blobs (clip-path CSS — não border-radius):**
```css
/* Rodapé splash e login — semicírculo voltado para cima */
.blob-bottom {
  clip-path: ellipse(75% 100% at 50% 100%);
  background: #1E90FF;
}

/* Header e nav — semicírculo no canto superior direito */
.blob-header {
  clip-path: ellipse(60% 100% at 100% 0%);
  background: #1565C0;
}
```

**Animações principais:**

- **Splash → transição para Login:**
  - Duração total: 0.4s
  - `opacity 0→1` + `y 16→0` com `ease-out`
  - Usar `AnimatePresence` para saída do splash antes de montar o login

- **Login card:**
  - Variante `modalAnimation`: `scale 0.95→1` + `opacity 0→1`, 0.2s `ease-out`
  - Card flutua sobre o blob azul inferior (`blob-bottom`)

- **Nav (NavShell):**
  - Pill de item ativo: `color transition` 0.3s ao mudar de rota
  - Entrada inicial do shell: `pageTransition` — `opacity 0→1` + `y 16→0`, 0.25s

---

### Phase 3 — Dashboard

Componentes críticos:

1. **MetricCard**
   - Props: `title: string`, `value: number`, `variant: 'featured' | 'default'`
   - `variant="featured"`: fundo `alliance.dark` (#0A2EAD), texto branco (ex: "Leads totais", "Disponíveis")
   - `variant="default"`: fundo `alliance.card` (#F0F0F0), texto escuro
   - Animação: contador numérico animado de `0` até `value` com Framer Motion spring (`stiffness: 100`) na montagem
   - Entrada: `staggerItem` — `opacity 0→1` + `y 12→0` com `staggerContainer` (delay entre cards: 0.05s)

2. **RevenueChart** (gráfico de barras — Chart.js)
   - Props: `data: { label: string; value: number }[]`, `title: string`
   - Barras na cor `#1E90FF` (alliance.blue)
   - Animação de entrada: `staggerItem` ao montar o container do gráfico
   - Título em `alliance.blue` bold acima do gráfico

3. **LeadsByStageChart** (gráfico de barras — Chart.js)
   - Props: `data: { stage: string; count: number }[]`, `title: string`
   - Barras na cor `#1E90FF`
   - Exibido lado a lado com `RevenueChart` em grid 2 colunas
   - Skeleton de loading enquanto dados do Supabase carregam

Grid de métricas: layout 2×3 (2 linhas, 3 colunas). Saudação acima do grid: `"BEM-VINDO, [nome]!"` em `alliance.blue` bold.

---

### Phase 4 — Kanban

Componentes críticos:

1. **KanbanColumn**
   - Props: `stage: LeadStage`, `leads: Lead[]`, `color: string`
   - Estágios e cores dos ícones/headers de coluna:
     - `lead_frio` → `#1E90FF`
     - `lead_morno` → `#FF8C00`
     - `lead_quente` → `#FF4500`
     - `reuniao_agendada` → `#228B22`
     - `follow_up` → cor neutra
     - `visita_confirmada` → cor neutra
   - Fundo da coluna: `alliance.col` (#E8E8E8)
   - Animação: `staggerContainer` nos filhos ao carregar

2. **LeadCard** (draggable via dnd-kit)
   - Props: `lead: Lead`, `onCardClick: (lead: Lead) => void`
   - Badge dinâmico: se `assigned_to` é null → badge "agente de IA" (`badge.ia` #0A2EAD); se atribuído → nome do consultor na cor `user_profiles.badge_color`
   - Indicador de `automation_paused`: ícone/badge de pausa visível no card
   - Animação drag: `dragCard` — `scale 1→1.03` + `boxShadow: '0 8px 24px rgba(0,0,0,0.12)'` durante o arraste
   - Hover: `cardHover` — `y: -2`, 0.15s

3. **LeadModal**
   - Props: `lead: Lead | null`, `isOpen: boolean`, `onClose: () => void`
   - Conteúdo: nome, telefone, cidade, imóvel de interesse, intenção (morar/investir), tempo no stage, resumo da conversa (IA)
   - Botões: "Assumir conversa" (atribui corretor logado + muda badge) e "Pausar automação" (toggle)
   - Animação: `modalAnimation` — `scale 0.95→1` + `opacity 0→1`, 0.2s `ease-out`
   - `AnimatePresence` para entrada e saída suave

---

### Phase 5 — Agenda

Componentes críticos:

1. **CalendarGrid**
   - Props: `year: number`, `month: number`, `meetings: Meeting[]`
   - Abreviações dos dias em português: `seg, ter, qua, qui, sex, sáb, dom`
   - Célula do dia atual: fundo `alliance.blue` (#1E90FF)
   - Navegação por mês/ano (seletores ou botões prev/next)
   - Sincronizado com o Kanban: mover card para `reuniao_agendada` abre `NewMeetingModal` com lead pré-preenchido

2. **MeetingPill**
   - Props: `meeting: Meeting`, `consultorColor: string`
   - Cor de fundo: `user_profiles.badge_color` do consultor responsável (dinâmico do banco)
   - Texto branco, layout compacto (nome do lead + horário)
   - Exibido dentro da célula do dia no `CalendarGrid`

3. **NewMeetingModal**
   - Props: `lead?: Lead`, `defaultDate?: Date`, `isOpen: boolean`, `onClose: () => void`, `onSave: (meeting: NewMeeting) => void`
   - Lead pré-preenchido quando disparado pelo Kanban
   - Campos: lead, data/hora, consultor responsável, observações
   - Animação: `modalAnimation` — `scale 0.95→1` + `opacity 0→1`, 0.2s `ease-out`
   - `AnimatePresence` para entrada e saída

---

### Phase 6 — Imóveis + Interações

#### Componentes críticos (Imóveis)

1. **ImovelCard**
   - Props: `imovel: Imovel` (com campos: nome, metragem, quartos, suites, diferenciais, faixa_valor, disponibilidade)
   - As 6 unidades: Apto 01 (146m²), Apto 02 (90,80m²), Apto 03 (110,85m²), Apto 04 (144,80m²), Cobertura 01 (245,60m²), Cobertura 02 (259,95m²)
   - Hover: `cardHover` — `y: -2`, 0.15s
   - Badge de disponibilidade visível (disponível / reservado / vendido)
   - Entrada: `staggerItem` em grid com `staggerContainer`

2. **ImovelModal**
   - Props: `imovel: Imovel | null`, `isOpen: boolean`, `onClose: () => void`
   - Exibe: galeria/imagem, metragem, quartos, suítes, diferenciais, faixa de valor, status de disponibilidade
   - Animação: `modalAnimation` — `scale 0.95→1` + `opacity 0→1`, 0.2s `ease-out`

#### Componentes críticos (Interações)

1. **ConversationSidebar**
   - Props: `leads: Lead[]`, `activeLeadId: string | null`, `onSelectLead: (leadId: string) => void`
   - Layout estilo WhatsApp: sidebar esquerda com fundo `#0A2EAD` (alliance.dark)
   - Logo Alliance no topo (branco)
   - Lista de leads ordenada por última interação (mais recente primeiro)
   - Lead ativo: fundo `#1E90FF` (alliance.blue)
   - Cada item: nome do lead + preview da última mensagem + timestamp
   - Animação de entrada da sidebar: `x -20→0` + `opacity 0→1`, 0.25s `ease-out`

2. **MessageBubble**
   - Props: `interaction: Interaction`, `variant: 'inbound' | 'outbound-ia' | 'outbound-corretor'`
   - `variant="inbound"`: pill azul (`#1E90FF`), alinhado à esquerda
   - `variant="outbound-ia"`: card branco, alinhado à direita, badge "agente de IA" abaixo (cor `badge.ia` #0A2EAD)
   - `variant="outbound-corretor"`: card branco, alinhado à direita, nome do corretor abaixo
   - Timestamp em texto pequeno em todos os variants
   - Novas mensagens aparecem via Supabase Realtime sem reload

3. **ChatInput**
   - Props: `leadId: string`, `automationPaused: boolean`, `onSend: (message: string) => Promise<void>`
   - Visível somente quando `automationPaused = true` (ou lead no stage `cliente`)
   - Envio via `/api/leads/{id}/send-message` → Meta API (`sendTextMessage`)
   - Fundo da área de chat: `alliance.chat` (#CCCCCC)
   - Header do chat: fundo `alliance.dark`, nome do lead + telefone + ícones (pausar IA, indicador IA ativo)

---

## Padrões de animação obrigatórios

Todos os variants abaixo devem ser exportados de `src/lib/utils/animations.ts` e reutilizados em toda a aplicação:

```typescript
// Transição de página — toda troca de rota
export const pageTransition = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: 'easeOut' }
}

// Modal e Sheet — toda abertura de overlay
export const modalAnimation = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: 'easeOut' }
}

// Container de listas com entrada escalonada
export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } }
}

// Item de lista com entrada escalonada
export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 }
}

// Hover em cards clicáveis
export const cardHover = {
  whileHover: { y: -2, transition: { duration: 0.15 } }
}

// Card do Kanban durante arraste (dnd-kit)
export const dragCard = {
  whileDrag: { scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }
}
```

**Regras adicionais:**
- Usar `AnimatePresence` para TODA entrada e saída de modais, cards e sidebars
- Respeitar `prefers-reduced-motion`:
  ```typescript
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ```
  Quando `prefersReduced = true`, substituir animações por `opacity` simples (sem translate/scale)
- Splash → Login: duração total de 0.4s (critério de aceite da Phase 1)
- Badge de status no Kanban: `color transition 0.3s` ao mudar de stage

---

## Copy (textos exatos)

- **Splash CTA:** Nenhum texto de botão definido — tela de splash animada que transiciona automaticamente para `/login`
- **Login botão:** `"Entrar"` — fundo `alliance.dark` (#0A2EAD), texto branco
- **Saudação Dashboard:** `"BEM-VINDO, [NOME]!"` em `alliance.blue` bold
- **Badge IA:** `"agente de IA"`
- **Botão assumir lead:** `"Assumir conversa"`
- **Botão pausar IA:** `"Pausar automação"`

**Estados vazios por página:**

| Página | Mensagem de estado vazio |
|---|---|
| Dashboard | Skeletons de loading enquanto dados carregam (sem estado vazio real — dados sempre presentes) |
| Kanban | Coluna sem cards: área vazia silenciosa (sem copy — só o fundo `alliance.col`) |
| Agenda | Mês sem reuniões: células do calendário vazias, sem mensagem adicional |
| Imóveis | Dados vêm do seed do banco — não há estado vazio esperado |
| Interações | Sidebar sem leads: aguardar primeiro lead via WhatsApp; chat sem lead selecionado: área em branco com instruções implícitas no layout |

---

## Design aprovado: SIM
