import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import PlanoContasView from '@/components/financeiro/PlanoContasView'

export const dynamic = 'force-dynamic'

export default async function PlanoContasPage({ params }: { params: Promise<{ equipeId: string }> }) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const { equipeId } = await params

  const contas = await prisma.planoContas.findMany({
    where: { equipe_id: equipeId },
    include: { _count: { select: { lancamentos: true } } },
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
  })

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Plano de Contas</h1>
        <p className="text-sm text-gray-500 mt-1">Categorias para classificar receitas e despesas deste cliente.</p>
      </header>
      <PlanoContasView equipeId={equipeId} contas={contas as never} />
    </div>
  )
}
