import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, AlertCircle, ExternalLink } from 'lucide-react'
import SelectFasePortfolio from '@/components/SelectFasePortfolio'
import FiltrosPortfolio from '@/components/FiltroPortfolio'
import type { Prisma } from '@prisma/client'
import { formatarDataBR } from '@/lib/date'

export default async function PortfolioPage(
    props: {
        params: Promise<{ equipeId: string }>
        searchParams: Promise<{ projetoId?: string, fase?: string, status?: string, responsavelId?: string, mes?: string }>
    }
) {
  const { equipeId } = await props.params
  const searchParams = await props.searchParams
  const { projetoId, fase, status, responsavelId, mes } = searchParams

  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado) redirect('/login')

  const equipe = await prisma.equipe.findUnique({ where: { id: equipeId } })
  if (!equipe) redirect('/')

  const todosProjetosDaEquipe = await prisma.projeto.findMany({
    where: { equipe_id: equipeId, ativo: true },
    select: { id: true, nome: true, fase_macro: true, colunas: { include: { coluna: true } }, usuario: { select: { id: true, nome: true } } }
  })

  const listaProjetos = todosProjetosDaEquipe.map(p => ({ id: p.id, nome: p.nome }))

  // Responsáveis únicos dos projetos desta equipe
  const responsaveisMap = new Map<string, string>()
  todosProjetosDaEquipe.forEach(p => {
    if (p.usuario) responsaveisMap.set(p.usuario.id, p.usuario.nome)
  })
  const listaResponsaveis = Array.from(responsaveisMap.entries()).map(([id, nome]) => ({ id, nome }))

  const fasesSet = new Set<string>()
  todosProjetosDaEquipe.forEach(p => {
    if (p.fase_macro) fasesSet.add(p.fase_macro)
    p.colunas.forEach(pc => fasesSet.add(pc.coluna.nome))
  })
  const fasesUnicas = Array.from(fasesSet).sort()
  if (!fasesUnicas.includes("CONCLUIDO")) fasesUnicas.push("CONCLUIDO")

  const condicoesFiltro: Prisma.ProjetoWhereInput = { equipe_id: equipeId, ativo: true }
  if (projetoId) condicoesFiltro.id = projetoId
  if (fase) condicoesFiltro.fase_macro = fase
  if (status) condicoesFiltro.status_cliente = status
  if (responsavelId) condicoesFiltro.usuario_id = responsavelId
  if (mes) {
    const [ano, mesNum] = mes.split('-').map(Number)
    const inicio = new Date(ano, mesNum - 1, 1)
    const fim = new Date(ano, mesNum, 0, 23, 59, 59)
    condicoesFiltro.data_prevista_entrega = { gte: inicio, lte: fim }
  }

  const projetosFiltrados = await prisma.projeto.findMany({
      where: condicoesFiltro,
      orderBy: { dt_update: 'desc' },
      include: {
          colunas: {
              include: { coluna: true },
              orderBy: { ordem: 'asc' }
          },
          tarefas: true,
          usuario: { select: { id: true, nome: true } }
      }
  })

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      <header className="px-8 py-6 bg-surface border-b border-border flex justify-between items-center sticky top-0 z-20 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <LayoutDashboard className="text-indigo-600" />
              Portfólio de Implantações: {equipe.nome}
          </h1>
          <p className="text-text-muted text-sm mt-1">Visão macro de todos os clientes.</p>
        </div>
        <Link
            href={`/equipe/${equipeId}/projetos`}
            className="px-4 py-2 bg-surface-highlight text-foreground text-sm font-bold rounded-lg border border-border hover:bg-border transition-colors"
        >
            Voltar para Projetos
        </Link>
      </header>

      <div className="flex-1 overflow-auto p-8 flex flex-col">

          <FiltrosPortfolio projetos={listaProjetos} fases={fasesUnicas} responsaveis={listaResponsaveis} mesSelecionado={mes || ''} />

          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex-1">
              <div className="overflow-auto h-full">
                <table className="w-full text-left text-sm relative">
                    <thead className="bg-surface-highlight/50 text-xs uppercase font-bold text-gray-500 border-b border-border sticky top-0 z-10 backdrop-blur-md">
                        <tr>
                            <th className="px-4 py-3">Cliente / Projeto</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Fase Atual</th>
                            <th className="px-4 py-3">Pacote & Integração</th>
                            <th className="px-4 py-3">ERP</th>
                            <th className="px-4 py-3">Previsão de Entrega</th>
                            <th className="px-4 py-3 text-center">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {projetosFiltrados.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                    Nenhum projeto encontrado com estes filtros.
                                </td>
                            </tr>
                        )}

                        {projetosFiltrados.map(projeto => (
                            <tr key={projeto.id} className="hover:bg-surface-highlight/20 transition-colors group">

                                <td className="px-4 py-4">
                                    <span className="font-bold text-foreground block">{projeto.nome}</span>
                                    {projeto.descricao && <span className="text-xs text-text-muted truncate max-w-[200px] block mt-0.5">{projeto.descricao}</span>}
                                </td>

                                <td className="px-4 py-4">
                                    {projeto.status_cliente === 'PAUSADO' ? (
                                        <div className="flex flex-col">
                                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold w-max">
                                                ⏸️ Pausado
                                            </span>
                                            {projeto.motivo_pausa && (
                                                <span className="text-[10px] text-red-500 mt-1 max-w-[150px] leading-tight flex items-start gap-1">
                                                    <AlertCircle size={10} className="shrink-0 mt-0.5"/> {projeto.motivo_pausa}
                                                </span>
                                            )}
                                        </div>
                                    ) : projeto.status_cliente === 'CONCLUIDO' ? (
                                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold w-max">
                                            ✅ Concluído
                                        </span>
                                    ) : projeto.status_cliente === 'AGUARDANDO_ONBLOX' ? (
                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-xs font-bold w-max">
                                            ⏳ Aguardando Onblox
                                        </span>
                                    ) : projeto.status_cliente === 'AGUARDANDO_CLIENTE' ? (
                                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs font-bold w-max">
                                            🔔 Aguardando Cliente
                                        </span>
                                    ) : projeto.status_cliente === 'RISCO_CHURN' ? (
                                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded text-xs font-bold w-max">
                                            🔴 Risco Churn
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded text-xs font-bold w-max">
                                            🟢 Em Andamento
                                        </span>
                                    )}
                                </td>

                                <td className="px-4 py-4 min-w-[220px]">
                                    <div className="flex flex-col gap-2.5">
                                        <SelectFasePortfolio
                                            projetoId={projeto.id}
                                            equipeId={equipeId}
                                            faseAtual={projeto.fase_macro || ''}
                                            opcoes={projeto.colunas.map(pc => pc.coluna.nome)}
                                        />

                                        {projeto.fase_macro && projeto.fase_macro !== 'CONCLUIDO' && (
                                            <div className="space-y-1.5 px-0.5">
                                                {(() => {
                                                    const colunaAtualId = projeto.colunas.find(pc => pc.coluna.nome === projeto.fase_macro)?.coluna_id
                                                    const tarefasDaFase = projeto.tarefas.filter(t => t.coluna_id === colunaAtualId)
                                                    const total = tarefasDaFase.length
                                                    const concluidas = tarefasDaFase.filter(t => t.concluida).length
                                                    const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0

                                                    return (
                                                        <>
                                                            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                                                <span className="text-text-muted">Progresso na Etapa</span>
                                                                <span className={percentual === 100 ? "text-emerald-500" : "text-indigo-500"}>
                                                                    {percentual}%
                                                                </span>
                                                            </div>
                                                            <div className="w-full bg-surface-highlight h-1.5 rounded-full overflow-hidden border border-border">
                                                                <div
                                                                    className={`h-full transition-all duration-700 ease-in-out ${percentual === 100 ? 'bg-emerald-500' : 'bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.3)]'}`}
                                                                    style={{ width: `${percentual}%` }}
                                                                />
                                                            </div>
                                                            <p className="text-[9px] text-gray-400 italic">
                                                                {concluidas} de {total} tarefas feitas
                                                            </p>
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td className="px-4 py-4">
                                    <span className="block text-xs font-bold text-foreground">{projeto.pacote_onblox || '-'}</span>
                                    <span className="block text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">{projeto.tipo_integracao || '-'}</span>
                                </td>

                                <td className="px-4 py-4">
                                    <span className="px-2 py-1 bg-surface-highlight rounded text-xs font-medium text-foreground border border-border">
                                        {projeto.erp || 'Não definido'}
                                    </span>
                                </td>

                                <td className="px-4 py-4">
                                    {projeto.data_prevista_entrega ? (
                                        <span className="text-xs font-medium text-foreground">
                                            {formatarDataBR(projeto.data_prevista_entrega)}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 italic text-xs">—</span>
                                    )}
                                </td>

                                <td className="px-4 py-4 text-center">
                                    <Link
                                        href={`/equipe/${equipeId}/projeto/${projeto.id}`}
                                        className="inline-flex items-center justify-center p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                        title="Abrir Kanban do Projeto"
                                    >
                                        <ExternalLink size={16} />
                                    </Link>
                                </td>

                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </div>
      </div>
    </div>
  )
}
