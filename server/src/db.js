import { PrismaClient } from '@prisma/client'

// Instancia unica do Prisma compartilhada por toda a aplicacao.
// Cada `new PrismaClient()` abre seu proprio pool de conexoes; centralizar
// aqui evita multiplicar conexoes ao banco (um pool por modulo importador).
const prisma = new PrismaClient()

export default prisma
