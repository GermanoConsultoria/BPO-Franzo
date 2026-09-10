import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'

export default async function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuario = await prisma.usuario.findUnique({
    where: { email: session.user.email },
    include: { equipes: { include: { equipe: true } } }
  })

  if (!usuario) redirect('/login')

  const equipeAtual = usuario.equipes[0]?.equipe ?? null
  const minhasEquipes = usuario.equipes.map(e => e.equipe)

  const projetosIniciais = await prisma.projeto.findMany({
    where: { workspace_id: usuario.workspace_id, ativo: true },
    orderBy: { dt_acesso: 'desc' },
    take: 8,
    select: { id: true, nome: true, imagem: true }
  })

  return (
    <AuthenticatedLayout
      usuario={usuario as unknown as import('@/types').Usuario}
      equipeAtual={equipeAtual}
      minhasEquipes={minhasEquipes}
      projetosIniciais={projetosIniciais}
    >
      {children}
    </AuthenticatedLayout>
  )
}
