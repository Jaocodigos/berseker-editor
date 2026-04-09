# Plano de Implementacao — Sistema de Grid (Mapa em Tempo Real)

## Contexto

Adicionar um sistema de grid similar ao Roll20 (versao simplificada) para a pagina de Aventura.
O objetivo e ter um mapa com tokens de personagens que podem ser movidos em tempo real por todos os jogadores conectados.

### Escopo incluso
- Mapa com imagem de fundo (upload) e grid sobreposto com tamanho padrao fixo
- Tokens de personagens com imagem, posicionados nas celulas do grid
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
- A barra lateral compacta mostra informacoes resumidas dos personagens.

### Controle de tokens
- Qualquer jogador conectado pode mover qualquer token. Sem restricao por dono.

### Aparencia dos tokens
- Tokens exibem a **imagem do personagem** (upload).
- Sem nome ou barra de HP sobre o token por enquanto.
- A imagem e associada ao personagem, nao ao token em si.

### Mapa
- Tamanho do grid **fixo/padrao** (ex: 20x15 celulas). O mestre escolhe uma imagem que se adeque a esse tamanho.
- Imagem do mapa via **upload de arquivo** (nao URL externa).
- Apenas **um mapa ativo** por sessao. O mestre troca quando muda de cenario.

### Troca de mapa
- Ao trocar o mapa ativo, os tokens **nao sao reposicionados automaticamente**. O mestre posiciona manualmente cada personagem no novo mapa.

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
  imageUrl   String   @map("image_url") @db.Text
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

### Etapa 2 — Upload de arquivos

Sistema de upload para imagens de mapa e avatares de personagem.

- Usar `multer` para processar multipart/form-data
- Armazenar em `server/uploads/` (maps/, avatars/)
- Servir estaticamente via Express (`/uploads/maps/...`, `/uploads/avatars/...`)
- Rotas:
  - `POST /api/upload/map` — upload de imagem do mapa, retorna URL
  - `POST /api/upload/avatar` — upload de avatar do personagem, retorna URL
- Validacao: apenas imagens (jpg, png, webp), limite de tamanho

**Dependencias**: nenhuma.

---

### Etapa 3 — Rotas REST para GameMap e Token

CRUD basico para gerenciar mapas e tokens (antes de implementar tempo real):

- `GET    /api/maps`              — listar mapas
- `POST   /api/maps`              — criar mapa (nome, imageUrl, gridWidth, gridHeight)
- `GET    /api/maps/:id`          — obter mapa com tokens (include characters)
- `PATCH  /api/maps/:id`          — editar mapa
- `DELETE /api/maps/:id`          — deletar mapa
- `POST   /api/maps/:id/tokens`   — adicionar token (characterId, posX, posY)
- `DELETE /api/tokens/:id`         — remover token do mapa
- `PATCH  /api/tokens/:id`         — atualizar posicao (usado como fallback/persistencia)
- `POST   /api/maps/:id/activate` — ativar mapa (desativa o anterior)

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

- Cada mapa e uma "sala" do Socket.IO (`socket.join(mapId)`)
- Ao receber `grid:move`, persiste no banco via Prisma e emite `grid:moved` para a sala
- Validacoes: token pertence ao mapa, posicao dentro dos limites do grid

**Dependencias**: Etapas 1 e 3.

---

### Etapa 5 — Frontend: Canvas e renderizacao do mapa

#### 5.1 — Componente `GridMap`

- HTML5 `<canvas>` que renderiza:
  1. Imagem de fundo (o mapa)
  2. Linhas do grid por cima
  3. Tokens nas posicoes (imagem do personagem recortada em circulo)
- Props: mapa (dimensoes, imageUrl), tokens (posicoes + imageUrl do character), callbacks

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

- Secao para criar/editar/deletar mapas (nome, upload de imagem, dimensoes do grid)
- Interface para adicionar/remover tokens (selecionar personagem, colocar no mapa)
- Botao para ativar/desativar mapa (apenas um ativo por vez)
- Upload de avatar do personagem (na edicao do personagem, CharacterCard)

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
| `multer` | server | Upload de arquivos |

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

**11. Barra lateral compacta**
Quando o grid estiver expandido e os cards minimizados na barra lateral, quais informacoes resumidas devem aparecer?
- Apenas nome do personagem
- Nome + HP
- Nome + HP + Mana dos pilares

**12. Tamanho padrao do grid**
Mencionei 20x15 como exemplo. Tem alguma preferencia de tamanho, ou quer que seja configuravel na criacao do mapa (dentro de um range, ex: minimo 10x10, maximo 40x30)?

**13. Avatar do personagem**
O upload do avatar seria feito na criacao do personagem (Characters.jsx) ou apenas na edicao (CharacterCard)? Ou em ambos?

**14. Ativacao do mapa**
Quando o mestre ativa um mapa, os outros jogadores devem ser redirecionados automaticamente para o novo mapa (via Socket.IO), ou apenas veem uma notificacao para trocar?

**15. Tokens ao trocar de mapa**
Quando o mestre ativa um mapa novo e posiciona os tokens manualmente, os tokens do mapa anterior devem ser preservados (caso voltem aquele mapa depois) ou removidos?

---

## Riscos e consideracoes

- **Storage de imagens**: arquivos ficam em `server/uploads/`. Em producao no Railway, o filesystem e efemero (reseta no redeploy). Para persistir, sera necessario migrar para um servico externo (S3, Cloudflare R2, etc.) no futuro. Para desenvolvimento e testes iniciais, o filesystem local e suficiente.
- **Performance do canvas**: para grids ate ~40x30 com poucos tokens, a API nativa do canvas e mais que suficiente. Nao precisa de lib tipo Pixi.js ou Konva.
- **Touch em mobile**: Canvas com touch exige cuidado para distinguir pan (arrastar mapa) de drag (mover token). Solucao: toque em token = drag token; toque em area vazia = pan.
- **Reconexao**: Socket.IO tem reconexao automatica embutida. Ao reconectar, o client deve re-entrar na sala e buscar o estado atual do mapa via REST.
- **Deploy (Railway)**: o WebSocket funciona no Railway sem configuracao extra, pois o Socket.IO faz fallback para long-polling se necessario. O storage de arquivos precisara de solucao externa para producao.
