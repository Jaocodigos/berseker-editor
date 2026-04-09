# Plano de Implementacao — Sistema de Roles (Mestre & Player)

## Contexto

Separar as funcionalidades entre **Mestre** e **Player**. Tudo que existe atualmente continua acessivel ao player. O mestre ganha funcoes exclusivas, comecando por criar e controlar fichas de inimigos.

### Escopo incluso
- Campo `role` no User (`player` ou `master`), definido pelo admin via ADMIN_TOKEN
- Campo `type` no Character (`player_character` ou `enemy`)
- Mestre pode criar fichas de inimigo (reusa o modelo Character)
- Inimigos so sao visiveis na listagem para o mestre
- Mestre pode colocar inimigos na Aventura — aparecem em secao fixa para todos
- Players veem os inimigos na Aventura mas com stats ocultos (HP, mana, habilidades escondidos)
- Apenas o mestre pode interagir com inimigos na Aventura (dano, habilidade, descanso, XP)
- Personagens continuam sem dono (todos veem e editam todos os PCs)

### Fora de escopo (por enquanto)
- Ownership de personagens (vincular PC ao player que criou)
- Permissoes granulares por acao (ex: player X so edita personagem Y)
- Mais de um mestre por mesa
- Funcoes exclusivas do mestre alem de inimigos (controle de aventura, etc)

---

## Decisoes de Design

### Atribuicao de role
- O admin (via `ADMIN_TOKEN`) define o `role` ao criar ou editar um usuario na rota `/api/users`.
- Default e `player`. O admin seta `role: "master"` explicitamente.
- Nenhuma tela de auto-registro de mestre.

### Inimigos como Character
- Inimigos usam o mesmo modelo `Character` com um campo `type`.
- `type = "player_character"` (default) — personagem normal, visivel a todos.
- `type = "enemy"` — ficha de inimigo, visivel apenas ao mestre.
- Reusa toda a logica existente de pilares, habilidades, HP, mana, XP.
- No futuro, campos especificos de inimigo (CR, loot) podem ser adicionados sem quebrar o modelo.

### Inimigos na Aventura
- O mestre "coloca" um inimigo na Aventura via um flag `inAdventure` no Character.
- Quando ativado, o inimigo aparece em uma **secao fixa** no topo/destaque da pagina de Aventura para todos os jogadores conectados.
- **Para o player**: ve apenas o nome do inimigo. Stats (HP, mana, pilares, habilidades) ficam ocultos. Nenhum botao de interacao.
- **Para o mestre**: ve stats completos e pode interagir normalmente (aplicar dano, usar habilidade, descansar, dar XP, remover da aventura).
- Quando o mestre remove o inimigo da aventura (`inAdventure = false`), ele some da secao fixa.

### Personagens (PCs)
- Sem mudancas. Continuam sem dono, visiveis e editaveis por todos (players e mestre).

---

## Arquitetura

### Fluxo de autorizacao

```
Request
  |
  v
authMiddleware (valida sessao, seta req.user com id, username, role)
  |
  v
Rota normal (player e master)  OU  masterOnly middleware (403 se nao for master)
```

### Visibilidade de dados

| Recurso | Player | Mestre |
|---|---|---|
| Characters (type=player_character) | Ve e edita todos | Ve e edita todos |
| Characters (type=enemy) | Nao ve na listagem | Ve, cria, edita, deleta |
| Inimigos na Aventura | Ve nome (stats ocultos) | Ve tudo, interage |
| Paginas de navegacao | Home, Personagens, Aventura | Home, Personagens, Aventura, **Inimigos** |

---

## Etapas de Implementacao

### Etapa 1 — Schema do banco (Prisma)

Alteracoes no modelo `User`:

```prisma
model User {
  id           Int       @id @default(autoincrement())
  username     String    @unique
  passwordHash String    @map("password_hash")
  role         String    @default("player")  // "player" | "master"
  createdAt    DateTime  @default(now()) @map("created_at")
  sessions     Session[]

  @@map("users")
}
```

Alteracoes no modelo `Character`:

```prisma
model Character {
  id          Int      @id @default(autoincrement())
  nome        String
  type        String   @default("player_character")  // "player_character" | "enemy"
  inAdventure Boolean  @default(false) @map("in_adventure")
  maxHp       Int      @default(0) @map("max_hp")
  actualHp    Int      @default(0) @map("actual_hp")
  xp          Int      @default(0)
  level       Int      @default(1)
  pillarXp    Int      @default(0) @map("pillar_xp")
  pillarLevel Int      @default(1) @map("pillar_level")
  pillars     Pillar[]

  @@map("characters")
}
```

Migration: `npx prisma migrate dev --name add_roles_and_enemy_type`

**Dependencias**: nenhuma.

---

### Etapa 2 — Backend: Middleware e Auth

#### 2.1 — Incluir `role` no auth middleware

`server/src/middleware/auth.js` — ao montar `req.user`, incluir o `role`:

```js
req.user = { id: session.user.id, username: session.user.username, role: session.user.role }
```

#### 2.2 — Novo middleware `masterOnly`

`server/src/middleware/masterOnly.js`:

```js
function masterOnly(req, res, next) {
    if (req.user?.role !== 'master') {
        return res.status(403).json({ error: 'Acesso restrito ao mestre' })
    }
    next()
}
```

Usado nas rotas que so o mestre pode acessar.

#### 2.3 — Atualizar rota `/api/auth/me`

Retornar `role` junto com `id` e `username`:

```js
res.json({ id: req.user.id, username: req.user.username, role: req.user.role })
```

#### 2.4 — Atualizar rotas `/api/users`

Aceitar `role` no POST (criar) e PATCH (editar). Validar que o valor e `"player"` ou `"master"`.

**Dependencias**: Etapa 1.

---

### Etapa 3 — Backend: Rotas de Characters com filtro por tipo

#### 3.1 — `GET /api/characters`

Filtrar por `type` com base no role do usuario:

- **Player**: retorna apenas `where: { type: "player_character" }`
- **Mestre**: retorna todos (ou aceita query param `?type=enemy` para filtrar)

#### 3.2 — `POST /api/characters`

Aceitar campo `type` no body. Se `type = "enemy"`, exigir que o usuario seja mestre (usar `masterOnly` ou checar inline).

#### 3.3 — `PATCH /api/characters/:id` e `DELETE /api/characters/:id`

Se o character e do tipo `enemy`, exigir que o usuario seja mestre.

#### 3.4 — Novas rotas para inimigos na aventura

- `POST /api/characters/:id/join-adventure` — mestre coloca inimigo na aventura (`inAdventure = true`). Valida que o character e do tipo `enemy` e que o usuario e mestre.
- `POST /api/characters/:id/leave-adventure` — mestre remove inimigo da aventura (`inAdventure = false`).
- `GET /api/adventure/enemies` — retorna inimigos ativos na aventura.
  - **Mestre**: retorna dados completos (include pillars, abilities).
  - **Player**: retorna apenas `id` e `nome` (stats ocultos).

**Dependencias**: Etapas 1 e 2.

---

### Etapa 4 — Frontend: AuthContext com role

#### 4.1 — Armazenar role no state

`AuthContext.jsx` — o `/api/auth/me` ja retornara `role`. Armazenar no state `credentials`:

```js
// credentials = { id, username, role }
```

#### 4.2 — Helper `isMaster`

Expor no contexto:

```js
const isMaster = credentials?.role === 'master'
```

Disponivel via `useAuth()` em qualquer componente.

**Dependencias**: Etapa 2.

---

### Etapa 5 — Frontend: Pagina de Inimigos (exclusiva do mestre)

#### 5.1 — Nova pagina `Enemies.jsx`

- Acessivel apenas pelo mestre (rota `/enemies`).
- Lista fichas de inimigos (`GET /api/characters?type=enemy`).
- Formulario de criacao reusa a mesma estrutura de `Characters.jsx` (nome, HP, pilares, etc), mas envia `type: "enemy"`.
- Cada ficha tem botoes: editar, deletar, **"Enviar para Aventura"** / **"Remover da Aventura"** (toggle `inAdventure`).
- Reusa `CharacterCard` com prop `isEnemy` para ajustes visuais (cor diferente, badge "Inimigo").

#### 5.2 — Navegacao

- Adicionar link "Inimigos" na `NavBar`, visivel apenas se `isMaster`.
- Rota `/enemies` protegida: redireciona player para Home.

#### 5.3 — Rota protegida por role

Criar componente `MasterRoute` (ou prop em `ProtectedRoute`):

```jsx
<Route path="/enemies" element={
    <ProtectedRoute masterOnly>
        <Enemies />
    </ProtectedRoute>
} />
```

**Dependencias**: Etapas 3 e 4.

---

### Etapa 6 — Frontend: Aventura com secao de inimigos

#### 6.1 — Secao fixa "Inimigos"

**Abaixo** dos cards de PCs na pagina de Aventura, adicionar secao "Inimigos na mesa":

- Busca `GET /api/adventure/enemies` ao carregar a pagina.
- Sem limite de inimigos simultaneos — o mestre coloca quantos quiser.
- **Visao do player**: cards simplificados mostrando apenas o nome do inimigo. Sem stats, sem botoes de acao. Visual diferenciado (borda vermelha, badge "Inimigo").
- **Visao do mestre**: cards completos com HP, mana, pilares, e todos os botoes de acao (Receber Dano, Usar Habilidade, Descansar, +XP). Botao "Remover da Aventura".

#### 6.2 — Polling de inimigos com destaque

Reutilizar o mesmo padrao de polling (setInterval 10s) ja usado para atualizar os PCs. Incluir fetch dos inimigos na aventura.

Quando um inimigo novo aparece (nao existia no state anterior), exibir com **animacao de entrada / highlight** para chamar atencao do player (ex: flash na borda, fade-in com escala, ou pulse). O destaque desaparece apos ~2 segundos.

#### 6.3 — Visual diferenciado

Inimigos na aventura devem ter estilo distinto dos PCs:
- Borda ou fundo em tom vermelho/escuro
- Badge ou icone indicando "Inimigo"
- Para players: card compacto (so nome), sem interacao

**Dependencias**: Etapas 3, 4 e 5.

---

### Etapa 7 — Testes

#### Server
- Testes do middleware `masterOnly` — retorna 403 para player, passa para master
- Testes das rotas de characters filtradas por role/type
- Testes das rotas de aventura (join/leave-adventure, GET enemies)
- Testes de criacao de usuario com role
- Testes de `/api/auth/me` retornando role

#### Client
- Testes do `AuthContext` com role
- Testes do `ProtectedRoute` com `masterOnly`
- Testes da pagina `Enemies` (renderizacao, criacao, toggle aventura)
- Testes da `Adventure` com secao de inimigos (visao player vs mestre)

**Dependencias**: todas as etapas anteriores.

---

## Dependencias externas (pacotes novos)

Nenhuma. Todas as alteracoes usam pacotes ja existentes.

---

## Ordem sugerida de execucao

```
Etapa 1 (Schema — role + type + inAdventure)
    |
    v
Etapa 2 (Middleware masterOnly + auth com role)
    |
    v
Etapa 3 (Rotas: filtro por tipo, CRUD enemy, adventure enemies)
    |
    v
Etapa 4 (Frontend: AuthContext com role)
    |
    v
Etapa 5 (Pagina de Inimigos — mestre)  ←  pode comecar em paralelo com Etapa 6
    |
    v
Etapa 6 (Aventura: secao fixa de inimigos)
    |
    v
Etapa 7 (Testes)
```

As etapas 1-3 sao backend puro.
As etapas 5 e 6 podem ser feitas em paralelo apos a etapa 4.

---

## Perguntas pendentes

Nenhuma — todas as questoes foram respondidas.

---

## Riscos e consideracoes

- **Migracao de usuarios existentes**: usuarios ja criados terao `role = "player"` por default. O admin precisa manualmente promover o mestre via `/api/users/:id` com `ADMIN_TOKEN`.
- **Sem ownership de PCs**: como PCs nao tem dono, qualquer usuario (player ou master) pode editar qualquer PC. Isso e intencional nesta versao, mas pode causar confusao se houver muitos jogadores.
- **Polling vs WebSocket**: a secao de inimigos na aventura usa polling (10s). Para uma experiencia mais fluida (inimigo aparece instantaneamente quando o mestre coloca), seria ideal usar WebSocket — mas isso pode ser migrado na etapa do grid system que ja planeja Socket.IO.
- **Escalabilidade de roles**: o campo `role` e uma String, nao um enum do banco. Isso permite adicionar novos roles no futuro (ex: `"spectator"`) sem migration. A validacao e feita na aplicacao.
