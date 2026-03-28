# Contribuicao: alliance-design
## Data: 2026-03-28

---

## Problemas Encontrados

### lead-card.tsx

**Linha 38 — Conflito de classe border no Tailwind**
```
border border-gray-100 border-l-4 border-l-orange-400
```
Quando `automation_paused = true`, a classe `border` e `border-gray-100` entram em conflito com `border-l-4 border-l-orange-400` porque ambos definem `border-width` e `border-color`. O resultado visual e a borda esquerda pode nao aparecer corretamente em todos os browsers. Solucao: usar `ring-1 ring-gray-100` para a borda base e reservar `border-l-4 border-l-orange-400` apenas para o estado pausado.

**Linha 39 — Opacity durante drag usando classe Tailwind estatica**
```
isDragging ? 'opacity-40' : ''
```
O card fantasma (placeholder) fica com `opacity-40` via Tailwind, mas o card arrastado em si (que segue o cursor via dnd-kit `useDraggable`) nao tem animacao Framer Motion configurada. O `dragAnimation` exportado em `src/lib/animations.ts` nao esta sendo aplicado no componente — o componente e uma `div` plain, nao um `motion.div`. Resultado: a animacao de drag definida no design system (`scale: 1.03, boxShadow`) e ignorada.

**Linha 88 — Badge "agente de IA" nao usa token badge.ia**
```
bg-alliance-dark text-white
```
Correto semanticamente (alliance-dark = #0A2EAD = badge.ia), mas o token especifico `badge-ia` do DESIGN-BRIEF.md nao existe no tailwind.config, entao o dev usou o alias errado. Se `alliance.dark` mudar de valor no futuro, o badge quebraria silenciosamente. Problema de governanca de tokens.

**Linha 83 — Separador com cor hardcoded**
```
border-gray-50
```
O design system nao define `gray-50` como token. Deve ser `border-gray-100` (alinhado com a borda do card) ou um token semantico.

---

### kanban-column.tsx

**Linha 21 — backgroundColor e outline hardcoded via style inline**
```js
style={{
  backgroundColor: isOver ? column.color + '10' : '#F9FAFB',
  outline: isOver ? `2px dashed ${column.color}` : undefined,
}}
```
Dois problemas:
1. `'#F9FAFB'` e um valor hardcoded — o token correto do design system e `alliance.col` (`#E8E8E8`). A coluna esta mais clara do que o aprovado.
2. `column.color + '10'` (hex + alpha como string) funciona em CSS moderno mas nao e garantido em todos os contextos. Usar `rgba()` ou `color-mix()` seria mais seguro.

**Linha 20 — KanbanColumn nao e um motion.div**
A coluna nao tem nenhuma animacao de entrada. O DESIGN-BRIEF.md especifica `staggerContainer` nos filhos ao carregar — mas o container pai tambem deveria ter `initial/animate` para orquestrar o stagger. Atualmente os LeadCards sao divs plain (ver problema acima), entao o stagger nao funciona de nenhuma forma.

**Linhas 62-65 — Estado vazio incorreto**
```jsx
<div className="text-center text-xs text-gray-400 py-10 border-2 border-dashed border-gray-200 rounded-xl">
  Arraste um lead aqui
</div>
```
O DESIGN-BRIEF.md especifica: "Coluna sem cards: area vazia silenciosa (sem copy — so o fundo alliance.col)". O texto "Arraste um lead aqui" e a borda dashed contradizem o design aprovado. Deve ser removido ou substituido por area em branco.

---

### metric-card.tsx

**Linha 58 — Tamanho de texto nao segue hierarquia tipografica**
```
text-4xl font-bold
```
`text-4xl` = 36px. O DESIGN-BRIEF.md nao especifica esse valor explicitamente, mas para consistencia com o design Inter aprovado, numeros de metrica deveriam ser `text-3xl` (30px) ou ter um token semantico proprio. `text-4xl` em cards pequenos pode transbordar em telas menores.

**Linha 14 — useCountUp sem `initial: true` no stagger**
O `useCountUp` roda imediatamente no mount, mas o `staggerItem` da Framer Motion pode atrasar a entrada visual do card. O numero comeca a contar antes do card estar visivelmente na tela (quando o stagger delay e alto). Solucao: iniciar o countUp somente apos `inView` (usar `useInView` do Framer Motion ou `IntersectionObserver`).

**Linha 36 — `motion.div` com `variants={staggerItem}` sem initial/animate explicit**
O componente usa `variants={staggerItem}` mas nao define `initial="initial" animate="animate"` no proprio motion.div. Ele depende que o pai (`staggerContainer`) propague esses estados. Se o MetricCard for usado fora de um staggerContainer, ele nunca animara (ficara invisible com `opacity: 0`). As props `initial` e `animate` devem ser declaradas explicitamente como fallback.

---

### nav-shell.tsx

**Linha 61-63 — Indicador ativo com position absoluto sem `relative` no pai**
```jsx
<motion.div
  layoutId="nav-active"
  className="absolute left-0 w-0.5 h-5 bg-alliance-blue rounded-r-full"
/>
```
O `<Link>` pai na linha 45 nao tem `className` com `relative` — tem `flex items-center gap-3 px-3 py-2.5 rounded-xl`. O elemento `absolute left-0` vai escapar do contexto do Link e se posicionar relativo ao proximo ancestral posicionado (o `<nav>` ou o `<aside>`). O indicador lateral azul esta provavelmente no lugar errado visualmente.

**Linha 48-53 — Transicao CSS simples em vez de Framer Motion**
```
transition-all duration-150
```
O item de nav usa CSS transition para hover/active em vez de `motion.a` com `whileHover`. Isso e inconsistente com o padrao obrigatorio do design system que exige Framer Motion para todos os estados interativos.

**Linha 72-74 — Rodape sem conteudo util**
```jsx
<p className="text-white/25 text-xs">CRM v1.0</p>
```
Espaco de valor desperdicado. O design de um CRM profissional deve usar essa area para: avatar do usuario logado + nome + botao de logout. Atualmente nao ha nenhuma forma de logout visivel para o usuario.

---

### dashboard/page.tsx

**Linhas 107-123 — Saudacao nao segue copy do design aprovado**
```jsx
<p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
  Bem-vindo de volta
</p>
<h1 className="text-3xl font-bold text-alliance-dark">
  {userName}
</h1>
```
O DESIGN-BRIEF.md especifica: `"BEM-VINDO, [NOME]!"` em `alliance.blue` bold — tudo em maiusculas, em uma linha so. A implementacao atual divide em duas linhas com estilo diferente (label + h1 escuro), quebra o copy aprovado e usa `alliance-dark` no nome em vez de `alliance-blue`.

**Linha 119 — MetricsGrid sem skeleton de loading**
O componente e Server Component (dados ja chegam prontos do servidor), entao tecnicamente nao precisa de skeleton. Porem, se a query for lenta, o Next.js vai bloquear toda a pagina ate resolver. Seria melhor usar `<Suspense>` com skeleton para exibir o shell da pagina imediatamente.

---

### interacoes/chat-area.tsx

**Linha 30 — Background hardcoded via style inline**
```jsx
style={{ background: '#F4F6F9' }}
```
O design system define `alliance.chat` como `#CCCCCC` para a area de chat. O valor `#F4F6F9` e uma cor nao documentada no design system — hardcode incorreto que diverge do aprovado.

**Linhas 33-37 — Estado vazio sem animacao e sem design**
```jsx
<div className="text-center text-gray-400 text-sm py-16">
  Nenhuma mensagem ainda
</div>
```
Estado vazio totalmente sem estilo. Falta: icone ilustrativo, tipografia correta, motion de entrada.

**Linhas 52-68 — Input sem estados visuais completos**
O input de envio existe apenas quando `automation_paused = true`, mas:
- Nao ha animacao de `AnimatePresence` para a entrada/saida do input (aparece/desaparece abruptamente)
- O botao de envio usa `hover:bg-alliance-dark` que e uma transicao CSS, nao Framer Motion `whileHover`
- Nao ha estado `loading` para quando a mensagem esta sendo enviada (o botao deveria mostrar spinner)
- O input nao tem estado `disabled` visual claro alem do `opacity-40` no botao

---

## Micro-interacoes (baixo esforco, alto impacto)

### 1. LeadCard — converter para motion.div com dragAnimation e cardHover
Atualmente e uma `div` com CSS transition. Trocar para:
```tsx
<motion.div
  ref={setNodeRef}
  style={style}
  variants={staggerItem}
  whileHover={{ y: -2, transition: { duration: 0.15 } }}
  whileDrag={{ scale: 1.03, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
  className={...}
>
```
Impacto: drag e hover instantaneamente mais polidos.

### 2. NavShell — adicionar `relative` no Link e corrigir indicador ativo
Adicionar `relative` ao Link para que o `absolute left-0` do indicador azul funcione corretamente. Custo: 1 palavra no className.

### 3. KanbanColumn — estado over com motion ao inves de style inline
Trocar o `outline` inline por `ring-2 ring-dashed` com classe Tailwind condicional e adicionar `motion.div` no container com `animate={{ scale: isOver ? 1.01 : 1 }}` para feedback visual durante o drag-over.

### 4. ChatArea — AnimatePresence no input bar
Envolver o bloco do input em:
```tsx
<AnimatePresence>
  {lead.automation_paused && (
    <motion.div
      key="chat-input"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="px-6 py-4 bg-white border-t border-gray-100 flex-shrink-0"
    >
      ...
    </motion.div>
  )}
</AnimatePresence>
```

### 5. MetricCard — useInView para disparar countUp no momento certo
Adicionar `useInView` do Framer Motion para iniciar o `useCountUp` apenas quando o card entra no viewport, evitando que o numero conte antes do card ser visivel.

### 6. NavShell — converter items para motion.a/motion(Link) com whileHover
Substituir `transition-all duration-150` por `whileHover={{ x: 2 }}` com `transition: { duration: 0.12 }` para dar feedback lateral sutil ao hover.

### 7. Badge "pausado" no LeadCard — pulse animation
Adicionar `animate={{ opacity: [1, 0.6, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}` no badge de pausa para indicar estado ativo de forma nao intrusiva.

### 8. Botao de envio no ChatArea — loading state
Quando `onSend` for chamado, exibir `<Loader2 size={15} className="animate-spin" />` no lugar do `<Send />` ate a Promise resolver. Adicionar estado `isSending` local.

---

## Melhorias Visuais Medias

### 1. KanbanColumn — fundo incorreto
Trocar `'#F9FAFB'` por `bg-alliance-col` (token `#E8E8E8`). O fundo das colunas esta muito claro — quase branco — quando deveria ter a textura cinza definida no design system. Diferenca visivel imediata.

### 2. KanbanColumn — remover estado vazio com texto
Remover o `"Arraste um lead aqui"` e substituir por area vazia de altura minima (`min-h-[80px]`) sem nenhum texto, conforme design aprovado.

### 3. Dashboard — corrigir saudacao para copy aprovado
```tsx
// Antes (incorreto):
<p>Bem-vindo de volta</p>
<h1 className="text-alliance-dark">{userName}</h1>

// Depois (correto):
<h1 className="text-3xl font-bold text-alliance-blue">
  BEM-VINDO, {userName}!
</h1>
```

### 4. ChatArea — corrigir fundo para alliance.chat
Trocar `style={{ background: '#F4F6F9' }}` por `className="bg-alliance-chat"` (token `#CCCCCC`).

### 5. MetricCard — adicionar initial/animate explict como fallback
```tsx
<motion.div
  variants={staggerItem}
  initial="initial"
  animate="animate"
  whileHover={{ y: -2, transition: { duration: 0.15 } }}
>
```

### 6. NavShell — area de usuario no rodape
Substituir `<p>CRM v1.0</p>` por componente `<UserFooter />` com:
- Avatar circular (inicial do nome com fundo `alliance-blue/20`)
- Nome do usuario (texto branco, font-medium, text-sm)
- Botao de logout (icone `LogOut` size=14, text-white/40, hover:text-white)
Layout: `flex items-center justify-between gap-2`

### 7. LeadCard — hierarquia visual do badge de consultor
Quando o lead tem `assigned_to !== null`, o badge atual mostra apenas "Consultor" sem cor dinamica do consultor. Deve exibir o nome real do consultor e usar a `badge_color` do `user_profiles`. Requer passar o dado do consultor como prop adicional ou via contexto.

### 8. staggerContainer no KanbanColumn — implementar corretamente
O DESIGN-BRIEF.md especifica `staggerContainer` nos filhos. A coluna deve ser um `motion.div` com `variants={staggerContainer}` e cada `LeadCard` deve ser um `motion.div` com `variants={staggerItem}`. Atualmente nenhuma das duas partes esta implementada com Framer Motion.

```tsx
// kanban-column.tsx
<motion.div
  ref={setNodeRef}
  variants={staggerContainer}
  initial="initial"
  animate="animate"
  className="flex flex-col gap-2 px-3 pb-3 overflow-y-auto flex-1"
>
  {leads.map(lead => (
    <LeadCard key={lead.id} lead={lead} onClick={...} />
  ))}
</motion.div>
```

---

## Novas Features de UI (complexas)

### 1. Toast / Notification System
Atualmente nao existe nenhum feedback visual apos acoes do usuario (pausar automacao, assumir conversa, enviar mensagem, mover card no kanban). Um sistema de toast e essencial para CRM profissional:
- Componente: `<ToastProvider>` na raiz + `useToast()` hook
- Animacao: slide-in da direita com `x: 32 -> 0`, `opacity: 0 -> 1`, 0.25s
- Variantes: `success` (verde), `error` (vermelho), `info` (alliance-blue)
- Auto-dismiss: 3s com barra de progresso animada
- Posicao: `fixed bottom-6 right-6 z-50`

### 2. Lead Quick Preview — Tooltip expandido ao hover no LeadCard
Ao fazer hover prolongado (300ms) em um LeadCard no Kanban, exibir um popover/tooltip com:
- Resumo completo da conversa (campo `summary`)
- Contagem de interacoes
- Tempo no estagio atual
- Ultimo contato
Implementacao: Framer Motion `AnimatePresence` + `motion.div` com `initial={{ opacity: 0, scale: 0.95, y: 4 }}`. Posicionamento inteligente (acima ou abaixo dependendo do espaco disponivel).

### 3. Realtime Indicator — indicador visual de atualizacao em tempo real
Quando uma nova mensagem chega via Supabase Realtime no Kanban ou nas Interacoes, mostrar:
- Um pulso no LeadCard afetado (ring verde animado: `ring-2 ring-green-400 ring-offset-1` com `animate={{ opacity: [1, 0] }}` em 2s)
- Badge de notificacao no item do nav "Interacoes" com contagem de nao lidas
- Animacao de entrada da nova mensagem no ChatArea com `staggerItem`

### 4. Command Palette (Cmd+K)
Para um CRM usado por 5 pessoas que o usam diariamente, um Command Palette e transformador:
- Atalho `Cmd+K` / `Ctrl+K`
- Busca de leads por nome ou telefone
- Acoes rapidas: "Ir para Kanban", "Ver agenda de hoje", "Novo agendamento"
- Animacao: modal centralizado com `scale 0.96 -> 1` + backdrop blur
- Implementacao: shadcn/ui `<CommandDialog>` + Framer Motion para entrada/saida

### 5. Skeleton Loading completo para todas as paginas
Atualmente as paginas sao Server Components que bloqueiam ate carregar. Com `<Suspense>` + skeletons:
- Dashboard: grade 2x3 de `<SkeletonCard>` com shimmer animation
- Kanban: 6 colunas com 3 `<SkeletonLeadCard>` cada
- Interacoes: lista de leads esqueletizada + area de chat vazia
- Shimmer: `bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]`

### 6. Kanban — contador animado ao mover card entre colunas
Quando um card e solto em uma nova coluna, o badge de contagem da coluna destino anima:
- `scale: 1 -> 1.4 -> 1` com `transition: { type: 'spring', stiffness: 300 }`
- Coluna de origem: contagem decrements com mesma animacao
Implementacao: `useEffect` monitorando `leads.length` com `motion.span` no badge.

---

## Prioridade Maxima (top 5)

### P1 — Corrigir fundo das colunas Kanban (kanban-column.tsx linha 21)
Token errado (`#F9FAFB` vs `#E8E8E8`). Diferenca visivel imediata que quebra o design aprovado. Custo: 10 minutos. Impacto: alto.

### P2 — Converter LeadCard para motion.div com dragAnimation e cardHover (lead-card.tsx linha 34)
O componente mais interativo do sistema nao usa Framer Motion. Sem isso, o diferencial de qualidade da animacao de drag esta completamente ausente. Custo: 30 minutos. Impacto: alto.

### P3 — Corrigir indicador ativo da NavShell (nav-shell.tsx linha 45/61)
Sem `relative` no pai, o indicador lateral `absolute` esta no lugar errado. Bug visual direto. Custo: 5 minutos. Impacto: alto.

### P4 — Corrigir saudacao do Dashboard para copy aprovado (dashboard/page.tsx linha 111-116)
"Bem-vindo de volta" + h1 escuro vs "BEM-VINDO, NOME!" em alliance-blue. Nao segue o design aprovado. Custo: 15 minutos. Impacto: medio-alto.

### P5 — ChatArea: fundo correto + AnimatePresence no input + loading state (chat-area.tsx)
Tres problemas de uma vez no componente mais usado do CRM: cor errada (`#F4F6F9` vs `#CCCCCC`), input sem animacao de entrada/saida, botao de envio sem loading state. Custo: 45 minutos. Impacto: alto.

---

## Tokens em falta no tailwind.config

Com base na leitura do DESIGN-BRIEF.md e do codigo atual, os seguintes tokens do design system sao referenciados mas provavelmente nao existem no tailwind.config (ele nao foi encontrado no repositorio, indicando que pode estar como `tailwind.config.js` ou dentro do `package.json`):

- `alliance.col` (#E8E8E8) — fundo das colunas Kanban
- `alliance.card` (#F0F0F0) — cards secundarios Dashboard
- `alliance.input` (#D9D9D9) — campos de input
- `alliance.chat` (#CCCCCC) — fundo da area de chat
- `badge.joao` (#FF6B00)
- `badge.mateus` (#3D3D3D)
- `badge.ia` (#0A2EAD) — alias de alliance.dark
- `badge.quente` (#FF4500)
- `badge.morno` (#FF8C00)
- `badge.frio` (#1E90FF) — alias de alliance.blue

Verificar se esses tokens existem no config e se nao existirem, adiciona-los antes de qualquer refatoracao de componente para evitar valores hardcoded.
