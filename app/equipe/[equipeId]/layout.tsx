import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'

export default async function EquipeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ equipeId: string }>
}) {
  const { equipeId } = await params
  const session = await auth()

  if (!session?.user?.email) redirect('/login')

  const usuario = await prisma.usuario.findUnique({
    where: { email: session.user.email },
    include: { equipes: { include: { equipe: true } } }
  })

  if (!usuario) redirect('/login')

  // ADMIN e EMPRESA enxergam todos os clientes (equipes) do workspace.
  // CLIENTE só enxerga as equipes das quais é membro (normalmente uma só).
  const veTodosOsClientes = usuario.role === 'ADMIN' || usuario.role === 'EMPRESA'

  const minhasEquipes = veTodosOsClientes
    ? await prisma.equipe.findMany({ where: { workspace_id: usuario.workspace_id }, orderBy: { nome: 'asc' } })
    : usuario.equipes.map(e => e.equipe)

  const equipeAtual = minhasEquipes.find(e => e.id === equipeId) ?? null

  if (!equipeAtual) redirect('/')

  return (
    <AuthenticatedLayout
       usuario={usuario as unknown as import('@/types').Usuario}
       equipeAtual={equipeAtual}
       minhasEquipes={minhasEquipes}
    >
      {children}
    </AuthenticatedLayout>
  )
}
