import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileText, ExternalLink } from 'lucide-react'
import { formatarDataBR, hojeNoFusoBrasil, parseDateLocal } from '@/lib/date'
import BotaoImprimir from '@/components/BotaoImprimir'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function RelatorioPage(props: {
  params: Promise<{ equipeId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { equipeId } = await props.params
  const sp = await props.searchParams

  const projetoId = typeof sp.projetoId === 'string' ? sp.projetoId : undefined
  const dataInicioDe = typeof sp.dataInicioDe === 'string' ? sp.dataInicioDe : undefined
  const dataInicioAte = typeof sp.dataInicioAte === 'string' ? sp.dataInicioAte : undefined
  const dataEntregaDe = typeof sp.dataEntregaDe === 'string' ? sp.dataEntregaDe : undefined
  const dataEntregaAte = typeof sp.dataEntregaAte === 'string' ? sp.dataEntregaAte : undefined

  // Etapas selecionadas para exibição: vêm de ?e=ETAPA1&e=ETAPA2
  const rawE = sp['e']
  const etapasFiltradas: string[] | null = rawE
    ? (Array.isArray(rawE) ? rawE : [rawE])
    : null

  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado) redirect('/login')

  const equipe = await prisma.equipe.findUnique({ where: { id: equipeId } })
  if (!equipe) redirect('/')

  const todosProjetosDaEquipe = await prisma.projeto.findMany({
    where: { equipe_id: equipeId, ativo: true },
    select: { id: true, nome: true }
  })

  // Filtros de projetos
  const where: Prisma.ProjetoWhereInput = { equipe_id: equipeId, ativo: true }
  if (projetoId) where.id = projetoId
  if (dataInicioDe || dataInicioAte) {
    where.data_inicio = {
      ...(dataInicioDe ? { gte: new Date(dataInicioDe) } : {}),
      ...(dataInicioAte ? { lte: new Date(dataInicioAte) } : {})
    }
  }
  if (dataEntregaDe || dataEntregaAte) {
    where.data_prevista_entrega = {
      ...(dataEntregaDe ? { gte: new Date(dataEntregaDe) } : {}),
      ...(dataEntregaAte ? { lte: new Date(dataEntregaAte) } : {})
    }
  }

  const projetos = await prisma.projeto.findMany({
    where,
    orderBy: { nome: 'asc' },
    include: {
      usuario: { select: { nome: true } },
      colunas: {
        orderBy: { ordem: 'asc' },
        include: { coluna: true }
      }
    }
  })

  // Coletar todas as etapas únicas (preservando ordem de aparição)
  const etapasOrdem: string[] = []
  const etapasSet = new Set<string>()
  for (const p of projetos) {
    for (const pc of p.colunas) {
      if (!etapasSet.has(pc.coluna.nome)) {
        etapasSet.add(pc.coluna.nome)
        etapasOrdem.push(pc.coluna.nome)
      }
    }
  }

  // Etapas visíveis: se o usuário filtrou, usar o filtro; senão, mostrar todas
  const etapasVisiveis = etapasFiltradas && etapasFiltradas.length > 0
    ? etapasOrdem.filter(e => etapasFiltradas.includes(e))
    : etapasOrdem

  const temFiltro = projetoId || dataInicioDe || dataInicioAte || dataEntregaDe || dataEntregaAte
  const hoje = hojeNoFusoBrasil()

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="px-8 py-6 bg-surface border-b border-border flex justify-between items-center sticky top-0 z-20 shrink-0 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <FileText className="text-indigo-600" />
            Relatório de Projetos: {equipe.nome}
          </h1>
          <p className="text-text-muted text-sm mt-1">Projetos como linhas, etapas como colunas.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/equipe/${equipeId}/portfolio`} className="px-4 py-2 bg-surface-highlight text-foreground text-sm font-bold rounded-lg border border-border hover:bg-border transition-colors">
            Portfólio
          </Link>
          <BotaoImprimir />
        </div>
      </header>

      {/* FILTROS */}
      <form method="GET" className="px-8 py-4 bg-surface border-b border-border space-y-4 print:hidden">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Projeto</label>
            <select name="projetoId" defaultValue={projetoId || ''} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]">
              <option value="">Todos</option>
              {todosProjetosDaEquipe.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Início do projeto — de</label>
            <input type="date" name="dataInicioDe" defaultValue={dataInicioDe || ''} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">até</label>
            <input type="date" name="dataInicioAte" defaultValue={dataInicioAte || ''} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Previsão de entrega — de</label>
            <input type="date" name="dataEntregaDe" defaultValue={dataEntregaDe || ''} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">até</label>
            <input type="date" name="dataEntregaAte" defaultValue={dataEntregaAte || ''} className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Filtrar</button>
            {(temFiltro || etapasFiltradas) && (
              <Link href={`/equipe/${equipeId}/relatorio`} className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50/10 rounded-lg">Limpar</Link>
            )}
          </div>
        </div>

        {/* Seletor de etapas visíveis */}
        {etapasOrdem.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-2">Etapas visíveis no relatório</label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {etapasOrdem.map(etapa => {
                const checked = !etapasFiltradas || etapasFiltradas.includes(etapa)
                return (
                  <label key={etapa} className="flex items-center gap-1.5 text-sm cursor-pointer select-none text-foreground">
                    <input
                      type="checkbox"
                      name="e"
                      value={etapa}
                      defaultChecked={checked}
                      className="rounded accent-indigo-600"
                    />
                    {etapa}
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </form>

      <div className="flex-1 overflow-auto">
        {/* Cabeçalho de impressão */}
        <div className="hidden print:block px-8 pt-6 mb-4">
          <h1 className="text-2xl font-bold">{equipe.nome} — Relatório de Projetos</h1>
          <p className="text-sm text-gray-500 mt-1">Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        {projetos.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p>Nenhum projeto encontrado com os filtros aplicados.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border sticky top-0 z-10">
                {/* Colunas fixas */}
                <th className="px-5 py-3 text-xs font-bold text-text-muted uppercase tracking-wide whitespace-nowrap min-w-[200px]">Projeto</th>
                <th className="px-5 py-3 text-xs font-bold text-text-muted uppercase tracking-wide whitespace-nowrap">Responsável</th>
                <th className="px-5 py-3 text-xs font-bold text-text-muted uppercase tracking-wide whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-white">Início</span>
                    <span className="text-border">—</span>
                    <span className="text-white">Previsão</span>
                  </div>
                </th>
                {/* Colunas dinâmicas de etapa */}
                {etapasVisiveis.map(etapa => (
                  <th key={etapa} className="px-4 py-3 text-xs font-bold text-indigo-600 uppercase tracking-wide whitespace-nowrap min-w-[200px] border-l border-border/50 text-center">
                    <span className="block">{etapa}</span>
                    <div className="flex items-center justify-center gap-2 mt-0.5 normal-case font-normal text-[10px]">
                      <span className="text-emerald-500">início</span>
                      <span className="text-border">—</span>
                      <span className="text-indigo-400">fim</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projetos.map(projeto => {
                // Mapa de etapa → dados da coluna do projeto
                const etapaMap = new Map(
                  projeto.colunas.map(pc => [pc.coluna.nome, pc])
                )

                return (
                  <tr key={projeto.id} className="hover:bg-surface-highlight/20 transition-colors group">
                    {/* Projeto */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground">{projeto.nome}</span>
                        <Link
                          href={`/equipe/${equipeId}/projeto/${projeto.id}`}
                          className="text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                          title="Abrir projeto"
                        >
                          <ExternalLink size={13} />
                        </Link>
                      </div>
                    </td>

                    {/* Responsável */}
                    <td className="px-5 py-4 text-sm text-text-muted whitespace-nowrap">
                      {projeto.usuario?.nome || <span className="italic text-gray-300">—</span>}
                    </td>

                    {/* Datas do projeto */}
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-sm font-bold text-white">
                          {projeto.data_inicio ? formatarDataBR(projeto.data_inicio) : <span className="text-gray-500 font-normal italic">—</span>}
                        </span>
                        <span className="text-border text-sm">—</span>
                        {projeto.data_prevista_entrega ? (
                          <span className={`text-sm font-bold ${parseDateLocal(projeto.data_prevista_entrega)! < hoje ? 'text-red-500' : 'text-white'}`}>
                            {formatarDataBR(projeto.data_prevista_entrega)}
                          </span>
                        ) : <span className="text-gray-500 font-normal italic">—</span>}
                      </div>
                    </td>

                    {/* Células de etapa */}
                    {etapasVisiveis.map(etapa => {
                      const pc = etapaMap.get(etapa)
                      const inicio = pc?.data_inicio ? formatarDataBR(pc.data_inicio) : null
                      const fim = pc?.data_fim ? formatarDataBR(pc.data_fim) : null
                      const fimAtrasado = !!pc?.data_fim && parseDateLocal(pc.data_fim)! < hoje

                      return (
                        <td key={etapa} className="px-4 py-4 border-l border-border/50 whitespace-nowrap text-center">
                          {!pc ? (
                            <span className="text-gray-300 italic text-xs">—</span>
                          ) : inicio || fim ? (
                            <div className="flex items-center justify-center gap-1.5 text-xs font-medium">
                              <span className="text-emerald-500">{inicio || '—'}</span>
                              <span className="text-border">→</span>
                              <span className={fimAtrasado ? 'text-red-500' : 'text-indigo-400'}>{fim || '—'}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 italic text-xs">sem datas</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
