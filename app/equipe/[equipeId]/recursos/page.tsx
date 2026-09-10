import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import RecursosView from '@/components/RecursosView'

export const dynamic = 'force-dynamic'

export default async function RecursosPage({ params }: { params: Promise<{ equipeId: string }> }) {
  const { equipeId } = await params

  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado) redirect('/login')

  const equipe = await prisma.equipe.findUnique({ where: { id: equipeId } })
  if (!equipe) redirect('/')

  const recursos = await prisma.recursoEquipe.findMany({
    where: { equipe_id: equipeId },
    orderBy: [{ ordem: 'asc' }]
  })

  return (
    <RecursosView
      equipeId={equipeId}
      equipeNome={equipe.nome}
      recursosIniciais={recursos}
      roleUsuario={usuarioLogado.role}
    />
  )
}
