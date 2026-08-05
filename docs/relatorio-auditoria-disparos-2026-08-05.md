# Auditoria estrutural da ferramenta de disparos

**Data:** 05/08/2026  
**Ambiente analisado:** produção (`crm-alliance.vercel.app`) e código-fonte local  
**Escopo:** seleção de público, contexto, geração por IA, controle de qualidade, prévia e rastreabilidade

## Resumo executivo

A ferramenta ainda não deve ser tratada como um gerador autônomo pronto para disparos em escala. O principal defeito não está no estilo da mensagem: está antes da escrita. O fluxo mistura seleção de público, interpretação de conversa e redação numa mesma operação. Assim, quando um bot, fornecedor, parceiro ou conversa sem contexto entra como `lead_frio`, a IA recebe a tarefa impossível de escrever uma boa mensagem para a pessoa errada.

Em uma simulação real com 20 contatos em produção, sem criar campanha e sem enviar mensagens:

- 1 contato foi removido por recusa explícita;
- 19 mensagens foram geradas;
- pelo menos 5 expuseram o estado interno do CRM, com frases como “não temos histórico”;
- um chatbot da UNIASSELVI foi tratado como comprador;
- uma conversa pessoal sem relação imobiliária virou argumento de venda;
- apareceram informações não fornecidas no tema, como localização e previsão de entrega;
- a maior parte das mensagens seguiu a mesma estrutura genérica.

**Conclusão:** o motor precisa funcionar como uma esteira com travas independentes. Primeiro decide se o contato é comprador; depois extrai fatos comprovados; só então redige; por último valida cada afirmação antes de liberar a prévia.

## O que foi testado

Foi usada a interface real de produção em `Disparos > Nova Reativação`:

1. seleção aleatória de 20 leads frios com 0 disparos;
2. modo `Criar com Contexto`;
3. geração com o tema informado pelo gestor;
4. inspeção das prévias produzidas;
5. encerramento antes de criar campanha ou injetar mensagens.

Tema usado:

> As obras do La Reserva avançaram bastante desde o nosso último contato: a fundação já está praticamente concluída e, em breve, começamos a subir os andares. Estou te mandando essa mensagem porque estamos em um bom momento: quem entra agora ainda pega uma valorização interessante até o fim da obra, e estou aqui pra te ajudar a tomar a melhor decisão. O projeto ainda faz sentido pra você?

## Resultado da amostra

| Contato | Resultado observado | Diagnóstico |
|---|---|---|
| João Silva | Tratado como interessado no La Reserva | Era o bot da UNIASSELVI; erro grave de público |
| Lead #1 | Usou uma fala pessoal sobre “cheguei hoje” e “mesma luta” | Contexto irrelevante virou personalização |
| Lead #2 | Citou Castelo e entrega em fevereiro de 2030 | Informação fora do tema e potencialmente desatualizada |
| Lívia | “Ainda não tivemos contato antes” | Expôs estado interno do CRM |
| Lucas | “Não temos histórico seu aqui” | Expôs estado interno do CRM |
| Luciana | “Não temos histórico seu ainda” | Expôs estado interno do CRM |
| Marcela | “Não temos nada seu registrado antes” | Expôs estado interno do CRM |
| Marcelo | “Não tenho histórico seu cadastrado” | Expôs estado interno do CRM |
| R L | Cobrou falta de resposta ao contato anterior | Nome inseguro e tom de cobrança |
| Raquell | Afirmou que ela demonstrou interesse e recebeu material | Continuidade tratada como fato atual |
| Lorena Santiago | Mensagem gerada | Estrutura muito semelhante às demais |
| Lory Uhlig | Mensagem gerada | Estrutura muito semelhante às demais |
| Luzia Nog | Mensagem gerada | Estrutura muito semelhante às demais |
| Marco Frauches | Mensagem gerada | Estrutura muito semelhante às demais |
| Marilza Ambrosio | Mensagem gerada | Estrutura muito semelhante às demais |
| Mariza Rocha | Mensagem gerada | Estrutura muito semelhante às demais |
| Rafa | Mensagem gerada | Personalização limitada pelo pouco contexto |
| Rafaela Campanha | Mensagem gerada | Estrutura muito semelhante às demais |
| Raphael Fiorese | Mensagem gerada | Estrutura muito semelhante às demais |
| Renata | Removida antes da geração | Bloqueio correto por falta de interesse |

## Achados por severidade

### Críticos

1. **Público errado chega ao modelo.** A coluna fria continha bots de outras empresas, fornecedores, parceiros, candidatos a emprego e contatos de teste.
2. **Não existe fronteira forte entre dado e texto.** Trechos da conversa, resumo e instruções chegam próximos demais da redação final; o modelo pode copiar o estado do CRM ou um detalhe velho.
3. **O gate posterior não compensa seleção ruim.** Uma frase pode estar gramaticalmente perfeita e continuar sendo inadequada porque o destinatário não é comprador.

### Altos

1. **Personalização sem lastro.** Na ausência de contexto útil, o sistema fabrica transições para parecer personalizado.
2. **Fatos atuais e históricos não têm proveniência explícita.** Preço, prazo, metragem e condição comercial antigos podem ser tratados como atuais.
3. **A mensagem-base funciona simultaneamente como briefing e texto copiável.** Isso incentiva paráfrases repetitivas e reduz diversidade real.
4. **A interface permite avançar sem mostrar por que cada lead foi incluído.** O operador vê a mensagem, mas não a decisão de elegibilidade e as fontes usadas.

### Médios

1. Nome de empresa, placeholder ou sigla pode aparecer como saudação.
2. Não há indicador operacional de fallback, reparo ou regeneração por mensagem.
3. Não há conjunto fixo de conversas para detectar regressões a cada mudança de prompt.
4. As métricas medem envio e resposta, mas não qualidade, edição humana ou bloqueio preventivo.

## Causa raiz

O endpoint atual executa responsabilidades demais:

1. carrega lead e interações;
2. tenta decidir elegibilidade por expressões regulares;
3. escolhe uma fala como âncora;
4. monta o prompt;
5. chama o LLM;
6. repara texto;
7. regenera ou usa fallback;
8. devolve a mensagem pronta.

Essa concentração torna cada ajuste de prompt responsável por corrigir problemas de dados, segmentação e produto. Prompt não é uma política de acesso nem um classificador confiável de público.

## Arquitetura recomendada

### 1. Elegibilidade comercial

Criar uma etapa anterior e independente com resultado estruturado:

```json
{
  "eligible": false,
  "audience_type": "supplier",
  "confidence": 0.99,
  "reasons": ["oferece execução de serviços elétricos para a obra"]
}
```

Tipos mínimos: `buyer`, `supplier`, `partner`, `job_seeker`, `third_party_bot`, `test`, `unknown`. Somente `buyer` pode seguir automaticamente. `unknown` exige revisão humana.

### 2. Contexto comercial estruturado

Extrair fatos para um objeto com fonte e validade:

```json
{
  "intent": { "value": "morar", "source": "lead_message", "at": "..." },
  "unit_preferences": [],
  "objections": [],
  "requested_human_contact": false,
  "safe_reference": null
}
```

Um fato histórico não deve ser repetido automaticamente. Ele serve para escolher o enfoque; números e condições só podem sair de uma base comercial atual aprovada.

### 3. Briefing da campanha

Separar `objetivo`, `novidade`, `fatos permitidos`, `tom`, `CTA` e `proibições`. O texto digitado pelo usuário deixa de ser tratado como mensagem pronta. Frases problemáticas do tema, como promessa de valorização ou continuidade inexistente, são normalizadas antes da IA.

### 4. Plano de mensagem

Antes da redação, criar uma decisão curta e auditável:

```json
{
  "opening": "obra",
  "personalization_fact_ids": ["fact_2"],
  "cta": "oferecer condições atualizadas",
  "must_not_mention": ["preço antigo", "estado do CRM"]
}
```

Isso impede que o modelo escolha livremente qualquer trecho da conversa.

### 5. Redação controlada

- Sem fato comercial seguro: usar uma variação determinística do briefing, sem fingir personalização.
- Com fato seguro: chamar o LLM somente com os campos autorizados.
- Nunca enviar transcript completo para a etapa de redação.
- Gerar saída JSON, com texto e IDs dos fatos usados.

### 6. Gate de qualidade e lastro

Toda afirmação deve ser verificável contra `fatos permitidos + contexto aprovado`. Bloquear:

- estado interno do CRM;
- nome inseguro;
- valor, prazo ou metragem sem fonte atual;
- promessa de valorização;
- cobrança de memória ou resposta;
- detalhe pessoal não relacionado ao imóvel;
- similaridade excessiva com outras mensagens do mesmo lote.

### 7. Prévia humana

A prévia deve mostrar, por lead:

- `Elegível`, `Revisar` ou `Bloqueado`;
- por que foi selecionado;
- quais fatos sustentam a personalização;
- mensagem final;
- marcador `Personalizada`, `Tema da campanha`, `Reparada` ou `Fallback`;
- edição manual e exclusão antes de criar a campanha.

### 8. Snapshot imutável

Ao aprovar a campanha, salvar mensagem, briefing, fatos usados, versão do prompt, modelo, flags e texto editado. A análise futura precisa comparar exatamente o que foi aprovado com o que foi enviado.

## Mudança de dados: Fornecedores

Foi feita uma auditoria conservadora de todos os 674 leads que estavam na coluna fria:

- 33 não compradores de alta confiança na coluna fria, após duas passadas;
- 2 não compradores que já haviam sido movidos para quente;
- total: 35 contatos classificados;
- composição da coluna fria: 8 fornecedores, 4 parceiros, 16 bots de terceiro, 2 candidatos a emprego e 3 testes;
- os 2 contatos quentes adicionais são 1 fornecedor e 1 corretor parceiro.

Nomes comerciais sem nenhuma conversa permaneceram no funil por falta de evidência. Na arquitetura nova, eles devem cair em `unknown` para revisão humana, não ser movidos ou disparados automaticamente só pelo nome.

A nova coluna `Fornecedores` fica imediatamente à esquerda de `Lead Frio`. Os contatos movidos ficam com automação pausada, inelegíveis para resgate e sem tarefas pendentes. Um snapshot preserva estágio e estados anteriores para reversão assistida.

## Plano de execução

### Fase 0 — contenção imediata

- separar os 35 não compradores;
- bloquear assinaturas conhecidas de bots de terceiros;
- impedir exposição de “histórico”, “cadastro” e “sistema”;
- manter revisão humana obrigatória antes do envio.

### Fase 1 — reconstruir seleção e contexto

- introduzir `audience_type` e estado `unknown`;
- criar fatos estruturados com proveniência;
- excluir transcript cru da redação;
- adicionar tela de justificativa e fatos usados.

### Fase 2 — motor de mensagem

- implementar plano de mensagem;
- separar geração sem contexto da geração personalizada;
- validar lastro de cada detalhe;
- controlar similaridade dentro do lote.

### Fase 3 — operação e aprendizado

- criar conjunto ouro com 30 a 50 conversas reais revisadas;
- rodar regressão automática a cada mudança;
- medir taxa de bloqueio, fallback, edição humana, resposta negativa, resposta positiva e avanço;
- liberar aumento de volume somente após os indicadores estabilizarem.

## Critérios para considerar pronto

1. Zero bots, fornecedores, parceiros, empregos ou testes numa amostra revisada de 100 destinatários.
2. Zero fatos sem fonte em 100 mensagens geradas.
3. Zero exposição de estado interno do CRM.
4. Toda mensagem mostra fatos usados e modo de resolução.
5. Operador consegue excluir ou editar antes da campanha.
6. Suite de regressão cobre casos reais de compra, recusa, retomada, fornecedor, bot, nome inválido e pouco contexto.

## Reversibilidade

- A classificação dos 35 contatos é registrada em `fornecedores_classification_audit` com estágio, automação e resgate anteriores.
- A migração de banco é transacional.
- O código será publicado em commit identificável e pode ser revertido por commit.
- Nenhuma mensagem foi enviada durante esta auditoria.

## Execução da correção

Implementado em 05/08/2026:

- público estruturado como `buyer`, `unknown` ou categoria bloqueada;
- fatos comerciais com fonte, data, evidência e permissão de cópia;
- briefing da campanha separado do texto final;
- plano de mensagem com fatos e CTA autorizados;
- prompt sem transcript, fala literal, observação livre ou valor antigo;
- gate para vazamento do CRM, fato atual sem fonte, exagero, promessa e repetição no lote;
- prévia com contexto, fatos usados, edição, remoção e aprovação obrigatória dos casos em revisão;
- nova validação no servidor depois de qualquer edição manual;
- snapshot de geração e aprovação gravado de forma transacional com a mensagem do dispatch;
- regressão automatizada cobrindo 75 testes no projeto, dos quais 67 são específicos do motor de disparos.
