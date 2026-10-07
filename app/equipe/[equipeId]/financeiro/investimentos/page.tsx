import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import InvestimentosView from '@/components/financeiro/InvestimentosView'

export const dynamic = 'force-dynamic'

export default async function InvestimentosPage({ params }: { params: Promise<{ equipeId: string }> }) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const { equipeId } = await params

  const [investimentos, equipe, bancos] = await Promise.all([
    prisma.investimento.findMany({
      where: { equipe_id: equipeId },
      orderBy: { dt_movimento: 'asc' },
    }),
    prisma.equipe.findUnique({ where: { id: equipeId }, select: { nome: true } }),
    prisma.banco.findMany({
      where: { equipe_id: equipeId, ativo: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const investimentosSerializados = investimentos.map(i => ({
    ...i,
    valor: Number(i.valor),
    saldo_anterior: i.saldo_anterior !== null ? Number(i.saldo_anterior) : null,
    saldo_atual: i.saldo_atual !== null ? Number(i.saldo_atual) : null,
  }))
  const bancosSerializados = bancos.map(b => ({ ...b, saldo_inicial: Number(b.saldo_inicial), saldo_atual: Number(b.saldo_atual) }))

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Investimentos</h1>
        <p className="text-sm text-gray-500 mt-1">Controle os aportes e resgates de investimentos deste cliente.</p>
      </header>
      <InvestimentosView
        equipeId={equipeId}
        nomeCliente={equipe?.nome ?? ''}
        investimentos={investimentosSerializados as never}
        bancos={bancosSerializados}
      />
    </div>
  )
}
