# Plano de Implementacao — Sistema de Aventuras (Multi-aventura com Isolamento)

## Contexto

Hoje todos os dados de jogo (personagens, inimigos, habilidades) vivem em um espaco global unico. Todos os usuarios logados veem e interagem com os mesmos dados. O campo `role` (player/master) e fixo no modelo `User`.

O objetivo e criar um sistema de aventuras isoladas: cada aventura tem seus proprios personagens, inimigos e habilidades. Usuarios sao atribuidos a aventuras pelo admin — nao escolhem livremente. Um usuario pode participar de mais de uma aventura e ter roles diferentes em cada uma (master em uma, player em outra).

Ja existe uma versao em producao sem esse sistema. A estrategia de migracao (expand-contract) garante que a transicao nao quebre o app em nenhum momento.

### Escopo incluso
- Modelo `Adventure` e `AdventureUser` (juncao usuario-aventura com role)
- Todos os dados de jogo (Character, Pillar, Ability) escopados por `adventureId`
- Admin cria aventuras e atribui usuarios (via `ADMIN_TOKEN`, mesmo padrao atual)
- Role (player/master) definido por aventura, nao por usuario global
- Selecao de aventura no frontend (auto-selecao se o usuario tem apenas uma)
- Estrategia de migracao segura (expand-contract) para producao existente

### Fora de escopo (por enquanto)
- Auto-cadastro em aventuras (usuario escolhe qual entrar)
- Duplicacao/template de aventuras (copiar personagens para nova aventura)
- Compartilhamento de dados entre aventuras
- Configuracoes por aventura (regras customizadas, limites)
- UI de admin para gerenciar aventuras (continua via API + `ADMIN_TOKEN`)

---

## Decisoes de Design

### Role por aventura (nao por usuario)
O campo `role` sai do modelo `User` e vai para `AdventureUser`. Isso permite que um mesmo usuario seja master em uma aventura e player em outra. O `User` passa a conter apenas dados de autenticacao (username, passwordHash).

O fluxo do admin muda de:
1. Criar usuario com role

Para:
1. Criar usuario (sem role)
2. Criar aventura
3. Adicionar usuario a aventura com role

### Atribuicao pelo admin
O admin (via `ADMIN_TOKEN`) cria aventuras e adiciona usuarios. O player nao tem opcao de entrar em uma aventura por conta propria. Se um usuario nao pertence a nenhuma aventura, ve uma tela informativa pedindo para falar com o administrador.

### Contexto de aventura via cookie
Ao selecionar uma aventura, o servidor seta um cookie httpOnly `adventure` com o ID da aventura (mesmo padrao do cookie `session`). Todas as requests subsequentes enviam esse cookie automaticamente — **zero mudancas nos fetch calls existentes** do frontend.

O cookie e setado via `POST /api/adventures/:id/select` (rota protegida por auth).

### Isolamento de dados
Todas as queries de dados de jogo filtram por `adventureId`. Um usuario da aventura A **nunca** ve personagens, inimigos ou habilidades da aventura B — nem via API. Rotas que recebem IDs de recursos (ex: `PATCH /api/characters/:id`) validam que o recurso pertence a aventura atual.

### Ordenacao de middlewares

```
Rotas publicas (/api/auth, /api/health)
    |
Rotas admin (/api/users, /api/adventures) — protegidas por ADMIN_TOKEN
    |
Frontend estatico
    |
authMiddleware — tudo abaixo requer sessao
    |
Selecao de aventura (/api/adventures/:id/select) — requer auth, NAO requer aventura
    |
adventureMiddleware — tudo abaixo requer aventura selecionada
    |
Rotas de jogo (/api/characters, /api/abilities, etc.)
```

### Migracao expand-contract
Para nao quebrar a versao em producao:
1. **Expand**: adicionar tabelas e colunas novas (nullable), sem remover nada — deploy seguro
2. **Backfill**: popular dados existentes na aventura padrao — script unico
3. **Contract**: tornar campos obrigatorios, remover `User.role` — deploy final

Cada fase e um deploy independente. Se algo der errado, o rollback e trivial (reverter o codigo).

---

## Etapas de Implementacao

### Etapa 1 — Schema: Fase Expand (Prisma)

Novos modelos:

```prisma
model Adventure {
  id         Int             @id @default(autoincrement())
  nome       String
  createdAt  DateTime        @default(now()) @map("created_at")
  users      AdventureUser[]
  characters Character[]

  @@map("adventures")
}

model AdventureUser {
  id          Int       @id @default(autoincrement())
  role        String    @default("player") // "player" | "master"
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      Int       @map("user_id")
  adventure   Adventure @relation(fields: [adventureId], references: [id], onDelete: Cascade)
  adventureId Int       @map("adventure_id")

  @@unique([userId, adventureId])
  @@map("adventure_users")
}
```

Alteracoes em modelos existentes:

```prisma
model User {
  id           Int             @id @default(autoincrement())
  username     String          @unique
  passwordHash String          @map("password_hash")
  role         String          @default("player")  // MANTIDO temporariamente
  createdAt    DateTime        @default(now()) @map("created_at")
  sessions     Session[]
  adventures   AdventureUser[]                      // NOVO

  @@map("users")
}

model Character {
  id          Int        @id @default(autoincrement())
  nome        String
  type        String     @default("player_character")
  inAdventure Boolean    @default(false) @map("in_adventure")
  maxHp       Int        @default(0) @map("max_hp")
  actualHp    Int        @default(0) @map("actual_hp")
  xp          Int        @default(0)
  level       Int        @default(1)
  pillarXp    Int        @default(0) @map("pillar_xp")
  pillarLevel Int        @default(1) @map("pillar_level")
  pillars     Pillar[]
  adventure   Adventure? @relation(fields: [adventureId], references: [id], onDelete: Cascade)
  adventureId Int?       @map("adventure_id")  // NULLABLE nesta fase

  @@map("characters")
}
```

Migration: `npx prisma migrate dev --name add_adventure_system`

**Nota**: `User.role` e mantido. `Character.adventureId` e nullable. A aplicacao existente continua funcionando sem nenhuma alteracao de codigo.

**Dependencias**: nenhuma.

---

### Etapa 2 — Script de Backfill

Criar `server/prisma/backfill-adventures.js`:

```js
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function backfill() {
  // 1. Criar aventura padrao (idempotente)
  let adventure = await prisma.adventure.findFirst({ where: { nome: 'main' } })
  if (!adventure) {
    adventure = await prisma.adventure.create({ data: { nome: 'main' } })
    console.log(`Aventura criada: id=${adventure.id}`)
  } else {
    console.log(`Aventura ja existe: id=${adventure.id}`)
  }

  // 2. Para cada usuario, criar AdventureUser com o role atual
  const users = await prisma.user.findMany()
  for (const user of users) {
    const exists = await prisma.adventureUser.findUnique({
      where: { userId_adventureId: { userId: user.id, adventureId: adventure.id } }
    })
    if (!exists) {
      await prisma.adventureUser.create({
        data: { userId: user.id, adventureId: adventure.id, role: user.role }
      })
      console.log(`User ${user.username} -> aventura (role: ${user.role})`)
    }
  }

  // 3. Setar adventureId em todos os characters sem aventura
  const updated = await prisma.character.updateMany({
    where: { adventureId: null },
    data: { adventureId: adventure.id }
  })
  console.log(`${updated.count} characters atualizados`)
}

backfill()
  .then(() => console.log('Backfill concluido'))
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Executar em producao: `node server/prisma/backfill-adventures.js`

Verificacao pos-backfill (queries diretas no banco):
```sql
-- Deve retornar 0
SELECT COUNT(*) FROM characters WHERE adventure_id IS NULL;

-- Deve ser igual ao total de users
SELECT COUNT(*) FROM adventure_users;
SELECT COUNT(*) FROM users;
```

O script e **idempotente** — pode ser executado novamente sem efeitos colaterais.

**Dependencias**: Etapa 1.

---

### Etapa 3 — Schema: Fase Contract (Prisma)

Apos confirmar que o backfill foi executado e verificado em producao:

```prisma
model Character {
  // adventureId agora e obrigatorio
  adventure   Adventure @relation(fields: [adventureId], references: [id], onDelete: Cascade)
  adventureId Int       @map("adventure_id")  // Int, nao Int?
  // ... demais campos inalterados
}

model User {
  id           Int             @id @default(autoincrement())
  username     String          @unique
  passwordHash String          @map("password_hash")
  // role REMOVIDO — agora vive em AdventureUser
  createdAt    DateTime        @default(now()) @map("created_at")
  sessions     Session[]
  adventures   AdventureUser[]

  @@map("users")
}
```

Migration: `npx prisma migrate dev --name make_adventure_required_remove_user_role`

**Importante**: so executar esta migration apos confirmar que nao ha characters com `adventure_id = NULL` em producao.

**Dependencias**: Etapa 2 (backfill executado e verificado).

---

### Etapa 4 — Backend: CRUD de Aventuras e Memberships (Admin)

Novo router `server/src/routes/adventures.js`, protegido por `adminAuth` (mesmo padrao de `/api/users`):

#### 4.1 — CRUD de aventuras

```
GET    /api/adventures              — listar aventuras (com contagem de usuarios)
POST   /api/adventures              — criar aventura { nome }
PATCH  /api/adventures/:id          — editar aventura { nome }
DELETE /api/adventures/:id          — deletar aventura (cascade: characters, memberships)
```

#### 4.2 — Gerenciamento de memberships

```
GET    /api/adventures/:id/users              — listar usuarios da aventura (com role)
POST   /api/adventures/:id/users              — adicionar usuario { userId, role }
PATCH  /api/adventures/:id/users/:userId      — alterar role { role }
DELETE /api/adventures/:id/users/:userId       — remover usuario da aventura
```

Validacoes:
- `role` deve ser `"player"` ou `"master"`
- Nao permitir adicionar o mesmo usuario duas vezes (constraint `@@unique`)
- Ao deletar aventura, confirmar que o cascade remove characters e memberships

#### 4.3 — Atualizar rotas de usuarios

`server/src/routes/users.js`:
- `POST /api/users` — nao aceita mais `role` no body (usuario criado sem role global)
- `PATCH /api/users/:id` — nao aceita mais `role` (alterado via adventure membership)
- `GET /api/users` — nao retorna mais `role` (retorna lista de aventuras opcionalmente)

#### 4.4 — Registrar no index.js

```js
import adventuresRouter from './routes/adventures.js'
app.use('/api/adventures', adventuresRouter)
```

Posicionar junto com `/api/users` (ambos usam `adminAuth`).

**Dependencias**: Etapa 1.

---

### Etapa 5 — Backend: Selecao de aventura e middleware

#### 5.1 — Endpoint de selecao

Rotas protegidas por auth (nao admin), posicionadas **apos** `authMiddleware` e **antes** de `adventureMiddleware`:

`POST /api/adventures/:id/select`
- Valida que o usuario pertence a aventura (busca em `AdventureUser`)
- Seta cookie `adventure` com o ID (httpOnly, sameSite, secure em prod)
- Retorna dados da aventura e role do usuario

```js
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

// No handler:
res.cookie('adventure', String(adventureId), { ...cookieOptions, maxAge: 24 * 60 * 60 * 1000 })
res.json({ adventure: { id, nome }, role: membership.role })
```

`POST /api/adventures/deselect`
- Limpa o cookie `adventure`
- Retorna 204

#### 5.2 — Atualizar `/api/auth/me`

Modificar `server/src/routes/auth.js` para retornar as aventuras do usuario e a aventura atual (do cookie):

```js
// GET /api/auth/me
const adventures = await prisma.adventureUser.findMany({
  where: { userId: req.user.id },
  include: { adventure: true }
})

const adventureId = Number(req.cookies?.adventure)
let currentAdventure = null
if (adventureId) {
  const membership = adventures.find(a => a.adventureId === adventureId)
  if (membership) {
    currentAdventure = { id: membership.adventure.id, nome: membership.adventure.nome, role: membership.role }
  }
}

res.json({
  id: req.user.id,
  username: req.user.username,
  adventures: adventures.map(a => ({ id: a.adventure.id, nome: a.adventure.nome, role: a.role })),
  currentAdventure
})
```

#### 5.3 — Adventure middleware

Criar `server/src/middleware/adventure.js`:

```js
async function adventureMiddleware(req, res, next) {
  const adventureId = Number(req.cookies?.adventure)

  if (!adventureId) {
    return res.status(400).json({ error: 'Nenhuma aventura selecionada' })
  }

  const membership = await prisma.adventureUser.findUnique({
    where: { userId_adventureId: { userId: req.user.id, adventureId } },
    include: { adventure: true }
  })

  if (!membership) {
    return res.status(403).json({ error: 'Voce nao pertence a esta aventura' })
  }

  req.adventure = membership.adventure
  req.adventureRole = membership.role
  next()
}
```

Aplicar no `index.js` apos `authMiddleware` e apos as rotas de selecao:

```js
app.use(authMiddleware)

// Rotas que precisam de auth mas NAO de aventura
app.post('/api/adventures/:id/select', selectAdventureHandler)
app.post('/api/adventures/deselect', deselectAdventureHandler)

app.use(adventureMiddleware)

// Rotas de jogo (precisam de auth + aventura)
app.get('/api/characters', ...)
```

#### 5.4 — Atualizar masterOnly

`server/src/middleware/masterOnly.js`:

```js
function masterOnly(req, res, next) {
  if (req.adventureRole !== 'master') {
    return res.status(403).json({ error: 'Acesso restrito ao mestre' })
  }
  next()
}
```

**Dependencias**: Etapas 3 e 4.

---

### Etapa 6 — Backend: Escopar rotas existentes por aventura

Todas as rotas de dados de jogo passam a filtrar por `req.adventure.id`.

#### 6.1 — Characters

```js
// GET /api/characters
const list = await prisma.character.findMany({
  where: { ...where, adventureId: req.adventure.id },
  include: { pillars: { include: { abilities: true } } }
})

// POST /api/characters
const created = await prisma.character.create({
  data: { ...data, adventureId: req.adventure.id, ... }
})

// GET/PATCH/DELETE /api/characters/:id
const char = await prisma.character.findUnique({ where: { id } })
if (!char || char.adventureId !== req.adventure.id) {
  return res.status(404).json({ error: 'Personagem nao encontrado' })
}
```

#### 6.2 — Abilities

```js
// GET /api/abilities — filtrar via relacao pillar -> character -> adventureId
const list = await prisma.ability.findMany({
  where: { pillar: { character: { adventureId: req.adventure.id } } },
  include: { pillar: true }
})

// POST /api/abilities — validar que o pillar pertence a um character da aventura
const pillar = await prisma.pillar.findUnique({
  where: { id: pillarId },
  include: { character: true }
})
if (!pillar || pillar.character.adventureId !== req.adventure.id) {
  return res.status(404).json({ error: 'Pilar nao encontrado' })
}

// PUT/DELETE /api/abilities/:abilityId — mesma validacao via pillar -> character
```

#### 6.3 — Pillars

```js
// PATCH/DELETE /api/pillars/:id — validar via character.adventureId
const pillar = await prisma.pillar.findUnique({
  where: { id },
  include: { character: true }
})
if (!pillar || pillar.character.adventureId !== req.adventure.id) {
  return res.status(404).json({ error: 'Pilar nao encontrado' })
}

// POST /api/characters/:id/pillars — character ja validado em 6.1
```

#### 6.4 — Adventure enemies

```js
// GET /api/adventure/enemies
where: { type: 'enemy', inAdventure: true, adventureId: req.adventure.id }

// POST /api/characters/:id/join-adventure e leave-adventure
// Validar character.adventureId === req.adventure.id
```

#### 6.5 — use-ability e rest

```js
// POST /api/characters/:id/use-ability
// POST /api/characters/:id/rest
// Adicionar validacao: character.adventureId === req.adventure.id
```

#### 6.6 — Dice rolls

```js
// GET /api/adventure/dice-rolls?characterIds=1,2,3
// Opcional: validar que os characterIds pertencem a aventura atual
// Na pratica, o isolamento de characters ja garante que o frontend
// so conhece IDs da aventura atual, mas a validacao adicional e mais segura
```

**Dependencias**: Etapa 5.

---

### Etapa 7 — Frontend: AdventureContext e selecao

#### 7.1 — AdventureContext

Criar `client/src/context/AdventureContext.jsx`:

```jsx
// State:
// - adventures: lista de aventuras do usuario (vindo de /api/auth/me)
// - currentAdventure: { id, nome, role } | null
//
// Ao carregar:
// - Le de /api/auth/me (que agora retorna adventures + currentAdventure)
// - Se currentAdventure vem preenchido (cookie valido), usa direto
// - Se nao, e so tem 1 aventura, chama POST /api/adventures/:id/select
// - Se nao, redireciona para /select-adventure
//
// Funcoes expostas:
// - selectAdventure(id) -> POST /api/adventures/:id/select -> atualiza state
// - deselectAdventure() -> POST /api/adventures/deselect -> limpa state
// - isMaster (derivado de currentAdventure.role === 'master')
```

Wrapper no `App.jsx`:

```jsx
<AuthProvider>
  <AdventureProvider>
    <Router>...</Router>
  </AdventureProvider>
</AuthProvider>
```

#### 7.2 — Tela de selecao de aventura

Nova pagina `client/src/pages/AdventureSelect.jsx`:

- Lista as aventuras do usuario (nome + badge com role)
- Click em uma aventura chama `selectAdventure(id)` e redireciona para Home
- Se o usuario tem 0 aventuras: mensagem "Voce ainda nao foi adicionado a nenhuma aventura. Fale com o administrador."

#### 7.3 — Logica de auto-selecao

No `AdventureContext`, ao carregar (apos `/api/auth/me`):

```
currentAdventure preenchido? (cookie valido)
  SIM → usar diretamente, nenhuma acao
  NAO →
    usuario tem 1 aventura?
      SIM → auto-selecionar (POST /select), setar state
      NAO (N aventuras) → redirecionar para /select-adventure
      NAO (0 aventuras) → redirecionar para /no-adventure
```

#### 7.4 — Migrar isMaster

- Remover `isMaster` do `AuthContext`
- Expor via `useAdventure().isMaster`
- Atualizar todos os componentes que usam `isMaster`:
  - `NavBar` (App.jsx)
  - `ProtectedRoute`
  - `Adventure.jsx`
  - `Enemies.jsx`

**Dependencias**: Etapa 6.

---

### Etapa 8 — Frontend: Atualizar paginas e rotas

#### 8.1 — ProtectedRoute

Adicionar verificacao de aventura selecionada. Se nao ha aventura e a rota exige, redireciona para `/select-adventure`:

```jsx
export default function ProtectedRoute({ children, masterOnly = false, requireAdventure = true }) {
  const { credentials, loading } = useAuth()
  const { currentAdventure, isMaster, loading: advLoading } = useAdventure()

  if (loading || advLoading) return null
  if (!credentials) return <Navigate to="/login" replace />
  if (requireAdventure && !currentAdventure) return <Navigate to="/select-adventure" replace />
  if (masterOnly && !isMaster) return <Navigate to="/" replace />

  return children
}
```

#### 8.2 — NavBar

- `isMaster` vem de `useAdventure()` em vez de `useAuth()`
- Exibir nome da aventura atual ao lado do brand (texto pequeno)
- Link sempre visivel para trocar de aventura (redireciona para `/select-adventure`)

```jsx
const { currentAdventure, isMaster } = useAdventure()

// Na nav:
{currentAdventure && (
  <NavLink to="/select-adventure" className="rpg-nav-adventure">{currentAdventure.nome}</NavLink>
)}
```

#### 8.3 — App.jsx (novas rotas)

```jsx
import AdventureSelect from './pages/AdventureSelect'

// Novas rotas (nao exigem aventura selecionada):
<Route path="/select-adventure" element={
  <ProtectedRoute requireAdventure={false}><AdventureSelect /></ProtectedRoute>
} />

// Rotas existentes continuam iguais — ProtectedRoute agora valida aventura por padrao
```

#### 8.4 — Paginas de dados

**Nenhuma mudanca nos fetch calls** — o cookie `adventure` e enviado automaticamente pelo browser em todas as requests.

Unica alteracao necessaria: trocar `useAuth().isMaster` por `useAdventure().isMaster` nos componentes que usam:
- `Adventure.jsx`
- `Enemies.jsx`
- `CharacterCard.jsx` (se aplicavel)

#### 8.5 — AuthContext

Simplificar — remover `isMaster` e `role`:

```jsx
// Antes:
const isMaster = credentials?.role === 'master'

// Depois: remover (agora vive em AdventureContext)
```

O `/api/auth/me` agora retorna `adventures` em vez de `role`. Armazenar em `credentials` para que o `AdventureContext` consuma.

**Dependencias**: Etapa 7.

---

### Etapa 9 — Testes

#### Server

- **Backfill**: script cria aventura padrao, atribui usuarios com role correto, seta adventureId em characters
- **CRUD de aventuras**: criar, editar, deletar, gerenciar memberships, validacoes (role invalido, usuario duplicado)
- **Adventure middleware**: valida cookie, valida membership, rejeita se sem cookie, rejeita se nao pertence
- **Isolamento**: usuario da aventura A chama `GET /api/characters` e nao recebe dados da aventura B
- **masterOnly atualizado**: usa `req.adventureRole` em vez de `req.user.role`
- **Selecao de aventura**: seta cookie, retorna dados corretos
- **`/api/auth/me`**: retorna lista de aventuras e currentAdventure
- **Rotas de jogo com adventureId**: characters, abilities, pillars, adventure enemies — todos filtrados

#### Client

- **AdventureContext**: carregamento com 0/1/N aventuras, auto-selecao, selecao manual
- **AdventureSelect**: renderizacao da lista, click seleciona, mensagem quando 0 aventuras
- **ProtectedRoute**: redireciona para `/select-adventure` quando `requireAdventure=true` e nao ha aventura
- **NavBar**: exibe nome da aventura, link para trocar quando multiplas
- **Paginas existentes**: funcionam com adventure context mockado, `isMaster` vem do contexto correto

**Dependencias**: todas as etapas anteriores.

---

## Dependencias externas (pacotes novos)

Nenhuma. Todas as alteracoes usam pacotes ja existentes.

---

## Ordem sugerida de execucao

```
Etapa 1 (Schema Expand) ──────── Deploy 1 (seguro, apenas adiciona)
    |
    v
Etapa 2 (Script Backfill) ────── Rodar em producao (idempotente)
    |
    v
Etapa 3 (Schema Contract) ────── Deploy 2 (apos verificar backfill)
    |
    v
Etapa 4 (CRUD Aventuras — Admin)
    |
    v
Etapa 5 (Middleware + selecao + auth/me)
    |
    v
Etapa 6 (Escopar rotas de jogo)
    |
    v
Etapa 7 (Frontend: AdventureContext + selecao) ─┐
    |                                            |  podem ser feitas
    v                                            |  em paralelo
Etapa 8 (Frontend: atualizar paginas) ──────────-┘
    |
    v
Etapa 9 (Testes)
```

- **Etapas 1-3**: migracao segura — cada uma e um deploy independente
- **Etapas 4-6**: backend puro
- **Etapas 7-8**: frontend puro, podem comecar em paralelo apos Etapa 6

---

## Perguntas pendentes

Nenhuma — todas as questoes foram respondidas.

---

## Riscos e consideracoes

- **Performance do middleware**: o adventure middleware faz uma query ao banco (`adventureUser.findUnique`) em toda request protegida. Para o volume atual (poucos jogadores por mesa), e insignificante. Se escalar, pode-se cachear a membership em memoria com TTL curto.
- **Cookie `adventure`**: segue o mesmo padrao de seguranca do cookie `session` (httpOnly, sameSite, secure em producao). Contem apenas o ID numerico da aventura — nenhum dado sensivel.
- **Backfill em producao**: o script e idempotente e pode ser rodado novamente sem efeitos colaterais. Recomenda-se executar em horario de baixo uso por precaucao.
- **Rollback apos Fase Expand**: trivial — reverter o codigo. Tabelas novas existem mas nao sao usadas.
- **Rollback apos Fase Contract**: mais complexo — requer re-adicionar a coluna `role` no `User` e re-popular. Recomenda-se validar tudo antes de executar a Fase Contract.
- **Dice rolls em memoria**: o Map e indexado por `characterId` (globalmente unico). O isolamento de characters por aventura ja garante que IDs de outra aventura nao sao acessiveis pelo frontend.
- **Futuros sistemas (Grid, etc.)**: o grid-system-plan adiciona `GameMap` e `Token`. Quando implementados, tambem precisarao de `adventureId`. A estrutura criada aqui e extensivel para isso.
- **Rotas de `/api/users` (admin)**: ao remover `role` do `User`, as rotas de listagem/criacao de usuario nao retornam mais `role`. O admin precisa consultar as memberships da aventura para ver roles. Isso e uma mudanca no workflow do admin.
