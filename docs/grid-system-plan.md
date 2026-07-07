# Plano de Implementacao — Sistema de Grid (Mapa em Tempo Real)

## Contexto

Adicionar um sistema de grid similar ao Roll20 (versao simplificada) para a pagina de Aventura.
O objetivo e ter um mapa com tokens de personagens que podem ser movidos em tempo real por todos os jogadores conectados.

### Escopo incluso
- Canvas minimalista com fundo liso + linhas do grid, tudo desenhado no frontend (sem imagem de fundo)
- Grid com tamanho padrao fixo (ex: 20x15 celulas)
- Tokens de personagens com avatar (imagem), posicionados nas celulas do grid
- Drag & drop com snap-to-grid
- Sincronizacao em tempo real via WebSocket (Socket.IO)
- Qualquer jogador pode mover qualquer token
- Um mapa ativo por vez na sessao
- Grid coexiste com os cards de personagem (modo expandido/minimizado)
- Visivel e funcional em mobile (touch drag)

### Fora de escopo (por enquanto)
- Fog of war / iluminacao dinamica
- Ferramentas de desenho
- Medicao de distancia
- Permissoes granulares (quem move quem)
- Multiplas camadas (map layer, token layer, GM layer)
- Multiplos mapas abertos simultaneamente

---

## Decisoes de Design

### Integracao com a Adventure
- O grid sera uma secao dentro da pagina de Adventure, coexistindo com os cards de personagem.
- Havera dois modos: **grid expandido** (cards ficam em uma barra lateral compacta com botao para expandir) e **cards expandidos** (grid minimizado ou oculto).
- A barra lateral compacta mostra **nome + HP (atual/maximo)** do personagem. Sem mana/pilares (cabe no card expandido). Clicar no item da sidebar expande aquele personagem (ou abre modal).

### Controle de tokens
- Qualquer jogador conectado pode mover qualquer token. Sem restricao por dono.

### Aparencia dos tokens
- Tokens exibem a **imagem do personagem** (upload).
- Sem nome ou barra de HP sobre o token por enquanto.
- A imagem e associada ao personagem, nao ao token em si.

### Mapa
- **3 presets de tamanho** selecionaveis na criacao:

  | Preset | Dimensoes | Celulas | Uso tipico |
  |---|---|---|---|
  | `small`  | 15 × 10 | 150 | combates rapidos, masmorra, arena |
  | `medium` (padrao) | 20 × 15 | 300 | encontros normais |
  | `large`  | 30 × 20 | 600 | campo aberto, cenas epicas |

  Proporcao ~3:2 (landscape) em todos os presets. O usuario nao informa `gridWidth/Height` diretamente — o server traduz o preset nos valores corretos. Isso evita inputs arbitrarios e mantem a UI em botoes segmentados.
- **Sem imagem de fundo**: o canvas renderiza um fundo liso (cor hardcoded, ex: `#1c1c24` pra bater com o tema) e desenha as linhas do grid por cima. Nada de upload ou asset externo pra mapa.
- Apenas **um mapa ativo** por sessao. O mestre troca quando muda de cenario.

### Troca de mapa
- Ao trocar o mapa ativo, os tokens **nao sao reposicionados automaticamente**. O mestre posiciona manualmente cada personagem no novo mapa.
- **Tokens do mapa anterior sao deletados** ao ativar um novo mapa (cascade controlado via rota `activate`). Nao mantemos historico de posicoes — se o mestre voltar para o mapa antigo, comeca vazio.
- **Redirecionamento automatico**: ao ativar um mapa, o server emite `grid:activated` via Socket.IO para todos os clientes conectados da sessao. Os clientes trocam a sala do Socket.IO e recarregam o estado do novo mapa sem acao do usuario.

### Mobile
- O grid deve ser **visivel e funcional** em mobile, incluindo arrastar tokens por touch.

---

## Arquitetura

### Decisao: Modulo separado no mesmo servidor (Opcao A)

O Socket.IO sera acoplado ao mesmo `httpServer` do Express, mas isolado em seu proprio diretorio.
As rotas REST existentes nao serao alteradas.

```
server/src/
  index.js                  <- Express atual (sem mudancas na estrutura)
  socket/
    index.js                <- inicializa Socket.IO, middleware de auth
    handlers/
      grid.js               <- eventos: mover token, entrar/sair do mapa
  uploads/                  <- diretorio de arquivos (mapas, avatares)
```

**Justificativa**: o volume de usuarios simultaneos e baixo (4-6 jogadores por mesa), nao justifica um servico separado. A modularidade permite extrair no futuro se necessario.

---

## Etapas de Implementacao

### Etapa 1 — Schema do banco (Prisma)

Novos modelos:

```prisma
model GameMap {
  id         Int      @id @default(autoincrement())
  nome       String
  gridWidth  Int      @default(20) @map("grid_width")
  gridHeight Int      @default(15) @map("grid_height")
  cellSize   Int      @default(40) @map("cell_size")
  active     Boolean  @default(false)
  tokens     Token[]

  @@map("game_maps")
}

model Token {
  id          Int       @id @default(autoincrement())
  posX        Int       @default(0) @map("pos_x")
  posY        Int       @default(0) @map("pos_y")
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)
  characterId Int       @map("character_id")
  gameMap     GameMap   @relation(fields: [gameMapId], references: [id], onDelete: Cascade)
  gameMapId   Int       @map("game_map_id")

  @@map("tokens")
}
```

Alteracoes em modelos existentes:

- `Character`: adicionar `imageUrl String? @map("image_url") @db.Text` (avatar do personagem) e `tokens Token[]`

**Dependencias**: nenhuma.

---

### Etapa 2 — Upload de avatares

Sistema de upload apenas para avatares de personagem (usados nos tokens). Mapa nao usa asset.

- Usar `multer` para processar multipart/form-data
- Armazenar em `server/uploads/avatars/`
- Servir estaticamente via Express (`/uploads/avatars/...`)
- Rota:
  - `POST /api/upload/avatar` — upload de avatar do personagem, retorna URL
- Validacao: apenas imagens (jpg, png, webp), limite de tamanho

**Dependencias**: nenhuma.

---

### Etapa 3 — Rotas REST para GameMap e Token

CRUD basico para gerenciar mapas e tokens (antes de implementar tempo real):

- `GET    /api/maps`              — listar mapas
- `POST   /api/maps`              — criar mapa. Body: `{ nome, size: "small" | "medium" | "large" }` (default: `"medium"`). Server deriva `gridWidth/Height` a partir do preset; rejeita size desconhecido com 400.
- `GET    /api/maps/:id`          — obter mapa com tokens (include characters)
- `PATCH  /api/maps/:id`          — editar mapa (nome e/ou size; se size mudar, ver "Resize" abaixo)
- `DELETE /api/maps/:id`          — deletar mapa
- `POST   /api/maps/:id/tokens`   — adicionar token (characterId, posX, posY)
- `DELETE /api/tokens/:id`         — remover token do mapa
- `PATCH  /api/tokens/:id`         — atualizar posicao (usado como fallback/persistencia)
- `POST   /api/maps/:id/activate` — ativar mapa. Em transacao: (1) deleta todos os tokens do mapa anteriormente ativo, (2) marca o anterior `active: false`, (3) marca o novo `active: true`. Em seguida, emite `grid:activated` via Socket.IO para redirecionar os clientes.

Constante server-side:

```js
const MAP_PRESETS = {
  small:  { gridWidth: 15, gridHeight: 10 },
  medium: { gridWidth: 20, gridHeight: 15 },
  large:  { gridWidth: 30, gridHeight: 20 },
};
```

**Resize de mapa existente** (`PATCH` com size diferente): tokens cuja posicao ultrapassa as novas dimensoes sao **clampados** para o limite (`posX = min(posX, newWidth - 1)`, mesmo para Y). Nao deleta tokens. Justificativa: evita perda acidental de configuracao quando o mestre troca de preset.

**Dependencias**: Etapas 1 e 2.

---

### Etapa 4 — Socket.IO no servidor

#### 4.1 — Setup

- Instalar `socket.io` no server
- Criar `server/src/socket/index.js`:
  - Extrair o `httpServer` do Express (`http.createServer(app)`)
  - Inicializar `new Server(httpServer)` com cors
  - Middleware de autenticacao (validar cookie de sessao, igual ao auth.js existente)

#### 4.2 — Handlers do grid (`server/src/socket/handlers/grid.js`)

Eventos:

| Evento (client -> server) | Descricao | Broadcast (server -> clients) |
|---|---|---|
| `grid:join`     | Entrar em uma sala do mapa (mapId) | — |
| `grid:leave`    | Sair da sala | — |
| `grid:move`     | Mover token (tokenId, posX, posY) | `grid:moved` (para todos na sala) |
| `grid:add`      | Adicionar token ao mapa | `grid:added` |
| `grid:remove`   | Remover token do mapa | `grid:removed` |
| — (disparado pelo POST `/maps/:id/activate`) | — | `grid:activated` (broadcast global da sessao, com `{ mapId }`) |

- Cada mapa e uma "sala" do Socket.IO (`socket.join(mapId)`)
- Ao receber `grid:move`, persiste no banco via Prisma e emite `grid:moved` para a sala
- Validacoes: token pertence ao mapa, posicao dentro dos limites do grid
- **`grid:activated`**: quando o mestre ativa um mapa novo via REST, o handler emite para todos os sockets da sessao. No client, o handler do evento: sai da sala atual (`grid:leave`), entra na nova (`grid:join mapId`), busca o estado via `GET /api/maps/:id` e re-renderiza. Sem prompt/acao do usuario.

**Dependencias**: Etapas 1 e 3.

---

### Etapa 5 — Frontend: Canvas e renderizacao do mapa

#### 5.1 — Componente `GridMap`

- HTML5 `<canvas>` que renderiza:
  1. Fundo liso (cor solida hardcoded, sem imagem)
  2. Linhas do grid desenhadas por cima via `ctx.moveTo/lineTo`
  3. Tokens nas posicoes (avatar do personagem recortado em circulo; fallback pra placeholder quando `character.imageUrl` e nulo)
- Props: mapa (dimensoes), tokens (posicoes + imageUrl do character), callbacks

#### 5.2 — Interacoes basicas

- **Pan**: arrastar o canvas para mover a "camera" (mouse drag ou touch)
- **Zoom**: opcional na v1, pode manter fixo

#### 5.3 — Layout da Adventure com grid

- Dois modos na pagina de Adventure:
  - **Grid expandido**: canvas ocupa a area principal, cards ficam em barra lateral compacta (nome resumido + botao para expandir)
  - **Cards expandidos**: grid minimizado/oculto, cards voltam ao layout atual
- Botao de toggle entre os modos
- Responsivo: em mobile, o grid ocupa tela cheia e a barra de personagens fica em um painel colapsavel inferior/lateral

**Dependencias**: Etapas 3 e 4.

---

### Etapa 6 — Frontend: Drag & Drop de tokens

- Detectar clique/touch sobre um token no canvas
- Ao arrastar, mover o token visualmente seguindo o cursor/dedo
- Ao soltar, calcular a celula mais proxima (snap-to-grid)
- Emitir `grid:move` via Socket.IO com a nova posicao
- Ao receber `grid:moved`, atualizar a posicao do token no state e re-renderizar o canvas
- **Mobile**: suporte a touch events (touchstart, touchmove, touchend) com as mesmas mecanicas

**Dependencias**: Etapas 4 e 5.

---

### Etapa 7 — UI de gerenciamento de mapas

- Secao para criar/editar/deletar mapas. Form:
  - Input de texto: **nome**
  - Segmented control (3 botoes lado a lado): **Pequeno / Medio / Grande**, com Medio selecionado por default. Cada botao mostra label + dimensoes em texto menor (ex: "Medio · 20×15"). Estilo igual aos pills de filtro que ja existem.
- Interface para adicionar/remover tokens (selecionar personagem, colocar no mapa)
- Botao para ativar/desativar mapa (apenas um ativo por vez)
- Upload de avatar do personagem: disponivel **tanto na criacao** (`Characters.jsx`, dentro do modal "Adicionar Personagem") **quanto na edicao** (`CharacterCard` em modo edit). Em ambos, um `<input type="file" accept="image/*">` chama `POST /api/upload/avatar` antes do submit final; o retorno (URL) entra no payload como `imageUrl`. Preview do avatar visivel enquanto o usuario edita.

**Dependencias**: Etapas 2 e 3.

---

### Etapa 8 — Testes

#### Server
- Testes das rotas REST (maps, tokens) — mesmo padrao dos testes existentes com supertest + mock do Prisma
- Testes do upload (multer) — mock do filesystem
- Testes dos handlers do Socket.IO — usar `socket.io-client` para simular conexoes

#### Client
- Testes do componente GridMap — renderizacao, snap-to-grid (logica pura)
- Testes de integracao da pagina do mapa — conexao Socket.IO mockada, drag & drop
- Testes do toggle expandido/minimizado

**Dependencias**: todas as etapas anteriores.

---

## Dependencias externas (pacotes novos)

| Pacote | Onde | Finalidade |
|---|---|---|
| `socket.io` | server | Servidor WebSocket |
| `socket.io-client` | client | Cliente WebSocket |
| `multer` | server | Upload de avatares |

Nenhuma lib extra de canvas e necessaria — a API nativa do `<canvas>` e suficiente para o escopo.

---

## Ordem sugerida de execucao

```
Etapa 1 (Schema)
    |
    v
Etapa 2 (Upload) -------> Etapa 7 (UI gerenciamento - pode comecar em paralelo)
    |
    v
Etapa 3 (REST)
    |
    v
Etapa 4 (Socket.IO server)
    |
    v
Etapa 5 (Canvas/grid + layout expandido/minimizado)
    |
    v
Etapa 6 (Drag & drop + sync + touch mobile)
    |
    v
Etapa 8 (Testes)
```

As etapas 1-4 sao backend puro e podem ser feitas e testadas antes de tocar no frontend.
A etapa 7 (UI de gerenciamento) pode ser feita em paralelo com as etapas 4-6.

---

## Perguntas pendentes

As respostas a estas perguntas devem ser incorporadas ao plano antes de iniciar a implementacao.

**11. Barra lateral compacta** — **RESOLVIDO**
Sidebar mostra **nome + HP (atual/maximo)**. Sem mana/pilares (cabe so no card expandido). Detalhes na secao Decisoes > Integracao com a Adventure.

**12. Tamanho padrao do grid** — **RESOLVIDO**
3 presets fixos: `small` (15×10), `medium` (20×15, padrao), `large` (30×20). Selecionado via segmented control no form; server traduz preset em dimensoes. Detalhes na secao Decisoes > Mapa e Etapa 3.

**13. Avatar do personagem** — **RESOLVIDO**
Upload disponivel em ambos: criacao (`Characters.jsx`) e edicao (`CharacterCard`). Detalhes na Etapa 7.

**14. Ativacao do mapa** — **RESOLVIDO**
Redirecionamento **automatico** via `grid:activated` no Socket.IO. Clientes trocam de sala e recarregam estado sem acao do usuario. Detalhes em Decisoes > Troca de mapa e Etapa 4.

**15. Tokens ao trocar de mapa**
Quando o mestre ativa um mapa novo e posiciona os tokens manualmente, os tokens do mapa anterior devem ser preservados (caso voltem aquele mapa depois) ou removidos?

---

## Riscos e consideracoes

- **Storage de avatares**: arquivos ficam em `server/uploads/avatars/`. Em producao no Railway, o filesystem e efemero (reseta no redeploy) — avatares serao perdidos. Para persistir, migrar para S3/R2 no futuro. Para desenvolvimento e testes iniciais, filesystem local basta.
- **Performance do canvas**: para grids ate ~40x30 com poucos tokens, a API nativa do canvas e mais que suficiente. Nao precisa de lib tipo Pixi.js ou Konva.
- **Touch em mobile**: Canvas com touch exige cuidado para distinguir pan (arrastar mapa) de drag (mover token). Solucao: toque em token = drag token; toque em area vazia = pan.
- **Reconexao**: Socket.IO tem reconexao automatica embutida. Ao reconectar, o client deve re-entrar na sala e buscar o estado atual do mapa via REST.
- **Deploy (Railway)**: o WebSocket funciona no Railway sem configuracao extra, pois o Socket.IO faz fallback para long-polling se necessario. O storage de arquivos precisara de solucao externa para producao.
