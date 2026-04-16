# Plano de Implementacao — Sistema de Titulos

## Contexto

Adicionar a nocao de **Titulo** ao personagem. Um titulo e um nome curto com uma cor associada (ex: "Lorde do Norte" em vermelho, "Arqueiro Sombrio" em verde). Aparece no card do personagem (PC e inimigo) colorido pelo RGB cadastrado.

O catalogo de titulos e **por aventura**, criado pelo **mestre**, e cada personagem tem **no maximo um** titulo (opcional).

### Escopo incluso
- Novo model `Title` com `nome`, `color` (RGB hex) e `adventureId`
- Relacao 1:N — um `Title` pode ser usado por varios `Character`, um `Character` tem um `Title` (nullable)
- Rotas CRUD `/api/titles` restritas ao mestre da aventura atual
- Dropdown de titulo no formulario de criacao/edicao de Character (PC e inimigo)
- Exibicao do titulo no `CharacterCard`, com a cor aplicada ao texto do label e do valor
- Catalogo isolado por aventura (cascade on delete: deletar Title desvincula dos Characters, nao deleta o Character)

### Fora de escopo
- Multiplos titulos por personagem (tags)
- Icones ou outros estilos alem da cor do texto
- Titulos globais compartilhados entre aventuras
- Reordenacao/sort do catalogo no dropdown (ordem alfabetica ou de criacao basta)

---

## Decisoes de Design

### Modelagem
- `Title`: `id, nome, color, adventureId`. `color` e string `"#RRGGBB"` (7 chars) validada no backend.
- `Character.titleId`: FK nullable. Quando o `Title` e deletado, `titleId` vira `null` no Character (`onDelete: SetNull`).

### Escopo por aventura
- Segue o mesmo padrao de `Character`: todas as rotas de `/api/titles` passam por `adventureMiddleware` e filtram por `req.adventure.id`.
- Um `Character` so pode ser associado a um `Title` da **mesma aventura** — validacao no POST/PATCH de Character.

### Autorizacao
- **Mestre**: CRUD completo em `/api/titles`.
- **Player**: apenas `GET /api/titles` (para poder ver os titulos existentes ao abrir ficha de personagem, se tiver permissao de editar PCs — manter consistencia com o fluxo atual em que PCs sao editaveis por todos).
  - Decisao: player **pode** ler e **pode** atribuir um titulo existente a um PC ao editar (ja que players editam PCs hoje), mas **nao pode** criar/editar/deletar titulos.

### Cor no card
- A cor se aplica ao **label "Titulo:"** e ao **valor** (ex: `Titulo: Lorde do Norte`), ambos em `color: #RRGGBB`.
- Sem background, borda ou outros efeitos — apenas texto.
- Quando o personagem nao tem titulo, nada e renderizado (sem placeholder).

### Validacao de cor
- Regex no backend: `/^#[0-9A-Fa-f]{6}$/`. Rejeita qualquer coisa fora.
- Frontend: `<input type="color">` ja emite `#RRGGBB` naturalmente.

---

## Arquitetura

### Fluxo de autorizacao por rota

| Rota | Middleware | Quem pode |
|---|---|---|
| `GET /api/titles` | `authMiddleware` + `adventureMiddleware` | Qualquer membro |
| `POST /api/titles` | `authMiddleware` + `adventureMiddleware` + check `req.adventureRole === 'master'` | Mestre |
| `PATCH /api/titles/:id` | idem | Mestre |
| `DELETE /api/titles/:id` | idem | Mestre |

### Visibilidade

| Recurso | Player | Mestre |
|---|---|---|
| Titulos (listar) | Sim | Sim |
| Titulos (criar/editar/deletar) | Nao | Sim |
| Titulo em ficha de PC | Ve e pode associar | Ve e pode associar |
| Titulo em ficha de inimigo | Nao ve inimigo | Ve e pode associar |

---

## Etapas de Implementacao

### Etapa 1 — Schema do banco (Prisma)

Adicionar o model `Title` e o FK opcional em `Character`:

```prisma
model Title {
  id          Int        @id @default(autoincrement())
  nome        String
  color       String     // "#RRGGBB"
  adventure   Adventure  @relation(fields: [adventureId], references: [id], onDelete: Cascade)
  adventureId Int        @map("adventure_id")
  characters  Character[]

  @@map("titles")
}

model Character {
  // ...campos existentes
  title       Title?     @relation(fields: [titleId], references: [id], onDelete: SetNull)
  titleId     Int?       @map("title_id")

  @@map("characters")
}
```

Migration: `npx prisma migrate dev --name add_titles`

**Dependencias**: nenhuma.

---

### Etapa 2 — Backend: Rotas `/api/titles`

Criar `server/src/routes/titles.js` exportando um router:

- `GET /` — lista titulos da aventura atual (todos os membros).
- `POST /` — cria titulo (mestre). Body: `{ nome, color }`. Valida cor com regex `/^#[0-9A-Fa-f]{6}$/`.
- `PATCH /:id` — edita titulo (mestre). Valida que o titulo pertence a `req.adventure.id`.
- `DELETE /:id` — deleta titulo (mestre). Prisma com `onDelete: SetNull` cuida da desvinculacao nos Characters.

Helper de autorizacao inline:

```js
if (req.adventureRole !== 'master') {
    return res.status(403).json({ error: 'Acesso restrito ao mestre' })
}
```

Montar no `index.js` **apos** `adventureMiddleware`:

```js
app.use('/api/titles', titlesRouter)
```

**Dependencias**: Etapa 1.

---

### Etapa 3 — Backend: Integracao com Character

Ajustes nas rotas existentes de `/api/characters`:

- `POST /` e `PATCH /:id`: aceitar `titleId` no body (nullable).
  - Se fornecido, validar que `Title.id = titleId` existe e pertence a `req.adventure.id`. Caso contrario, `400`.
- `GET /` e `GET /:id`: `include: { title: true }` para retornar o titulo aninhado.
- `GET /api/adventure/enemies`:
  - **Mestre**: include `title` completo.
  - **Player**: omite `title` (mantem stats ocultos, e o titulo tambem deve ficar escondido).

**Dependencias**: Etapas 1 e 2.

---

### Etapa 4 — Frontend: Servico/Hook de titulos

Criar `client/src/hooks/useTitles.js` (ou inline em paginas, conforme padrao atual):

- Fetch `GET /api/titles` ao montar, cachear em state.
- Expor `titles`, `loading`, `refetch`.

Se o padrao do projeto for buscar inline com `useEffect` + `fetch` em cada pagina, seguir esse padrao em vez de hook novo — alinhar com `Characters.jsx` existente.

**Dependencias**: Etapa 2.

---

### Etapa 5 — Frontend: CRUD de titulos (pagina exclusiva do mestre)

Nova pagina `client/src/pages/Titles.jsx`:

- Lista titulos com preview da cor (ex: swatch circular + nome renderizado na cor).
- Formulario inline para criar: `<input name>`, `<input type="color">`, botao "Criar".
- Acoes por titulo: editar (inline ou modal), deletar (confirmacao).
- Acessivel apenas pelo mestre (rota `/titles`, protegida via `ProtectedRoute masterOnly`).

Navegacao:
- Link "Titulos" no NavBar, visivel apenas quando `isMaster`.

**Dependencias**: Etapas 2 e 4.

---

### Etapa 6 — Frontend: Dropdown de titulo no form de Character

Em `Characters.jsx` (criacao de PC) e `Enemies.jsx` (criacao de inimigo):

- Adicionar `<select name="titleId">` com option "Sem titulo" + lista de titulos da aventura.
- Cada `<option>` mostra o nome (a cor nao e aplicavel em `<option>` de forma confiavel cross-browser — aceitar texto simples no dropdown).
- No submit, enviar `titleId: Number(value) || null`.

Em `CharacterCard.jsx` (edicao inline):
- Mesmo dropdown quando o card esta em modo edicao.

**Dependencias**: Etapas 3 e 4.

---

### Etapa 7 — Frontend: Exibicao do titulo no `CharacterCard`

Renderizar acima/abaixo do nome (definir posicao ao implementar, testar visualmente):

```jsx
{character.title && (
    <div className="character-title" style={{ color: character.title.color }}>
        <span className="character-title-label">Titulo:</span>
        <span className="character-title-value">{character.title.nome}</span>
    </div>
)}
```

CSS minimo para tamanho/espacamento — a cor vem inline do style.

**Dependencias**: Etapa 3.

---

### Etapa 8 — Testes

#### Backend (`server/src/__tests__/routes/titles.test.js`)
- `GET /api/titles` lista titulos da aventura atual (player e mestre).
- `POST /api/titles` cria como mestre; retorna 403 como player; 400 com cor invalida.
- `PATCH /api/titles/:id` edita como mestre; 403 como player; 404 quando pertence a outra aventura.
- `DELETE /api/titles/:id` deleta como mestre; verifica que characters associados ficaram com `titleId = null`.

#### Backend — integracao com characters
- `POST /api/characters` aceita `titleId` valido; 400 quando o titulo e de outra aventura.
- `PATCH /api/characters/:id` desassocia com `titleId: null`.
- `GET /api/characters` retorna `title` aninhado quando existe.
- `GET /api/adventure/enemies` omite `title` na resposta de player.

#### Frontend
- `Titles.test.jsx`: renderiza lista, cria, edita, deleta (mockando fetch).
- `CharacterCard.test.jsx`: adicionar caso — renderiza titulo com a cor certa quando `character.title` existe; nao renderiza quando `null`.
- `Characters.test.jsx` / `Enemies.test.jsx`: dropdown lista titulos, submit inclui `titleId`.

**Dependencias**: Etapas 1-7.

---

## Ordem de Execucao Recomendada

1. Etapa 1 (schema + migration)
2. Etapa 2 (rotas `/api/titles`)
3. Etapa 3 (integracao com Character)
4. Etapas 4-7 em sequencia (frontend)
5. Etapa 8 (testes) intercalada — backend depois da Etapa 3, frontend depois da Etapa 7

---

## Riscos e Observacoes

- **Cor inacessivel**: o mestre pode escolher uma cor com contraste ruim contra o fundo do card. Nao vamos validar — responsabilidade do mestre. Se virar problema, adicionar um helper de contraste depois.
- **Titulos orfaos**: ao deletar um titulo usado, `onDelete: SetNull` limpa `titleId` nos characters. Verificar visualmente que o card some o titulo sem crashar.
- **Migration em producao**: `titleId` e nullable, entao nao precisa de backfill. Seguro.
