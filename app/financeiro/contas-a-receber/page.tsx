import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import LancamentosView from '@/components/financeiro/LancamentosView'

export const dynamic = 'force-dynamic'

export default async function ContasAReceberPage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuario) redirect('/login')

  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where: { workspace_id: usuario.workspace_id, tipo: 'RECEITA' },
    include: { plano_contas: true, anexos: true },
    orderBy: { dt_vencimento: 'asc' },
  })

  const planoContas = await prisma.planoContas.findMany({
    where: { workspace_id: usuario.workspace_id, tipo: 'RECEITA', ativo: true },
    orderBy: { nome: 'asc' },
  })

  const lancamentosSerializados = lancamentos.map(l => ({ ...l, valor: Number(l.valor) }))

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Contas a Receber</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie suas receitas e valores a receber.</p>
      </header>
      <LancamentosView
        lancamentos={lancamentosSerializados as never}
        planoContas={planoContas}
        tipo="RECEITA"
      />
    </div>
  )
}
