# A Ponte: um agente A2A com MCP por dentro

Entrega do desafio "A Ponte" (MBA Engenharia de Software com IA, curso de MCP e A2A).

Dois processos Node.js/TypeScript independentes:

| Processo | Porta | Papel |
|---|---|---|
| `servidor-mcp/` | 7301 (`/mcp`) | Servidor MCP em Streamable HTTP (revisão `2026-07-28`) com `listar_salas`, `consultar_disponibilidade`, `reservar_sala` e o resource `politica://uso`. MRTR completo na reserva. |
| `agente/` | 7300 (`/a2a`, `/.well-known/agent-card.json`) | Por fora, servidor A2A v1.0 (JSON-RPC: `SendMessage`, `GetTask`). Por dentro, host MCP que fala HTTP com o servidor acima. |

O agente não usa LLM: ele interpreta o pedido em formato fixo, e conflito, política e alternativas são decididos pelo servidor MCP.

## Como rodar

Pré-requisitos: Node.js 20 ou superior e Python 3.10 ou superior (para o validador).

```bash
git clone git@github.com:andersonarsilva/desafio-a2a-com-mcp.git
cd desafio-a2a-com-mcp
npm ci
npm run build
```

Terminal 1, servidor MCP. O stderr dele é o log de requests:

```bash
export REQUEST_STATE_SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
npm run start:mcp
```

`REQUEST_STATE_SECRET` é obrigatória: são 32 bytes aleatórios em hexadecimal, e o processo não sobe sem ela. Ela assina o `requestState`, então use o **mesmo valor** se for reiniciar o servidor no meio de um MRTR. Nunca commite o valor; o `.env.example` mostra só os nomes das variáveis.

Terminal 2, agente:

```bash
npm run start:agente
```

Terminal 3, validador, com os dois processos recém-iniciados:

```bash
python3 validador/validar.py --agente http://localhost:7300 --mcp http://localhost:7301
```

Outros comandos:

```bash
npm run test:coverage   # Jest nos dois workspaces, limite de 80%, --maxWorkers=2
npm run lint            # ESLint + typescript-eslint
npm run typecheck
```

As portas e URLs podem ser trocadas por variável de ambiente (`MCP_PORT`, `MCP_PATH`, `AGENT_PORT`, `PUBLIC_URL`, `MCP_URL`). Os padrões são os do enunciado; veja `.env.example`.

## Onde a ponte acontece

A ponte está em [`agente/src/bridge/reservation-bridge.ts`](agente/src/bridge/reservation-bridge.ts).

**Ida.** Na função `aplicar`, quando o `tools/call` volta com `resultType: "input_required"`, o agente:
1. lê a única elicitation em form mode (`bridge/elicitation.ts`), que dá a chave atribuída pelo servidor, o campo e o `enum` na ordem recebida;
2. guarda em `record.pending` a chave, as opções, a chamada original e o `requestState`, opaco e sem nenhuma decodificação;
3. leva a Task a `TASK_STATE_INPUT_REQUIRED` com a mensagem exata `alternativas: a, b` (`pausar`).

O `requestState` fica no `TaskRecord`, que é interno. A serialização para a rede passa por `tasks/task-view.ts`, uma whitelist de `id`, `contextId`, `status`, `history` e `artifacts`, então ele nunca sai em resposta A2A.

**Volta.** Em `resume`, quando chega o `SendMessage` com `taskId` e `escolha=<valor>`:
- uma escolha fora do enum repete a pausa, sem falar com o MCP;
- `escolha=recusar` vira `{action: "decline"}`;
- qualquer outra escolha válida vira `{action: "accept", content: {sala}}`.

O `retry` repete o `tools/call` original com `inputResponses` na **mesma chave** e o `requestState` **ecoado sem modificação**. O id JSON-RPC é novo, gerado pelo cliente do SDK. Do lado do servidor, [`servidor-mcp/src/mcp/tools/reservar-sala.ts`](servidor-mcp/src/mcp/tools/reservar-sala.ts):
- emite o `input_required` em `pedirEscolha`;
- no retry, recebe o estado já verificado por `ctx.mcpReq.requestState()` e o trata em `retomar`.

O traceparent que chega no header A2A é guardado na Task (`trace`). Cada request MCP daquela Task, inclusive o retry de uma continuação que chegou sem header, sai com o mesmo trace-id e um span-id novo (`mcp-host/trace-context.ts`).

## Decisões técnicas

**Proteção do `requestState`.**
- Usa o utilitário do próprio SDK, `createRequestStateCodec`: HMAC-SHA256, com o formato `v1.<payload base64url>.<mac>` (`servidor-mcp/src/mcp/request-state.ts`).
- A chave vem de `REQUEST_STATE_SECRET`, validada no boot com zod (hexadecimal, no mínimo 32 bytes decodificados). Não há segredo no código.
- O `verify` do codec está plugado em `ServerOptions.requestState.verify`. Um token adulterado, assinado com outra chave ou expirado é recusado pelo SDK **antes** do handler, com `-32602 "Invalid or expired requestState"`.
- O token também é vinculado ao método (`bind: ctx.mcpReq.method`).
- O conteúdo é legível, porque é assinado e não cifrado, mas não é adulterável.

**Validade.** O token vale 600 s (10 minutos, dentro da faixa de 5 a 30 min), com a expiração dentro do próprio token.

**Servidor sem estado entre as rodadas.** O payload selado carrega o pedido original e as alternativas oferecidas. O servidor não guarda nada entre o `input_required` e o retry, e por isso um retry funciona depois de reiniciar o processo, desde que com a mesma chave.
- No retry, os argumentos reenviados pelo cliente são ignorados e **valem os selados**.
- Uma escolha fora das alternativas seladas vira erro de execução.
- Se a alternativa escolhida tiver sido ocupada nesse meio-tempo, o servidor recalcula e pergunta de novo.
- `decline` e `cancel` concluem como `complete`, com `reservado: false`.

**Erros de protocolo** ficam com o SDK (`createMcpHandler` com `legacy: 'reject'` e `responseMode: 'json'`):
- `_meta` incompleto: `-32602` com HTTP 400;
- falta de `elicitation.form` no envelope do request: `-32021` com `data.requiredCapabilities` e HTTP 400;
- header que não bate com o corpo: `-32020`;
- tool ou resource inexistente: `-32602`.

Nada é inferido de requests anteriores.

**Estado das Tasks.** Fica num `Map` em memória no processo do agente (`agente/src/tasks/task-store.ts`). As reservas também ficam em memória, no servidor MCP (`servidor-mcp/src/domain/reservas.ts`), carregadas de `dados/` no boot. Ambos são perdidos num restart, como permite o enunciado. Estado terminal é definitivo (`tasks/task-state.ts`), e um `SendMessage` para uma Task terminal recebe `-32004`.

**Logs.** Os dois processos escrevem JSON, uma linha por evento, no **stderr**. O servidor MCP registra em cada request `method`, `id`, `name`, `traceparent` e `traceId`, e em cada resposta `resultType` ou o código de erro. Argumentos e `requestState` não vão para o log.

### Limitação do SDK encontrada (e como foi tratada)

No `@modelcontextprotocol/client@2.3.1`, que também se comporta assim na 2.4.0, `callTool` aplica a validação de `outputSchema` a **qualquer** resultado, inclusive a um `input_required`. Pela spec, esse resultado não carrega `structuredContent`. Trecho de `node_modules/@modelcontextprotocol/client/dist/index.mjs` (linha 4277):

```js
if (result.structuredContent === void 0 && !result.isError) throw new ProtocolError(ProtocolErrorCode.InvalidRequest, `Tool ${params.name} has an output schema but did not return structured content`);
```

Sem tratamento, toda pausa virava `TASK_STATE_FAILED`. O protocolo não foi reescrito. O agente usa a opção pública `toolDefinition` do próprio `callTool`, passando a definição descoberta no `tools/list` sem `outputSchema` (`agente/src/mcp-host/sdk-mcp-host.ts`). Com isso o `input_required` chega cru, e a ponte valida o `structuredContent` da reserva com zod.

### Estrutura

```
servidor-mcp/src
  domain/regras.ts       janela, duração, sobreposição, alternativas e as mensagens exatas (funções puras)
  domain/reservas.ts     store em memória
  mcp/tools/*.ts         as três tools; reservar-sala.ts tem o MRTR
  mcp/request-state.ts   codec HMAC do SDK
  http/                  adapter node:http → fetch do SDK, log no stderr
agente/src
  a2a/                   Agent Card, JSON-RPC, SendMessage/GetTask
  bridge/                a ponte (input_required ↔ TASK_STATE_INPUT_REQUIRED)
  mcp-host/              cliente MCP do SDK, traceparent
  tasks/                 máquina de estados, store e view sem requestState
```

## Saída do validador

Última execução, com os dois processos recém-iniciados:

```
trace-id desta execucao: 69b53600ea729562dc19db097330e004
procure esse valor no stderr do servidor MCP para conferir a propagacao do traceparent.

PASS 01 tools/list traz as tres tools
PASS 02 toda tool tem inputSchema de objeto
PASS 03 listar_salas devolve structuredContent e o mesmo JSON em texto
PASS 04 _meta sem protocolVersion devolve -32602 e HTTP 400
PASS 05 _meta sem clientCapabilities devolve -32602 e HTTP 400
PASS 06 tool inexistente e recusada, por -32602 ou por isError
PASS 07 resources/read de politica://uso devolve a politica
PASS 08 resources/read de URI inexistente devolve -32602
PASS 09 sala inexistente devolve isError com a mensagem exata
PASS 10 fora da janela devolve isError com a mensagem exata
PASS 11 duracao acima de 2h devolve isError com a mensagem exata
PASS 12 intervalo invertido devolve isError com a mensagem exata
PASS 13 conflito devolve input_required com inputRequests e requestState
PASS 14 a elicitation e form mode e oferece as alternativas na ordem certa
PASS 15 conflito sem a capability elicitation devolve -32021 e HTTP 400
PASS 16 retry com inputResponses e requestState conclui a reserva
PASS 17 requestState adulterado e rejeitado com -32602
PASS 18 argumentos adulterados no retry nao tomam efeito
PASS 19 recusa conclui sem reservar e sem isError
PASS 20 conflito sem alternativa possivel devolve isError com a mensagem exata

PASS 21 agent card responde 200 no well-known com JSON
PASS 22 o card declara a interface JSON-RPC com url e versao 1.0
PASS 23 o card declara a skill reservar-sala
PASS 24 SendMessage com sala livre conclui a Task
PASS 25 o artifact chama reserva e traz a versao da politica
PASS 26 GetTask devolve id, contextId e estado corrente
PASS 27 SendMessage com sala ocupada pausa a Task
PASS 28 a Task pausada lista as alternativas na ordem certa
PASS 29 escolha fora do enum mantem a Task pausada
PASS 30 a continuacao conclui a Task na sala escolhida
PASS 31 SendMessage em Task terminal e recusado
PASS 32 a recusa termina a Task em CANCELED
PASS 33 duas Tasks pausadas ao mesmo tempo concluem cada uma com a sua reserva
PASS 34 nenhuma resposta A2A carrega o requestState
PASS 35 sala inexistente termina a Task em FAILED com a mensagem da tool
PASS 36 o agente e deterministico: o mesmo pedido produz a mesma pausa

resumo: 36 passaram, 0 falharam, de 36 verificacoes
```
