import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getBalancete } from '@/app/actions'
import BalanceteView from '@/components/financeiro/BalanceteView'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function BalancetePage({
  params,
  searchParams,
}: {
  params: Promise<{ equipeId: string }>
  searchParams: Promise<{ inicio?: string; fim?: string }>
}) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const { equipeId } = await params
  const sp = await searchParams

  // Padrão: mês atual
  const hoje = new Date()
  const inicio = sp.inicio ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const fim = sp.fim ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`

  const [balancete, equipe] = await Promise.all([
    getBalancete(equipeId, inicio, fim),
    prisma.equipe.findUnique({ where: { id: equipeId }, select: { nome: true } }),
  ])

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Balancete</h1>
        <p className="text-sm text-gray-500 mt-1">Resumo financeiro do período selecionado.</p>
      </header>
      <BalanceteView equipeId={equipeId} nomeCliente={equipe?.nome ?? ''} balancete={balancete} dataInicio={inicio} dataFim={fim} />
    </div>
  )
}
