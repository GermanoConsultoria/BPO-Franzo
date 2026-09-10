import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import MinhasTarefasView from '@/components/MinhasTarefasView'
import { auth } from '@/auth'
import { hojeNoFusoBrasil, extrairDataYMD } from '@/lib/date'
import type { TarefaComRelacoes, ProjetoComColunas } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Params = { equipeId: string }
type SearchParams = { view?: string }

export default async function SprintPage(props: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}) {
  const { equipeId } = await props.params
  const { view = 'semana' } = await props.searchParams

  const session = await auth()
  let usuarioId = ''
  if (session?.user?.email) {
    const user = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (user) usuarioId = user.id
  }

  // Cálculo do intervalo de datas no fuso Brasil
  const hoje = hojeNoFusoBrasil()

  let dataInicio: Date
  let dataFim: Date

  if (view === 'mes') {
    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
  } else {
    const diaSemana = hoje.getDay()
    dataInicio = new Date(hoje)
    dataInicio.setDate(hoje.getDate() - diaSemana)
    dataFim = new Date(hoje)
    dataFim.setDate(hoje.getDate() + (6 - diaSemana))
  }

  const dataInicioUTC = new Date(Date.UTC(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate(), 0, 0, 0))
  const dataFimUTC = new Date(Date.UTC(dataFim.getFullYear(), dataFim.getMonth(), dataFim.getDate(), 23, 59, 59))

  const [tarefas, projetos, usuarios] = await Promise.all([
    prisma.tarefa.findMany({
      where: {
        dt_vencimento: { gte: dataInicioUTC, lte: dataFimUTC },
        projeto: { ativo: true, equipe_id: equipeId },
      },
      orderBy: { dt_vencimento: 'asc' },
      include: {
        projeto: true,
        usuario: true,
        coluna: true,
        anexos: true,
        prioridade: true,
        dificuldade: true,
        comentarios: { include: { usuario: true }, orderBy: { dt_insert: 'asc' } },
      },
    }),
    prisma.projeto.findMany({
      where: { ativo: true, equipe_id: equipeId },
      orderBy: { nome: 'asc' },
      include: {
        colunas: { include: { coluna: true }, orderBy: { ordem: 'asc' } },
      },
    }),
    prisma.usuario.findMany({
      where: { equipes: { some: { equipe_id: equipeId } } },
      orderBy: { nome: 'asc' },
    }),
  ])

  const labelIntervalo = `${dataInicio.toLocaleDateString('pt-BR')} – ${dataFim.toLocaleDateString('pt-BR')}`

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <header className="flex-shrink-0 flex justify-between items-end px-1">
        <div>
          <h1 className="text-lg lg:text-2xl font-bold text-foreground">Sprint da Equipe</h1>
          <p className="text-gray-500 text-[10px] lg:text-xs mt-0.5">
            <strong className="text-indigo-600 capitalize">{view}</strong>
            <span className="ml-2 text-gray-400">({labelIntervalo})</span>
          </p>
        </div>

        <div className="bg-surface border border-border p-0.5 rounded flex shadow-sm">
          <Link
            href="?view=semana"
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              view === 'semana' ? 'bg-indigo-500/10 text-indigo-400 shadow-sm' : 'text-gray-500 hover:bg-surface/50'
            }`}
          >
            Semana
          </Link>
          <Link
            href="?view=mes"
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              view === 'mes' ? 'bg-indigo-500/10 text-indigo-400 shadow-sm' : 'text-gray-500 hover:bg-surface/50'
            }`}
          >
            Mês
          </Link>
        </div>
      </header>

      <div className="flex-1 min-h-0 border border-border rounded-lg bg-surface shadow-sm overflow-hidden">
        <MinhasTarefasView
          tarefasIniciais={tarefas as unknown as TarefaComRelacoes[]}
          listaProjetos={projetos as unknown as ProjetoComColunas[]}
          usuarios={usuarios}
          agrupamento="PROJETO"
          enableCalendarNavigation={false}
          initialCalendarDate={extrairDataYMD(dataInicio) ?? undefined}
          calendarViewMode={view === 'mes' ? 'MES' : 'SEMANA'}
          usuarioLogadoId={usuarioId}
        />
      </div>
    </div>
  )
}
