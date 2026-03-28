# Design Upgrade — CRM Alliance
> Análise estratégica | Data: 2026-03-28

---

## Diagnóstico por Página

### /dashboard

**O que está bom:**
- Hierarquia básica existe: eyebrow label em uppercase/tracking-widest acima do h1.
- MetricCard com `variant="featured"` (fundo `alliance-dark`) quebra a monotonia do grid — há contraste.
- CountUp animado (`useCountUp` com cubic-ease) é um detalhe de qualidade que funciona.
- Stagger de 0.05s entre cards é sutil e correto.
- Skeleton de loading existe e tem a forma certa dos cards.

**O que está medíocre:**
- Grid 3×2 com seis `MetricCard` todos da mesma altura e quase do mesmo tamanho visual. Não existe hierarquia dimensional: o card "Total de Leads" (featured) tem o mesmo tamanho que "Reuniões Hoje" (default). Em Linear e Vercel o card principal ocupa coluna dupla ou tem tipografia visivelmente maior.
- Os dois gráficos de barras lado a lado são funcionais mas genéricos. Títulos em `uppercase tracking-wider` repetem o padrão de todo o resto — sem diferenciação. O fundo `bg-white rounded-2xl` dos gráficos é idêntico ao dos cards, causando achatamento visual.
- A saudação `"BEM-VINDO DE VOLTA"` (eyebrow) + `h1` com nome do usuário usa `text-3xl font-bold` mas o nome aparece em `text-alliance-dark` sem nenhuma diferenciação visual do restante — poderia ter um toque de cor ou peso diferente.
- `border border-gray-100` em todos os cards default cria ruído: múltiplas bordas finas no mesmo tom de cinza não constroem elevação, apenas acumulam linhas sem propósito.
- O background da página é `bg-gray-50` (hardcoded no layout), enquanto os cards são `bg-white`. A diferença de 3 tons é pequena demais para criar profundidade real e grande demais para ser invisível — parece descuido.
- Nenhum indicador de tendência (seta para cima/baixo, delta percentual) nas métricas. Vercel Dashboard nunca mostra um número sem contexto de variação.

**O que está feio/errado:**
- `bg-alliance-blue/3` na célula de hoje no calendário (só mencionado no código da agenda, mas o padrão de opacidades muito baixas como `/3` é inconsistente e em alguns monitores aparece idêntico ao fundo branco).
- O ChartsSkeleton usa `Math.random()` para definir alturas dos esqueletos — em cada renderização as barras têm alturas diferentes. Isso causa um flash de layout entre server render e client hydration.
- A cor dos gráficos Chart.js é hardcoded como `'#1E90FF'` dentro do componente, duplicando o token. Se o token mudar, o gráfico não acompanha.
- Os dois gráficos (Reuniões / Leads) são literalmente idênticos em aparência — mesma cor, mesmo tipo de barra, mesmo container. Sem nenhuma diferenciação visual, o usuário tem que ler o título para distingui-los.

---

### /kanban

**O que está bom:**
- Colunas com cor semântica por estágio (azul=frio, laranja=morno, vermelho=quente) é a decisão certa.
- Header de coluna com badge de contagem circular funciona bem.
- LeadCard com `border-l-4 border-l-orange-400` para leads pausados é um microdetalhe correto — cria escaneabilidade.
- Realtime funcionando com toast de confirmação.
- Estado vazio da coluna com `border-dashed` existe.
- Drag com rotação de 1.5deg + scale 1.02 é o detalhe certo.

**O que está medíocre:**
- Coluna fundo `bg-[#E8E8E8]` (hardcoded inline como string hexadecimal, não usa o token `alliance-col`). O token existe no CSS mas não está sendo lido via classe Tailwind — é string literal no style.
- O header de cada coluna usa `backgroundColor: column.color + '18'` — hex com alpha concatenado por string. Isso é frágil e não é um token. Se o hex for de 3 dígitos curtos, quebra.
- A barra de busca + filtro acima do board flutua sem âncora visual. Em Linear, a toolbar do Kanban tem separação clara do board — aqui ela simplesmente existe "no ar" antes das colunas.
- `min-w-[260px] max-w-[260px]` fixo para todas as colunas. Em monitores largos (1440px+) fica um espaço morto enorme à direita. Em monitores menores, o overflow-x-auto sem scrollbar visível é frustrante.
- O modal de detalhe (`LeadDetailModal`) usa `Sheet` (painel lateral) mas o `SheetContent` tem `width: 480` e `maxWidth: 480` hardcoded inline em pixels — não usa tokens de espaçamento. Em telas menores vai quebrar o layout.
- Seções do modal (Informações, Qualificação, Automação, Resumo IA, Métricas, Ações) são separadas por `border-t border-gray-100` mas têm o mesmo espaçamento (`py-5` + `gap-5`) — parecem cópias umas das outras sem hierarquia interna.

**O que está feio/errado:**
- O LeadCard tem classes Tailwind conflitantes para a borda esquerda: `border border-gray-100 border-l-4 border-l-orange-400`. Em Tailwind, `border` define todas as bordas e `border-l-4` sobrescreve só a esquerda, mas `border-l-orange-400` e `border-gray-100` disputam a mesma propriedade. O resultado visual pode variar entre navegadores.
- Estado vazio da coluna (`"Arraste um lead aqui"`) usa `border-dashed border-gray-300` mas fica dentro do `motion.div` droppable — visualmente ele some durante o drag sobre a coluna porque `isOver` muda o fundo para `column.color + '10'` sem ajustar o texto vazio. Há um flash onde o texto vazio e o fundo colorido coexistem de forma estranha.
- Não existe indicador visual de "qual coluna está ativa para drop" além da mudança de fundo — não há nenhum ring/outline de destaque claro enquanto arrasta sobre uma coluna válida. `outline: 2px dashed ${column.color}` existe mas funciona em complemento ao fundo colorido, criando excesso de decoração em vez de clareza.

---

### /agenda

**O que está bom:**
- Estrutura do calendário mensal existe e funciona — grade 7 colunas, células com min-h, navegação prev/next.
- Célula de hoje com fundo `alliance-blue` e texto branco é o tratamento correto.
- Toolbar com nav de mês num container `bg-white border` separado é uma boa delimitação visual.
- `MeetingPill` com cor dinâmica do consultor é o detalhe certo.
- Empty state do mês com link "Agendar primeira reunião" existe.

**O que está medíocre:**
- `min-h-[100px]` para cada célula do calendário é insuficiente quando há mais de 2 reuniões. O `slice(0, 2)` com "+N mais" é a solução, mas o "+N mais" não é clicável de forma útil — não abre nada, apenas existe.
- Headers de dia (`Seg, Ter, Qua...`) em `text-xs font-bold text-gray-400 uppercase tracking-wider`. Está ok mas genérico. Em Linear e Notion, os headers de calendário têm peso visual mais preciso — mais leves ou com tamanho ligeiramente maior.
- A toolbar mistura dois elementos de natureza diferente (nav de mês e botão de ação) sem separador visual claro. O botão "Nova Reunião" fica alinhado horizontalmente com o contador de reuniões, criando tensão visual.
- `CreateMeetingDialog` usa shadcn `Dialog` padrão com `DialogContent` sem customização visual. O `select` de lead é um elemento HTML nativo não estilizado — a aparência vai depender do SO. Em macOS parece ok, no Windows parece saído de 2010.
- As células de dias fora do mês atual usam `bg-gray-50/60` — uma opacidade de fundo sobre fundo já off-white. O resultado é praticamente imperceptível em muitos monitores.
- A `MeetingPill` mostra apenas o nome do consultor (truncado a 12 chars), sem nenhum horário da reunião. Um calendário sem horário nas pills é um calendário cego.

**O que está feio/errado:**
- Bordas do grid de células: `border-b border-r border-gray-50`. `border-gray-50` é quase branco — as bordas praticamente não existem, tornando a grade invisível. A grade precisa de bordas visíveis para o usuário entender a estrutura espacial.
- Não existe feedback visual algum ao criar uma reunião com sucesso. O `handleMeetingCreated` refetch e atualiza o estado, mas não há nenhum highlight na célula recém-criada.
- O botão "Nova Reunião" usa `bg-alliance-dark` mas o resto da toolbar usa `bg-white border` — o contraste está correto mas o border-radius `rounded-xl` do botão e o `rounded-xl` do container de nav são iguais, fazendo os dois elementos parecerem do mesmo tipo visual.

---

### /imoveis

**O que está bom:**
- `ImovelCard` com faixa de cor no topo (`h-2 bg-alliance-blue` ou `bg-gray-300`) é um indicador de disponibilidade imediato e elegante.
- Badge "Disponível" em emerald e "Indisponível" em cinza tem semântica clara.
- Metragem como destaque visual (`text-2xl font-bold text-alliance-blue`) cria hierarquia dentro do card.
- Stagger de entrada existe.
- `cardHover` com `y: -3` existe.

**O que está medíocre:**
- Grid de imóveis (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) sem altura definida nos cards. Cards com poucos `diferenciais` ficam muito baixos; cards com muitos ficam altos. A grade fica irregular. Em Stripe, grids de produto têm altura uniforme ou alinhamento de seções internas.
- A "faixa de cor no topo" (`h-2`) é útil mas poderia ter mais peso visual — 8px de cor em um card grande passa despercebido. Linear usa 3-4px de borda lateral esquerda (`border-l-4`) que tem mais impacto escaneável.
- Não existe filtro algum de disponibilidade, tipologia ou faixa de valor. Com 34 unidades (dado mencionado no subtítulo da página), a falta de filtro torna a listagem difícil de navegar.
- O `ImovelCard` não é clicável — não há modal de detalhe. O brief menciona `ImovelModal` mas ele não foi implementado. O usuário vê o card mas não tem como aprofundar a informação.
- Informações de quartos e suítes ficam numa linha com separador `w-px h-4 bg-gray-200` — separador vertical inline dentro de text é um padrão antigo e visualmente frágil.

**O que está feio/errado:**
- `diferenciais` renderizado como lista de `<li>` com `w-1.5 h-1.5 rounded-full bg-alliance-blue` como bullet customizado. O problema: `inline-block flex-shrink-0 mt-1` num elemento inline dentro de `<li>` com `flex items-start` cria um alinhamento inconsistente dependendo do font-size e line-height. Os bullets podem aparecer desalinhados verticalmente.
- Não existe nenhum estado de loading. A página é server-rendered mas se o Supabase demorar, o usuário vê apenas o spinner padrão do browser sem nenhum skeleton.
- O subtítulo `"Castelo, ES — 34 unidades exclusivas de alto padrão"` usa um traço em dash `—` seguido de texto, colocado no HTML diretamente. Funciona, mas o número 34 é hardcoded — se unidades forem adicionadas, o texto fica desatualizado.

---

### /interacoes

**O que está bom:**
- Layout dividido (sidebar + chat) é o padrão correto para uma interface de mensagens.
- Sidebar com fundo `alliance-dark` cria separação clara entre lista e conteúdo.
- Avatar com inicial do nome é simples e funcional.
- `border-l-2 border-alliance-blue` no item ativo da sidebar é um indicador de seleção preciso e elegante.
- Animação de entrada do input de chat com `AnimatePresence` + `y: 12→0` é o detalhe correto.
- `MessageBubble` com bordas arredondadas assimétricats (inbound: `rounded-r-2xl rounded-tl-2xl`, outbound: `rounded-l-2xl rounded-tr-2xl`) está correto e conforme o brief.
- Realtime funcionando com deduplicação de mensagens otimistas.

**O que está medíocre:**
- Área de chat usa `bg-[#CCCCCC]` — hardcoded hex, ignorando o token `alliance-chat` definido em globals.css. Isso é exatamente o tipo de inconsistência que causa divergência entre tokens e implementação.
- `ChatHeader` com avatar `w-10 h-10` de inicial fica pequeno demais para um painel que ocupa a maior parte da tela. Em WhatsApp, Signal e Linear, o avatar do contato no header tem peso visual maior.
- O `ChatHeader` não tem indicador online/offline ou status de "última vez ativo". Mesmo que seja desnecessário funcionalmente, a ausência de qualquer status cria uma área superior vazia demais.
- A área de mensagens (`bg-[#CCCCCC]`) com mensagens brancas funciona ok, mas o fundo cinza é muito neutro — não tem nenhuma textura sutil, gradiente ou padrão que as interfaces de mensagem modernas usam para criar profundidade sem distrair.
- O estado vazio "Selecione um lead para ver a conversa" usa um SVG inline com `stroke="#9CA3AF"` hardcoded. Não usa tokens. O container usa `bg-gray-50` que contrasta levemente com o `bg-white` do `ChatHeader` criando um flash de cor ao selecionar um lead.
- `LeadsSidebar` com `w-72 min-w-72` fixo. Em telas abaixo de 1024px o chat area fica muito estreita.

**O que está feio/errado:**
- O input de chat usa `rounded-full` enquanto o botão de envio também é `rounded-full`. A consistência de `rounded-full` está ok, mas o input `bg-gray-50 border border-gray-200` dentro de um `px-6 py-4 bg-white border-t border-gray-100` cria um container branco com input cinza claro — dupla camada de fundo sem propósito.
- `message-bubble.tsx`: quando `isIA = false`, a label abaixo da mensagem mostra `{consultantName ?? 'Consultor'}`. Mas `consultantName` não é passado pelo `ChatArea` — ele está sempre `undefined`. Todos os outbound de consultor mostram "Consultor" sem nome, independente de quem enviou.
- Não existe paginação ou virtualização de mensagens. Com 500 mensagens no estado (limite do fetch inicial), renderizar todas as `MessageBubble` ao mesmo tempo pode causar lentidão perceptível.

---

## Diagnóstico Global

**Problemas sistêmicos (afetam todas as páginas):**

1. **Tokens ignorados em favor de hardcode.** O globals.css define `--color-alliance-chat: #CCCCCC`, `--color-alliance-col: #E8E8E8`, `--color-alliance-input: #D9D9D9`. No código, esses valores aparecem como strings literais (`bg-[#CCCCCC]`, `backgroundColor: '#E8E8E8'`, `style: { backgroundColor: column.color + '18' }`). O sistema de tokens existe no papel mas não é respeitado na implementação.

2. **Tipografia sem escala definida.** O projeto usa Inter (via `font-sans`) mas não define uma escala tipográfica. `text-xs`, `text-sm`, `text-base`, `text-2xl`, `text-3xl`, `text-4xl` aparecem sem critério. Em Linear, cada elemento de texto tem um papel semântico mapeado para um tamanho fixo: page-title=24px, section-label=11px uppercase, body=14px, caption=12px. Aqui não existe esse mapeamento.

3. **Sombras inconsistentes.** Três padrões de sombra coexistem: `shadow-sm` (Tailwind default), `shadow-xl` (login card), `boxShadow: '0 16px 32px rgba(0,0,0,0.16)'` (LeadCard drag inline). Não existe um sistema de elevação definido com tokens. Vercel Dashboard usa no máximo dois níveis de sombra com valores exatos definidos como CSS custom properties.

4. **Border-radius inconsistente.** `rounded-xl` (12px), `rounded-2xl` (16px), `rounded-full`, `rounded-lg` aparecem sem critério claro. O globals.css define `--radius: 0.625rem` como base de um sistema escalado (`sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`), mas os componentes não usam essas variáveis — usam classes Tailwind diretas sem relação com o sistema.

5. **Estados de loading inconsistentes.** Dashboard tem skeleton. Kanban não tem skeleton (mostra board vazio). Agenda não tem skeleton (mostra calendário com células vazias). Imóveis não tem skeleton (renderiza direto). Interações tem `loadingHistory` com um `Loader2 animate-spin` simples. Não existe um padrão de loading unificado.

6. **Ausência total de feedback de foco visível nos elementos principais.** A maioria dos `<button>` e `<Link>` tem `focus-visible:ring-2` com cores corretas. Mas o nav-shell usa `hover:bg-white/8` — valor não existente no Tailwind sem configuração customizada. Tailwind não gera `bg-white/8` por padrão em v4 — ou está em whitelist ou quebra silenciosamente.

7. **Falta de densidade visual controlada.** Todas as páginas usam `px-8 py-7` como padding de container. Funciona num dashboard de métricas, mas é excessivo para o kanban (onde cada pixel de largura importa) e para interações (que precisa de padding zero no nível do container). O padding deveria ser por página, não global.

8. **Sem dark mode funcional.** O globals.css define um `.dark` completo com todas as variáveis. Mas os tokens `alliance-blue`, `alliance-dark`, `alliance-mid` etc. não têm variantes dark — são cores fixas. Em dark mode, o sidebar azul escuro sobre fundo escuro vai desaparecer. O sistema dark está na metade: os tokens shadcn estão, os tokens custom Alliance não estão.

9. **Ausência de micro-animações de estado.** Hover em botões usa `transition-colors` CSS puro em vez de Framer Motion. O brief exige `whileHover` Framer em elementos interativos. Apenas os cards implementam `whileHover: { y: -2 }`. Botões, badges de status e itens de nav não têm estado hover animado.

10. **Copy inconsistente com o brief.** O brief define `"BEM-VINDO, [NOME]!"` em uppercase. A implementação usa `"Bem-vindo de volta"` como eyebrow (lowercase com capitalização mista) e o nome do usuário em uppercase no h1. São dois elementos separados em vez do pattern definido no brief.

---

## Plano de Upgrade

### Wave 1 — Fundação: tokens, tipografia e espaçamento global
**Alto impacto, baixo risco. Estimativa: 1 sessão de trabalho.**

- [ ] Criar arquivo `src/lib/tokens.ts` exportando todas as cores Alliance como constantes — eliminar todo hardcode hex nos componentes. Impacto: elimina a classe de bugs onde token e implementação divergem.
- [ ] Definir escala tipográfica semântica: `type-display=32px/700`, `type-title=24px/700`, `type-subtitle=18px/600`, `type-body=14px/400`, `type-label=12px/600 uppercase tracking-widest`, `type-caption=11px/500`. Mapear cada `text-*` existente para o papel semântico correto.
- [ ] Estender `tailwind.config.ts` com `fontSize` customizado mapeado aos tamanhos semânticos acima. Adicionar `boxShadow` com tokens: `shadow-card`, `shadow-elevated`, `shadow-float`.
- [ ] Corrigir `bg-white/8` para `bg-white/[0.08]` no `nav-shell.tsx` (sintaxe Tailwind v4 correta) e revisar todas as instâncias de `bg-*/n` onde `n` não é múltiplo de 5.
- [ ] Substituir `bg-gray-50` do layout protegido por `bg-[var(--background)]` — usar token semântico do shadcn em vez de classe hardcode.
- [ ] Adicionar variantes dark para todos os tokens `alliance-*` no globals.css: `--color-alliance-dark` em dark mode deve ser mais claro para manter contraste. Impacto: dark mode funcional end-to-end.
- [ ] Remover `border border-gray-100` de todos os cards que já têm `shadow-sm` — sombra e borda fina fazem o mesmo trabalho visual e se cancelam mutuamente.
- [ ] Fixar `ChartsSkeleton` para usar alturas determinísticas (array fixo de alturas) em vez de `Math.random()`.

---

### Wave 2 — Componentes Core: nav, cards, modal, estados
**Médio impacto, médio risco. Estimativa: 2 sessões de trabalho.**

- [ ] **NavShell**: adicionar `motion.div` com `layoutId="nav-active-bg"` como fundo animado do item ativo (não só o marcador lateral). O fundo `bg-white/15` do item ativo deveria transicionar suavemente ao navegar entre rotas — Linear usa exatamente esse padrão.
- [ ] **NavShell**: adicionar avatar do usuário logado no rodapé com nome real (atualmente só mostra "CRM v1.0"). Linear e Vercel sempre exibem o contexto do usuário no final da sidebar.
- [ ] **MetricCard**: adicionar linha de delta percentual (+12% vs. semana passada) abaixo do valor numérico para cards `default`. Para o card `featured`, manter só o número mas com tamanho maior (`text-5xl`). Impacto: contexto imediato, principal diferença entre dashboard CRM e planilha.
- [ ] **MetricCard featured**: aumentar largura para `col-span-2` — o card principal (Total de Leads) deve dominar o grid. Grid atual 3×2 vira `[2+1] / [1+1+1]`.
- [ ] **ActivityChart**: adicionar segundo dataset com cor `alliance-dark` tracejada representando a semana anterior — contexto comparativo. Títulos dos gráficos devem ter hierarquia diferente: o de Reuniões em destaque (featured container) e o de Leads em default.
- [ ] **LeadCard**: corrigir conflito de classes de borda. Usar `cn()` com condicional correto: classe `border border-gray-100` baseline, `border-l-[3px] border-l-orange-400` como override quando pausado (usar `border-l-[3px]` em vez de `border-l-4` para consistência com tokens de border).
- [ ] **KanbanColumn**: substituir `backgroundColor: column.color + '18'` por uma função `hexToRgba(color, 0.09)` no `lib/utils.ts`. Impacto: cálculo correto de transparência para qualquer hex, incluindo formatos curtos.
- [ ] **LeadDetailModal**: remover `width: 480, maxWidth: 480` inline. Usar `className="w-[480px] max-w-full"` para ser responsivo. Adicionar `motion.div` no corpo do sheet com `variants={staggerContainer}` para que as seções entrem em cascata ao abrir o painel.
- [ ] **EmptyState / ErrorState**: upgradear a iconografia. O ícone atual em `bg-gray-100 rounded-2xl` é genérico demais. Usar ícone específico por contexto com cor semântica. O `ErrorState` já tem `bg-red-50` — o `EmptyState` deveria ter `bg-alliance-blue/8` para manter identidade de marca.
- [ ] **CreateMeetingDialog**: substituir `<select>` nativo de lead por um `<Combobox>` ou `Command` do shadcn com busca. Com dezenas de leads, o select nativo é inutilizável.

---

### Wave 3 — Páginas: redesign específico
**Alto impacto, alto esforço. Estimativa: 3-4 sessões.**

#### /dashboard
- [ ] Redesenhar header da página: mover o eyebrow + nome do usuário para um hero section com mais respiração vertical. Adicionar data atual (`"Sábado, 28 de março"`) em `type-caption` abaixo do nome — contexto temporal imediato.
- [ ] Reconfigurar grid de métricas para layout assimétrico: linha 1 com `col-span-2` (Total de Leads) + `col-span-1` (Reuniões Hoje). Linha 2 com 3 cards iguais. Isso quebra a monotonia do grid 3×2.
- [ ] Adicionar seção "Atividade recente" abaixo dos gráficos: feed de eventos recentes do sistema (lead movido, reunião criada, mensagem enviada) em lista com timestamps. Vercel Dashboard tem exatamente esse padrão de "Recent Activity" que aumenta o senso de sistema vivo.
- [ ] Gráficos: tornar o container dos charts mais distinto dos cards — usar fundo ligeiramente diferente (`bg-white`) com borda `border border-alliance-blue/10` em vez de `border-gray-100`. Ou usar fundo `bg-alliance-dark/3` para o container de um deles.

#### /kanban
- [ ] Adicionar barra de progresso horizontal acima de cada coluna mostrando a proporção de leads nela em relação ao total. Impacto: o usuário entende a distribuição do pipeline sem contar cards.
- [ ] Aumentar `min-w` das colunas para `280px` em monitores largos usando CSS grid com `auto-fill` + `minmax(260px, 1fr)` em vez de `flex` com largura fixa. Isso usa melhor o espaço disponível.
- [ ] Toolbar de busca + filtro: colocar num container `bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3` separado do board — criar separação visual clara entre controles e conteúdo.
- [ ] Adicionar view toggle (Kanban / Lista) no canto direito da toolbar. Mesmo que só o Kanban seja implementado agora, o botão sinaliza que a interface é profissional e extensível.

#### /agenda
- [ ] Substituir `<select>` nativo de lead no `CreateMeetingDialog` por `Command` do shadcn.
- [ ] Aumentar `min-h` das células do calendário para `120px` para dar mais espaço visual aos eventos.
- [ ] Tornar `MeetingPill` clicável — ao clicar, abrir um popover/tooltip com informações completas (nome do lead, horário, consultor, observações).
- [ ] Adicionar sidebar de "Próximas reuniões" à direita do calendário: lista ordenada por data das próximas 5-7 reuniões. Isso transforma o calendário de visualização em ferramenta de ação.
- [ ] Adicionar bordas visíveis ao grid de células: `border-b border-r border-gray-100` em vez de `border-gray-50`.

#### /imoveis
- [ ] Implementar `ImovelModal` conforme o brief: ao clicar num card, abrir sheet/dialog com detalhes expandidos, galeria de imagens (pode ser placeholder), lista completa de diferenciais, faixa de valor destacada.
- [ ] Adicionar filtro por disponibilidade (radio: Todos / Disponíveis / Indisponíveis) na toolbar da página.
- [ ] Corrigir altura uniforme dos cards: usar `grid-rows` com `items-stretch` e garantir que o `.mt-auto` do valor no rodapé funcione corretamente (`flex-1` no container interno).
- [ ] Substituir `w-1.5 h-1.5 rounded-full bg-alliance-blue` como bullet por `•` ou `–` tipográfico em CSS (`list-disc`) com cor controlada via `text-alliance-blue` no `<ul>`.

#### /interacoes
- [ ] Substituir `bg-[#CCCCCC]` por `bg-alliance-chat` (classe Tailwind do token definido em globals.css).
- [ ] Aumentar o avatar do `ChatHeader` para `w-12 h-12` e adicionar status indicator — anel colorido baseado no stage do lead.
- [ ] Adicionar `consultantName` correto no `MessageBubble` — passar a informação do consultor pelo `ChatArea` até o bubble. Atualmente todos outbound de consultor mostram "Consultor" sem nome.
- [ ] Adicionar timestamp de agrupamento por data nas mensagens (marcadores "Hoje", "Ontem", "28 mar") entre grupos de mensagens. WhatsApp Web, Linear e todos os chats modernos usam esse padrão.
- [ ] Quando automação NÃO está pausada, mostrar uma `InfoBanner` no rodapé do chat: `"A IA está respondendo automaticamente. Para enviar uma mensagem manual, pause a automação no Kanban."` — atualmente o input simplesmente desaparece sem explicação.

---

### Wave 4 — Polimento Final: os detalhes que separam bom de excelente
**Médio impacto por item, alto impacto acumulado. Estimativa: 1-2 sessões.**

- [ ] **Scrollbar customizada global**: adicionar em `globals.css` scrollbar WebKit com largura de 6px, cor `alliance-blue/30`, track transparente. Impacto imediato e desproporcional na percepção de polimento — Linear faz exatamente isso.
- [ ] **Transições de rota com `AnimatePresence`**: o `PageTransition` existe mas `AnimatePresence` não está no layout protegido — a animação de saída (`exit: { opacity: 0, y: -8 }`) nunca executa porque o componente é desmontado antes da animação terminar. Envolver `{children}` no layout com `AnimatePresence mode="wait"`.
- [ ] **Focus ring consistente**: definir `--ring` como `oklch` com chroma de `alliance-blue` no globals.css e garantir que `outline-ring/50` (aplicado globalmente em `@layer base`) use o valor correto em contexto de formulários.
- [ ] **Toast (Sonner) customizado**: atualmente usa as cores padrão do Sonner. Definir `toastOptions` com `className` usando `rounded-xl shadow-elevated font-sans text-sm` e ícones alinhados com a linguagem visual do sistema.
- [ ] **Ícone de página (favicon) e metadata**: a página usa `favicon.ico` padrão do Next.js. Nenhum título customizado de página por rota. Adicionar `export const metadata` em cada page.tsx com título formatado: `"Pipeline | CRM Alliance"`, `"Agenda | CRM Alliance"`, etc.
- [ ] **`prefers-reduced-motion`**: o brief exige essa verificação. Nenhum componente a implementa. Adicionar hook `useReducedMotion()` do Framer Motion e condicionar animações de translate/scale.
- [ ] **Acessibilidade básica**: `KanbanBoard` e `LeadCard` usam dnd-kit com atributos de acessibilidade corretos (`aria-label` existe) mas não há anúncio de screen reader ao mover um card entre colunas. O dnd-kit tem suporte nativo — ativar o `announcements` do `DndContext`.
- [ ] **Loading da sidebar nav**: o `NavShell` faz duas subscriptions Supabase Realtime no mount. Não existe feedback de connection status. Se o Realtime desconectar, o badge numérico silenciosamente para de funcionar. Adicionar indicador de status de conexão minimamente visível (ponto verde/cinza no rodapé da nav).
- [ ] **Responsividade mobile**: nenhuma página tem layout mobile funcional. O layout protegido é `flex` com sidebar fixa — em mobile o conteúdo fica inacessível. Mínimo: em breakpoint `< 768px`, sidebar vira drawer hamburger usando o `Sheet` do shadcn.
- [ ] **Cor dos gráficos via token**: `ActivityChart` usa `backgroundColor: '#1E90FF'` hardcoded. Substituir por leitura de CSS custom property via `getComputedStyle(document.documentElement).getPropertyValue('--color-alliance-blue')` no mount. Impacto: gráficos respeitam dark mode automaticamente.

---

## Referências de nível a alcançar

**Linear** — Referência primária para o Kanban e navegação lateral. Pontos específicos a estudar: transição de item ativo na sidebar com `layoutId` Framer Motion, densidade visual dos cards (informação densa sem poluição), toolbar com separação clara de filtros e ações, scrollbar customizada sutil.

**Vercel Dashboard** — Referência para o Dashboard de métricas. Pontos específicos: cards com delta percentual e sparkline inline, hierarquia de tamanho entre cards primários e secundários, seção de atividade recente como feed de eventos, tipografia de dados com `font-variant-numeric: tabular-nums`.

**Stripe** — Referência para as páginas de lista (Imóveis) e detalhe (Modal de Lead). Pontos específicos: tabelas e grids com altura uniforme, badges de status com semântica de cor cristalina, modals com header colorido + corpo branco (já parcialmente implementado no `LeadDetailModal`), sistema de sombras em dois níveis apenas.

**Notion** — Referência para a Agenda e o layout de Interações. Pontos específicos: calendário com células de altura generosa, agrupamento de mensagens por data com marcadores, empty states com ilustração SVG minimalista e call-to-action claro.

---

## Resumo executivo

O sistema atual tem **estrutura correta e fundação sólida**: tokens definidos, animações Framer Motion em uso, componentes separados por responsabilidade, estados de loading/error/empty existentes, Realtime funcionando. A equipe tomou as decisões arquiteturais certas.

O problema é que a execução ficou a **60% do caminho**. Os tokens existem mas não são respeitados. As animações foram configuradas mas a metade das páginas não usa `AnimatePresence` para exit. Os estados de loading existem em algumas páginas e não em outras. O sistema de tipografia foi ignorado em favor de classes ad-hoc.

O que separa o sistema atual de Linear e Vercel não é uma refatoração completa — é disciplina sistêmica: **cada componente respeitando o mesmo conjunto de tokens, cada estado visual coberto, cada interação com feedback**. As Wave 1 e 2 entregam 80% do impacto visual com 30% do esforço total.
