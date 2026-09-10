import { PrismaClient } from '@prisma/client'

// Evita múltiplas instâncias do Prisma Client durante o desenvolvimento (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma