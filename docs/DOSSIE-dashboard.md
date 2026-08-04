# Dossiê — O dashboard do CRM Alliance mede o que importa?

**Data:** 03/08/2026 · **Escopo:** dashboard atual (`/dashboard`) × pesquisa de mercado × o que você mesmo já especificou em conversas anteriores × o que o banco de dados permite hoje.

---

## 1. Resposta curta

**Parcialmente.** O dashboard atual é forte em *acompanhamento* (funil, captação por dia, cadeia de disparos) e fraco em *ação e dinheiro*. Dos números na tela:

- **~50% são úteis e bem construídos** — o funil comercial, novos leads/dia e a seção de Disparos são exatamente o que a literatura chama de *metric chain* (cadeia causa→efeito).
- **~30% são métricas de vaidade** — os 4 cards de score médio ocupam uma faixa inteira e não passam no teste básico de acionabilidade ("se esse número mudar 10%, o que você faz?"). Resposta honesta: nada.
- **~20% estão duplicados ou mal rotulados** — o mesmo número aparece em dois cards com nomes diferentes, e o card mais próximo de receita tem um rótulo que esconde o que ele mede. Detalhado na seção 4.

E o mais importante: **os três números que a pesquisa aponta como os que mais movem receita em imobiliário — tempo de resposta pós-handoff, conversão por estágio no tempo, e receita/VGV — não estão na tela.** Dois deles nem têm dado no banco ainda.

---

## 2. O que a pesquisa diz

### 2.1 Regras gerais de dashboards de vendas

- **5–7 KPIs, não 38.** Organizações rastreiam 50+ KPIs em média, mas só 8–12 indicadores ligados a receita realmente predizem performance. O teste: *"se você não sabe explicar por que a métrica está no dashboard e o que faria se ela variasse 10%, corte."*
- **Leading vs. lagging.** Métricas *leading* (reuniões marcadas, pipeline criado, leads quentes) permitem agir enquanto há tempo; *lagging* (receita, vendas fechadas) só confirmam o que já aconteceu. Boa prática: **2–3 leading para cada lagging**, encadeadas — ex.: leads/dia → taxa de resposta → reuniões → propostas → vendas.
- **Vaidade se identifica pelo gatilho de ação.** Métrica boa dispara decisão ("taxa de conexão caiu abaixo de 4% → revisar mensagem"). Métrica que só "informa" é ruído.
- O erro nº 1 dos dashboards de Salesforce/HubSpot/Pipedrive, segundo os próprios guias: **mostrar tudo de uma vez** — "uma bagunça bonita que ninguém usa".

### 2.2 Específico de imobiliário

- **Speed to lead é a variável nº 1 de conversão.** Responder em 5 minutos converte **21×** mais que em 30 minutos; quem responde primeiro leva o cliente em **78%** dos casos. A média do setor é vergonhosa: **47 horas**. *(No Alliance, a Alice responde na hora — a métrica crítica vira o tempo do **consultor** depois do handoff.)*
- **Benchmarks de conversão lead→venda:** 0,4–1,2% para leads comprados online; 2–5% na média; 8–15% para os melhores operadores. Com 806 leads e as vendas registradas dá para se posicionar nessa régua.
- KPIs padrão do setor: custo por lead, qualidade do lead, tempo de resposta, conversão por origem, no-show de visitas/reuniões.

### 2.3 Específico de CRM com SDR de IA (o caso Alliance)

Como a qualificação é feita por um agente, entram métricas de bot que CRMs tradicionais não têm:

- **Containment rate** — % de conversas que a IA conduz sem humano intervir (benchmark 40–65%).
- **Handoff correto** — % de handoffs que o consultor aceitou/atendeu (mede se a IA está passando lead bom).
- **Taxa de pausa manual** — toda vez que um corretor pausa a Alice na mão é um voto de desconfiança; tendência de alta = problema no prompt.
- Cuidado clássico: containment "alto" porque o lead **desistiu de responder** é falso positivo — cruzar com resposta pós-handoff.

**Fontes:** [monday.com — CRM dashboards 2026](https://monday.com/blog/crm-and-sales/crm-dashboards/) · [Forecastio — B2B Sales KPIs](https://forecastio.ai/blog/sales-kpis) · [Improvado — Sales Dashboard Guide](https://improvado.io/blog/sales-dashboard) · [Pipeliner — Leading/Lagging](https://www.pipelinersales.com/what-is-crm/kpis-for-sales-management/) · [Nutshell — Vanity Metrics](https://www.nutshell.com/blog/sales-and-marketing-vanity-metrics) · [Kyzo — Speed to Lead Real Estate](https://kyzo.ai/blogs/speed-to-lead-real-estate) · [Prestyj — Lead Response Benchmarks](https://prestyj.com/blog/lead-response-time-benchmarks-by-industry) · [Jamil Academy — RE Conversion Benchmarks 2026](https://www.jamilacademy.com/blog/real-estate-lead-conversion-rate-benchmarks) · [ZoomInfo — Chatbot Metrics](https://pipeline.zoominfo.com/marketing/chatbot-metrics) · [Netguru — Chatbot KPIs](https://www.netguru.com/blog/chatbot-kpis) · [HubSpot — Sales Dashboards](https://blog.hubspot.com/sales/sales-dashboard) · [RevBlack — Pipeline Velocity](https://www.revblack.com/guides/pipeline-velocity)

---

## 3. O que VOCÊ já tinha especificado (e ficou pelo caminho)

### 3.1 Conversa de 08/07/2026 — "SDR IA Imobiliário CRM + Bot"

No brief original do projeto, a tela 5 era literalmente:

> **"5. DASHBOARD — leads/dia, conversão por estágio (funil visual), tempo médio até quente, SLAs vencidos da semana, leads por origem/campanha, motivos de perda e de recusa de unidade agregados. Filtro por período e empreendimento."**

Confronto com o que existe hoje:

| Item do seu brief original | Status no CRM atual |
|---|---|
| Leads/dia | ✅ Existe (gráfico Novos Leads) |
| Conversão por estágio (funil visual) | ✅ Existe (refeito no redesign, com % entre etapas) |
| **Tempo médio até quente** | ❌ Não existe — e **não há dado**: nenhuma tabela grava quando o lead mudou de estágio |
| **SLAs vencidos da semana** | ❌ Não existe — o conceito de SLA não entrou nesta versão do CRM |
| **Leads por origem/campanha** | ❌ Não existe — a tabela `leads` não tem campo de origem/UTM (só o boolean `via_disparo`) |
| **Motivos de perda agregados** | ❌ Não existe — `sem_interesse` é um estágio, mas o motivo nunca é gravado |
| Filtro por período | ⚠️ Parcial — filtra só o gráfico de captação; funil e métricas ignoram o período |

Ou seja: **as quatro métricas mais "de gestão" do seu próprio brief são exatamente as que faltam.** Não foi decisão de produto — foi o recorte que sobrou da implementação.

### 3.2 Conversa de 29/07/2026 — "Los CRM design system"

No brief do Los CRM você escreveu a frase que resume a melhor crítica possível ao dashboard atual:

> **"NÃO é um dashboard de KPIs. É uma fila de trabalho ranqueada. Uma lista dos clientes com maior probabilidade de comprar hoje, ordenada, limitada ao cap diário. (...) Sem cards de vaidade."**

Essa filosofia se aplica 1:1 ao Alliance: são **5 usuários** vendendo **34 unidades**. Nesse tamanho, o corretor que abre o sistema de manhã não precisa de BI — precisa saber **quem atacar hoje**. E a ironia: o Alliance **já tem** o insumo pronto (`lead_score` 0–100 por lead, com `lead_score_reasons`), mas usa o score para... exibir médias. A média do score dos frios (0,4) é informação morta; a **lista dos 10 maiores scores sem contato há 3+ dias** é dinheiro.

---

## 4. Auditoria métrica por métrica do dashboard atual

| # | Métrica na tela | Tipo | Veredicto | Justificativa |
|---|---|---|---|---|
| 1 | **Total de leads (806)** | Lagging/contexto | 🟡 Rebaixar | Número de vaidade clássico: só cresce, não dispara ação. Útil como contexto — já aparece na faixa hero. Não merece o card mais nobre da tela. |
| 2 | **Leads quentes (9)** | Leading | 🟢 Manter e promover | O melhor número da tela. Deveria ser clicável → abrir o Kanban filtrado. |
| 3 | **Reuniões (16)** | Leading | 🟡 Renomear | **A conta está certa.** Somar `reuniao_agendada + follow_up + sem_interesse + visita + cliente` é intencional: no processo da Alliance, `sem_interesse` é quem **passou pela reunião e disse não**, e `follow_up` é quem **está pensando**. Todos são desfechos pós-reunião, então o número é o acumulado de "chegou à reunião ou além" — métrica de funil legítima e a mais próxima de receita na tela. O que atrapalha é o rótulo: "Reuniões" sugere agenda da semana, não avanço de funil. Chamar de **"Chegaram à reunião"** resolve. |
| 4 | **Leads pós-reunião (16)** | — | 🔴 Cortar | É **literalmente o mesmo número** do card Reuniões (`disponiveis = meetingStageCount = reunioes` no código). Duplicata com outro rótulo — e a existência dela é sintoma de que o rótulo do card 3 não estava comunicando o que o número mede. |
| 5 | **Sem resposta (568 · 70%)** | — | 🟡 Reformular | Número gigante e estático — deprime sem orientar. A versão acionável: "frios com 0 disparos" (que já existe na seção Disparos: 196) ou "sem resposta há >48h". |
| 6 | **Pausados (12)** | Operacional | 🟢 Manter pequeno | É um proxy de "handoffs em andamento" + termômetro de confiança na IA. Melhor ainda se virar taxa de pausa manual/semana. |
| 7–10 | **Score médio global / frio / morno / quente** | — | 🔴 Cortar os 4 | Falham no teste de acionabilidade: se o score médio dos mornos cair de 5,9 para 5,3, ninguém faz nada — nem saberia o quê. Uma faixa inteira da primeira dobra gasta em médias de um número cujo valor está no **ranking individual**. Substituir pela fila ranqueada (seção 5). |
| 11 | **Novos leads/dia (gráfico)** | Leading topo de funil | 🟢 Manter | Com média/dia, melhor dia e dias com captação — bem resolvido. |
| 12 | **Funil comercial** | Diagnóstico | 🟢 Manter | Pós-redesign mostra conversão entre etapas (12% frio→morno, 11% morno→quente...). É o mapa de onde o funil vaza. Falta obedecer ao filtro de período. |
| 13 | **Seção Disparos** | Metric chain | 🟢 Manter — é a melhor seção | Impactados → responderam (18%) → avançaram → reunião → cliente é exatamente a cadeia leading→lagging que os guias recomendam. Único senão: "0 viraram cliente" merece destaque, não rodapé — é o ROI do disparo. |

**Placar: 5 manter · 3 reformular/renomear · 5 cortar.**

> **Nota de revisão (03/08).** A primeira versão deste dossiê classificou o card "Reuniões" como *errado* por incluir `sem_interesse`. Estava incorreto: essa leitura assumia que `sem_interesse` fosse rejeição de topo de funil, quando no processo da Alliance é desfecho **pós-reunião** ("passou pela reunião e falou não"), assim como `follow_up` é "está pensando". A soma mede o acumulado de quem chegou à reunião — está certa. O que fica de crítica é só o rótulo e a duplicata do card 4.

---

## 5. O que falta — em ordem de valor por real investido

### P0 — dá para fazer HOJE, sem tocar no banco

1. **Fila de trabalho ranqueada** (a ideia do Los CRM). Card "Quem atacar hoje": top-N leads por `lead_score`, excluindo quem já teve contato nas últimas 24h, com nome, score, estágio, dias sem contato e o *porquê* (`lead_score_reasons` já guarda as razões!). Clique → abre o lead. **É o maior upgrade possível de valor/hora do sistema inteiro.**
2. **Renomear "Reuniões" → "Chegaram à reunião"** e remover a duplicata "Leads pós-reunião". O número está correto e é o mais próximo de receita na tela; só precisa de um rótulo que diga que é acumulado de funil, não agenda. Ganha ainda mais se abrir o desfecho embaixo — *16 chegaram · 8 pensando · 7 disseram não · 1 comprou* — que é a taxa de aproveitamento da reunião, o KPI que mede a qualidade do lead que a Alice entrega.
3. **Adicionar a agenda da semana** a partir da tabela `meetings` (que existe, com status agendada/realizada/cancelada e hoje não aparece em lugar nenhum do dashboard). Não substitui o card acima — responde outra pergunta: *o que tenho marcado nos próximos dias*. E de quebra sai a **taxa de no-show**, KPI padrão do setor.
4. **Cortar os 4 cards de score médio** → com os itens 2 e 3, a primeira dobra fica com 3–4 números fortes (dentro da regra dos 5–7).
5. **Vendas na tela.** A tabela `vendas` e o catálogo existem e o dashboard não mostra **nenhum real**. Para uma incorporadora: unidades vendidas/reservadas/disponíveis (X/34) + VGV realizado. É o único número que o sócio realmente quer ver.
6. **Métricas da IA:** % de leads com `aceitou_consultor` atendidos, pausas manuais na semana. Computável com o que existe.

### P1 — exige UMA migration pequena (tabela `lead_stage_events`)

Trigger que grava `(lead_id, from_stage, to_stage, changed_at, changed_by)` a cada mudança. Com isso destravam **de uma vez**:

- **Tempo médio até quente** (do seu brief original) — quanto tempo a Alice leva para esquentar um lead;
- **Velocidade de pipeline por etapa** — onde o lead empaca (ex.: quente→reunião demora 6 dias? O gargalo é humano, não da IA);
- **Conversão por período** (funil que respeita o filtro de data — hoje o funil é uma foto do estoque, não do fluxo);
- **Speed to lead do consultor**: `handoff (entrou em quente) → primeira mensagem com sender_type='corretor'`. É A métrica do setor (5 min = 21×) aplicada ao único elo humano do fluxo.

### P2 — exige capturar dados novos na entrada

- **Origem/campanha no lead** (coluna `origem` + UTM no webhook da Meta) → CPL e conversão por canal. Sem isso, todo real de tráfego é investido às cegas.
- **Motivo de perda** (campo obrigatório ao mover para `sem_interesse` — você mesmo pediu isso no brief de 08/07) → o agregado de motivos é o feedback loop do produto e do prompt da Alice.

---

## 6. O dashboard-alvo (proposta consolidada)

```
┌─ HERO (contexto: foto, saudação, 806 na base, filtro de período) ─────────┐
├─ LINHA 1 · AÇÃO ──────────────────────────────────────────────────────────┤
│  Quentes agora → kanban   Handoffs aguardando   Chegaram à reunião        │
│  (leading, clicável)      consultor (SLA)       + desfecho + no-show      │
├─ LINHA 2 · FILA ──────────────────────────────────────────────────────────┤
│  "Quem atacar hoje" — top 10 por score, com motivo e dias sem contato     │
├─ LINHA 3 · FLUXO ─────────────────────────────────────────────────────────┤
│  Novos leads/dia          Funil com conversão %    Cadeia de disparos     │
├─ LINHA 4 · NEGÓCIO (lagging) ─────────────────────────────────────────────┤
│  Unidades X/34 vendidas   VGV realizado   Vendas atribuídas a disparo     │
└───────────────────────────────────────────────────────────────────────────┘
```

Leading em cima, lagging embaixo, cada card responde a uma pergunta de decisão, nada duplicado, e a fila ranqueada como elemento-assinatura — exatamente a tese do Los CRM aplicada aqui.

---

## 7. Conclusão

Os dados do dashboard **importam, mas hoje ele mede o estoque, não o movimento**. Ele diz *quantos leads você tem* (806, 70% mudos, score médio X) e não diz *o que fazer nas próximas 2 horas* nem *quanto dinheiro o funil gerou*. A pesquisa, o benchmark do setor e — o mais revelador — **seus próprios briefs de julho** convergem na mesma direção: menos médias, mais fila de trabalho, tempo como métrica central e receita fechando a cadeia. A boa notícia é que metade do que falta é P0 (sem migration) e o insumo mais valioso — o score por lead — já está calculado e hoje é subutilizado em médias que ninguém aciona.
