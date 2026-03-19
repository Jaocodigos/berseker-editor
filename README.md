# Berserker Editor

Aplicação para gerenciar personagens, pilares, habilidades e mana em sessões de RPG.

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
```

> **Importante:** troque `ADMIN_TOKEN` por um valor secreto forte antes de usar em produção.

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

## Autenticação

### Como funciona

A aplicação usa **HTTP Basic Auth**. Ao acessar qualquer página protegida, o usuário é redirecionado para a tela de login. As credenciais são armazenadas no `localStorage` e enviadas automaticamente em todas as requisições à API.

### Criando o primeiro usuário

O gerenciamento de usuários é feito via API, protegido pelo `ADMIN_TOKEN` definido no `.env`. Use o header `x-admin-token` nas requisições.

**Criar usuário:**
```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -H "x-admin-token: seu-token-secreto-aqui" \
  -d '{"username": "mestre", "password": "senha123"}'
```

**Listar usuários:**
```bash
curl http://localhost:3001/api/users \
  -H "x-admin-token: seu-token-secreto-aqui"
```

**Atualizar usuário:**
```bash
curl -X PATCH http://localhost:3001/api/users/1 \
  -H "Content-Type: application/json" \
  -H "x-admin-token: seu-token-secreto-aqui" \
  -d '{"password": "nova-senha"}'
```

**Deletar usuário:**
```bash
curl -X DELETE http://localhost:3001/api/users/1 \
  -H "x-admin-token: seu-token-secreto-aqui"
```

### Rotas da API

| Método | Rota | Proteção | Descrição |
|--------|------|----------|-----------|
| GET | `/api/health` | Pública | Healthcheck |
| POST | `/api/auth/login` | Pública (valida credenciais) | Login |
| GET | `/api/users` | Admin Token | Listar usuários |
| POST | `/api/users` | Admin Token | Criar usuário |
| PATCH | `/api/users/:id` | Admin Token | Atualizar usuário |
| DELETE | `/api/users/:id` | Admin Token | Deletar usuário |
| GET | `/api/characters` | Basic Auth | Listar personagens |
| POST | `/api/characters` | Basic Auth | Criar personagem |
| PATCH | `/api/characters/:id` | Basic Auth | Atualizar personagem |
| DELETE | `/api/characters/:id` | Basic Auth | Deletar personagem |
| GET | `/api/abilities` | Basic Auth | Listar habilidades |
| POST | `/api/abilities` | Basic Auth | Criar habilidade |
| DELETE | `/api/abilities/:id` | Basic Auth | Deletar habilidade |
| POST | `/api/characters/:id/use-ability` | Basic Auth | Usar habilidade |
| POST | `/api/characters/:id/rest` | Basic Auth | Descanso curto/longo |

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
