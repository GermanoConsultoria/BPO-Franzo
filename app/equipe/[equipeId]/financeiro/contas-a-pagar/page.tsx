import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import LancamentosView from '@/components/financeiro/LancamentosView'

export const dynamic = 'force-dynamic'

export default async function ContasAPagarPage({ params }: { params: Promise<{ equipeId: string }> }) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const { equipeId } = await params

  const [lancamentos, planoContas, bancos] = await Promise.all([
    prisma.lancamentoFinanceiro.findMany({
      where: { equipe_id: equipeId, tipo: 'DESPESA' },
      include: { plano_contas: true, banco: true, anexos: true, parciais: { orderBy: { dt_pagamento: 'asc' } } },
      orderBy: { dt_vencimento: 'asc' },
    }),
    prisma.planoContas.findMany({
      where: { equipe_id: equipeId, tipo: 'DESPESA', ativo: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.banco.findMany({
      where: { equipe_id: equipeId, ativo: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const lancamentosSerializados = lancamentos.map(l => ({
    ...l,
    valor: Number(l.valor),
    saldo_anterior: l.saldo_anterior !== null ? Number(l.saldo_anterior) : null,
    saldo_atual: l.saldo_atual !== null ? Number(l.saldo_atual) : null,
    banco: l.banco ? { ...l.banco, saldo_inicial: Number(l.banco.saldo_inicial), saldo_atual: Number(l.banco.saldo_atual) } : null,
    parciais: l.parciais.map(p => ({ ...p, valor: Number(p.valor) })),
  }))

  const bancosSerializados = bancos.map(b => ({ ...b, saldo_inicial: Number(b.saldo_inicial), saldo_atual: Number(b.saldo_atual) }))

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie as despesas e obrigações financeiras deste cliente.</p>
      </header>
      <LancamentosView
        equipeId={equipeId}
        lancamentos={lancamentosSerializados as never}
        planoContas={planoContas}
        bancos={bancosSerializados}
        tipo="DESPESA"
      />
    </div>
  )
}
