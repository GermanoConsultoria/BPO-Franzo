import { cache } from 'react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * Busca o usuário logado (com equipes e permissões). Envolvido em cache()
 * para deduplicar por requisição: layout, página e server actions que rodam
 * na mesma renderização reaproveitam a mesma consulta em vez de repeti-la.
 */
export const getUsuarioLogado = cache(async () => {
  const session = await auth()
  if (!session?.user?.email) return null

  return prisma.usuario.findUnique({
    where: { email: session.user.email },
    include: { equipes: { include: { equipe: true } }, permissoes: true },
  })
})
