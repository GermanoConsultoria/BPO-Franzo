import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import BancosView from '@/components/financeiro/BancosView'

export const dynamic = 'force-dynamic'

export default async function BancosPage({ params }: { params: Promise<{ equipeId: string }> }) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const { equipeId } = await params

  const bancos = await prisma.banco.findMany({
    where: { equipe_id: equipeId },
    include: { _count: { select: { lancamentos: true } } },
    orderBy: { nome: 'asc' },
  })

  const bancosSerializados = bancos.map(b => ({
    ...b,
    saldo_inicial: Number(b.saldo_inicial),
    saldo_atual: Number(b.saldo_atual),
  }))

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Bancos</h1>
        <p className="text-sm text-gray-500 mt-1">Contas bancárias deste cliente e o saldo movimentado pelos pagamentos e recebimentos.</p>
      </header>
      <BancosView equipeId={equipeId} bancos={bancosSerializados as never} />
    </div>
  )
}
