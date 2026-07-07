# Berserker Editor

Literalmente usando um pouco do que sei pra melhorar a experiência de jogar RPG com amigos. A intenção é completamente for fun aqui.
Se estiver interessado em contribuir ou aprender mais sobre o jogo, entre em contato!

Basicamente, o app permite:

- Criar personagens (PCs/DMs) e habilidades.
- Criar inimigos (DMs).
- Adicionar inimigos na Aventura.
- Usar habilidades.
- Descansar para recuperar HP e MP.
- Administrar XP e level de personagens e habilidades.

Para experiências online, isso agrega muito pro dinamismo e diversão do grupo, além de evitar que erros de cálculo ocorram 
por parte dos players ou do mestre.

## Tecnologias

- Frontend: React + Vite (`client`)
- Backend: Node.js + Express + Prisma (`server`)
- Banco de dados: MySQL (Docker Compose)

## Pré-requisitos

- Node.js 20+ (recomendado)
- npm
- Docker + Docker Compose

## Como rodar localmente

1. Suba o MySQL com Docker:

```bash
docker compose up -d
```

2. Configure o backend:

```bash
cd server
npm install
```

3. Crie o arquivo `server/.env` com:

```env
DATABASE_URL="mysql://root:secret@localhost:3306/rpg_db"
API_URL="http://localhost:3001 Ou URL do seu backend"
ADMIN_TOKEN="seu-token-secreto-aqui"
# Opcional: diretorio dos arquivos enviados (avatares). Em producao aponte para
# um volume persistente. Se omitido, usa server/uploads (bom para dev local).
# UPLOADS_DIR="/data"
```

> **Importante:** troque `ADMIN_TOKEN` por um valor secreto forte antes de usar em produção.

### Persistência de uploads (produção)

Os arquivos enviados (avatares) são gravados em disco; no banco fica apenas a URL.
Em plataformas com filesystem efêmero (ex.: Railway), esses arquivos somem no
redeploy. Para persistir, monte um **volume** e aponte o app para ele:

1. Crie um Volume no serviço com **mount path** `/data`.
2. Defina a variável de ambiente `UPLOADS_DIR=/data`.

O app cria `/data/avatars` automaticamente no boot e serve tudo em `/uploads`
(as URLs já salvas continuam válidas).

4. Aplique as migrations e gere o client do Prisma:

```bash
npx prisma migrate deploy
npx prisma generate
```

5. Inicie o backend:

```bash
npm run dev
```

Backend disponível em `http://localhost:3001`
Healthcheck: `http://localhost:3001/api/health`

6. Em outro terminal, inicie o frontend:

```bash
cd client
npm install
npm run dev
```

Frontend disponível em `http://localhost:5173`

---

## Autenticacao e Roles

### Como funciona

A aplicacao usa sessoes via cookie httpOnly. Ao acessar qualquer pagina protegida, o usuario e redirecionado para a tela de login.

### Roles: Mestre e Player

Existem dois roles:

- **Player** (default): pode criar e editar personagens, habilidades, e usar todas as funcionalidades da Aventura.
- **Mestre**: tem acesso a tudo que o player tem, mais funcoes exclusivas como criar fichas de inimigos e controla-los na Aventura.

O role e definido pelo admin ao criar ou editar o usuario (campo `role`: `"player"` ou `"master"`).

### Inimigos

- Apenas o mestre pode criar, editar e deletar fichas de inimigos (personagens com `type: "enemy"`).
- Na pagina de Inimigos (`/enemies`), o mestre gerencia as fichas e pode enviar inimigos para a Aventura.
- Na Aventura, inimigos aparecem em uma secao fixa abaixo dos PCs:
  - **Player**: ve apenas o nome do inimigo (stats ocultos, sem interacao).
  - **Mestre**: ve stats completos e pode aplicar dano, usar habilidades, descansar, etc.

### Criando o primeiro usuario

O gerenciamento de usuarios e feito via API, protegido pelo `ADMIN_TOKEN` definido no `.env`. Use o header `Authorization: Bearer <token>` nas requisicoes.

**Criar usuario (player):**
```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-token-secreto-aqui" \
  -d '{"username": "jogador1", "password": "senha123"}'
```

**Criar usuario (mestre):**
```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-token-secreto-aqui" \
  -d '{"username": "mestre", "password": "senha123", "role": "master"}'
```

**Promover usuario existente a mestre:**
```bash
curl -X PATCH http://localhost:3001/api/users/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-token-secreto-aqui" \
  -d '{"role": "master"}'
```

**Listar usuarios:**
```bash
curl http://localhost:3001/api/users \
  -H "Authorization: Bearer seu-token-secreto-aqui"
```

**Deletar usuario:**
```bash
curl -X DELETE http://localhost:3001/api/users/1 \
  -H "Authorization: Bearer seu-token-secreto-aqui"
```

### Rotas da API

| Metodo | Rota | Protecao | Descricao |
|--------|------|----------|-----------|
| GET | `/api/health` | Publica | Healthcheck |
| POST | `/api/auth/login` | Publica | Login (retorna id, username, role) |
| POST | `/api/auth/logout` | Sessao | Logout |
| GET | `/api/auth/me` | Sessao | Usuario da sessao ativa |
| GET | `/api/users` | Bearer Token | Listar usuarios |
| POST | `/api/users` | Bearer Token | Criar usuario (aceita role) |
| PATCH | `/api/users/:id` | Bearer Token | Atualizar usuario |
| DELETE | `/api/users/:id` | Bearer Token | Deletar usuario |
| GET | `/api/characters` | Sessao | Listar personagens (player ve so PCs, mestre ve tudo) |
| GET | `/api/characters/:id` | Sessao | Obter personagem |
| POST | `/api/characters` | Sessao | Criar personagem (type: enemy requer mestre) |
| PATCH | `/api/characters/:id` | Sessao | Atualizar personagem (enemy requer mestre) |
| DELETE | `/api/characters/:id` | Sessao | Deletar personagem (enemy requer mestre) |
| GET | `/api/abilities` | Sessao | Listar habilidades |
| POST | `/api/abilities` | Sessao | Criar habilidade |
| PUT | `/api/abilities/:id` | Sessao | Atualizar habilidade |
| DELETE | `/api/abilities/:id` | Sessao | Deletar habilidade |
| POST | `/api/characters/:id/use-ability` | Sessao | Usar habilidade (enemy requer mestre) |
| POST | `/api/characters/:id/rest` | Sessao | Descanso curto/longo (enemy requer mestre) |
| GET | `/api/adventure/enemies` | Sessao | Inimigos na aventura (mestre: completo, player: so nome) |
| POST | `/api/characters/:id/join-adventure` | Mestre | Colocar inimigo na aventura |
| POST | `/api/characters/:id/leave-adventure` | Mestre | Remover inimigo da aventura |

---

## Comandos úteis

- Parar containers:

```bash
docker compose down
```

- Abrir Prisma Studio:

```bash
cd server
npm run prisma:studio
```
