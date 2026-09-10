import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuario = await prisma.usuario.findUnique({
    where: { email: session.user.email },
    include: { equipes: { include: { equipe: true } } }
  })

  if (!usuario) redirect('/login')

  // Projetos recentes para alimentar a barra lateral (Global do Workspace)
  const projetosIniciais = await prisma.projeto.findMany({
    where: { 
        ativo: true,
        workspace_id: usuario.workspace_id 
    },
    orderBy: { dt_acesso: 'desc' },
    take: 10
  })

  // Pegamos a primeira equipe apenas como contexto visual para evitar erros no layout
  const equipeVisual = usuario.equipes.length > 0 ? usuario.equipes[0].equipe : null

  return (
    // O AuthenticatedLayout desenha a Sidebar e a Topbar ao redor da tela
    <AuthenticatedLayout
       usuario={usuario as unknown as import('@/types').Usuario}
       equipeAtual={equipeVisual}
       minhasEquipes={usuario.equipes.map(e => e.equipe)}
       projetosIniciais={projetosIniciais}
    >
      {children}
    </AuthenticatedLayout>
  )
}