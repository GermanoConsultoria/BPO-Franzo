import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getBalancete } from '@/app/actions'
import BalanceteView from '@/components/financeiro/BalanceteView'

export const dynamic = 'force-dynamic'

export default async function BalancetePage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fim?: string }>
}) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuario) redirect('/login')

  const params = await searchParams

  // Padrão: mês atual
  const hoje = new Date()
  const inicio = params.inicio ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const fim = params.fim ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}`

  const balancete = await getBalancete(inicio, fim)

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">Balancete</h1>
        <p className="text-sm text-gray-500 mt-1">Resumo financeiro do período selecionado.</p>
      </header>
      <BalanceteView balancete={balancete} dataInicio={inicio} dataFim={fim} />
    </div>
  )
}
