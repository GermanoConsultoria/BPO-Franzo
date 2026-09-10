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

  const equipeAtual = usuario.equipes.find(e => e.equipe_id === equipeId)
  
  if (!equipeAtual) redirect('/')

  // Projetos recentes (temporariamente mantidos assim, ajustaremos a lógica global no próximo passo)
  const projetosIniciais = await prisma.projeto.findMany({
    where: { ativo: true },
    orderBy: { dt_acesso: 'desc' },
    take: 10
  })

  return (
    // Centralizamos TUDO no AuthenticatedLayout
    <AuthenticatedLayout
       usuario={usuario as unknown as import('@/types').Usuario}
       equipeAtual={equipeAtual.equipe}
       minhasEquipes={usuario.equipes.map(e => e.equipe)}
       projetosIniciais={projetosIniciais}
    >
      {children}
    </AuthenticatedLayout>
  )
}