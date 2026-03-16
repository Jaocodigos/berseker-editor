# Berserker Editor

Aplicação para gerenciar personagens, pilares, habilidades e mana.

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
```

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
