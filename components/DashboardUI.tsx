'use client'

import { useState, useEffect, Fragment } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts'
import {
  LayoutDashboard, Users, AlertTriangle, History, Filter,
  BarChart3, LineChart as IconLine, PieChart as IconPie, CheckCircle2,
  Clock
} from 'lucide-react'
import BotaoExportarTarefasFuncionario from './BotaoExportarTarefasFuncionario'

// Cores para Barras/Linhas (Status)
const COLOR_CONCLUIDA = '#10b981' 
const COLOR_PENDENTE = '#6366f1'  
const COLOR_ATRASADA = '#ef4444'  

// Cores para Pizza (Projetos - Paleta Variada)
const COLORS_PROJETOS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#14b8a6', '#f43f5e',
    '#22c55e', '#eab308', '#d946ef', '#3b82f6', '#f97316'
]

interface DadosProjeto {
  nome: string
  total: number
  concluidas: number
  pendentes: number
  atrasadas: number
}

interface DadosUsuario {
  nome: string
  concluidas: number
  pendentes: number
  atrasadas: number
}

interface DadosEtapa {
  name: string
  qtd: number
}

interface DadosHistorico {
  projeto: string
  qtd: number
}

type StatusTarefa = 'concluidas' | 'atrasadas' | 'pendentes'

interface TarefaLinha {
  titulo: string
  projeto: string
  etapa: string
  status: StatusTarefa
  vencimento: string | null
}

interface DadosTarefasUsuario {
  nome: string
  total: number
  concluidas: number
  atrasadas: number
  pendentes: number
  tarefas: TarefaLinha[]
}

interface EtapaPendente {
  nome: string
  pendentes: number
  atrasadas: number
  concluidas: number
  tarefas: { titulo: string; status: StatusTarefa; vencimento: string | null }[]
}

interface DadosProjetoEtapas {
  nome: string
  totalRestante: number
  etapas: EtapaPendente[]
}

interface ResumoGeral {
  total: number
  concluidas: number
  atrasadas: number
  pendentes: number
  taxaConclusao: number
  taxaAtraso: number
  taxaPendente: number
}

interface DashboardUIProps {
  dadosProjetos: DadosProjeto[]
  dadosUsuarios: DadosUsuario[]
  dadosEtapas: DadosEtapa[]
  dadosHistorico: DadosHistorico[]
  dadosTarefasUsuario: DadosTarefasUsuario[]
  dadosProjetoEtapas: DadosProjetoEtapas[]
  resumoGeral: ResumoGeral
  listaProjetos: { id: string; nome: string }[]
  listaUsuarios: { id: string; nome: string }[]
  statusAtivo?: string
}

interface BarConfig {
  key: string
  name: string
  color: string
}

interface GraficoUniversalProps {
  type: 'BAR' | 'LINE' | 'PIE'
  data: Record<string, unknown>[]
  xKey: string
  bars: BarConfig[]
}

export default function DashboardUI({
    dadosProjetos, dadosUsuarios, dadosEtapas, dadosHistorico, resumoGeral,
    dadosTarefasUsuario, dadosProjetoEtapas,
    listaProjetos, listaUsuarios, statusAtivo = ''
}: DashboardUIProps) {
  
  const [abaAtiva, setAbaAtiva] = useState<'TAREFAS' | 'PROJETOS' | 'SPRINT'>('TAREFAS')
  
  // Controle Tarefas — "GERAL" (padrão) mostra concluídas + atrasadas por pessoa
  const [relatorioTarefas, setRelatorioTarefas] = useState('GERAL')
  const [tipoGraficoTarefas, setTipoGraficoTarefas] = useState<'BAR' | 'LINE' | 'PIE'>('BAR')

  // Controle Projetos
  const [relatorioProjetos, setRelatorioProjetos] = useState('STATUS_GERAL')
  const [tipoGraficoProjetos, setTipoGraficoProjetos] = useState<'BAR' | 'LINE' | 'PIE'>('BAR')

  // Card de KPI destacado. Começa em 'total' (estado padrão). null = nenhum (navegação livre pelos selects).
  const [cardSelecionado, setCardSelecionado] = useState<'total' | 'concluidas' | 'atrasadas' | 'pendentes' | 'alteracoes' | null>('total')

  const router = useRouter()
  const searchParams = useSearchParams()

  const getValorInicial = (chave: string) => {
      const valorUrl = searchParams.get(chave)
      if (valorUrl) return valorUrl
      const hoje = new Date()
      if (chave === 'inicio') return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
      if (chave === 'fim') return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]
      return ''
  }

  const [filtros, setFiltros] = useState({
      inicio: getValorInicial('inicio'),
      fim: getValorInicial('fim'),
      projetoId: searchParams.get('projetoId') || '',
      usuarioId: searchParams.get('usuarioId') || ''
  })

  useEffect(() => {
      setFiltros({
          inicio: getValorInicial('inicio'),
          fim: getValorInicial('fim'),
          projetoId: searchParams.get('projetoId') || '',
          usuarioId: searchParams.get('usuarioId') || ''
      })
  }, [searchParams])

  const aplicarFiltro = () => {
      const params = new URLSearchParams()
      if (filtros.inicio) params.set('inicio', filtros.inicio)
      if (filtros.fim) params.set('fim', filtros.fim)
      if (filtros.projetoId) params.set('projetoId', filtros.projetoId)
      if (filtros.usuarioId) params.set('usuarioId', filtros.usuarioId)
      if (statusAtivo) params.set('status', statusAtivo) // preserva o card selecionado
      router.push(`?${params.toString()}`)
      router.refresh()
  }

  // Grava (ou remove) o filtro de status na URL -> o servidor refaz os dados dos gráficos.
  const aplicarStatus = (status: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (status) params.set('status', status)
      else params.delete('status')
      router.push(`?${params.toString()}`)
      router.refresh()
  }

  // Estado padrão do painel (usado ao clicar em "Total Tarefas").
  const restaurarPadrao = () => {
      aplicarStatus('')
      setAbaAtiva('TAREFAS')
      setRelatorioTarefas('GERAL')
      setRelatorioProjetos('STATUS_GERAL')
      setTipoGraficoTarefas('BAR')
      setTipoGraficoProjetos('BAR')
  }

  // Cards de status: cada um só liga/desliga um filtro GLOBAL de status que vale
  // para TODOS os gráficos e TODAS as tabelas do painel. Não trocam mais a aba
  // nem o relatório exibido — o usuário continua vendo a visão que já estava.
  const CONFIG_CARDS = {
      concluidas: { status: 'concluidas' },
      atrasadas:  { status: 'atrasadas' },
      pendentes:  { status: 'pendentes' },
      alteracoes: { status: '' },
  } as const

  type ChaveCard = 'total' | keyof typeof CONFIG_CARDS

  const aoClicarCard = (chave: ChaveCard) => {
      if (chave === 'total') {
          setCardSelecionado('total')
          restaurarPadrao()
          return
      }
      // "Alterações" não tem filtro de status: abre a visão de reagendamentos.
      if (chave === 'alteracoes') {
          setCardSelecionado('alteracoes')
          aplicarStatus('')
          setAbaAtiva('PROJETOS')
          setRelatorioProjetos('VOLATILIDADE')
          return
      }
      // Concluídas / Atrasadas / Pendentes: alterna o filtro global de status.
      // Clicar de novo no card ativo remove o filtro.
      if (cardSelecionado === chave) {
          setCardSelecionado('total')
          aplicarStatus('')
          return
      }
      setCardSelecionado(chave)
      aplicarStatus(CONFIG_CARDS[chave].status)
  }

  return (
    <div className="space-y-6">
      {/* BARRA DE FILTROS */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-wrap gap-4 items-end shadow-sm">
          <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Início</label>
              <input type="date" value={filtros.inicio} onChange={e => setFiltros(prev => ({ ...prev, inicio: e.target.value }))} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-500 scheme-dark"/>
          </div>
          <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Fim</label>
              <input type="date" value={filtros.fim} onChange={e => setFiltros(prev => ({ ...prev, fim: e.target.value }))} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-500 scheme-dark"/>
          </div>
          <div className="min-w-[150px]">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Projeto</label>
              <select value={filtros.projetoId} onChange={e => setFiltros(prev => ({ ...prev, projetoId: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Todos os Projetos</option>
                  {listaProjetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
          </div>
          <div className="min-w-[150px]">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Usuário</label>
              <select value={filtros.usuarioId} onChange={e => setFiltros(prev => ({ ...prev, usuarioId: e.target.value }))} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Todos os Usuários</option>
                  {listaUsuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
          </div>
          <button onClick={aplicarFiltro} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors h-[38px]">
              <Filter size={16} /> Filtrar
          </button>
      </div>

      {/* KPI CARDS — Concluídas/Atrasadas/Pendentes ligam um filtro global que vale para
          todos os gráficos e tabelas. "Total" limpa o filtro. "Alterações" abre reagendamentos. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <CardKPI titulo="Total Tarefas" valor={resumoGeral.total} icon={<LayoutDashboard size={20}/>} cor="indigo"
              desc="Todas as tarefas — limpa o filtro de status" titleHint="Remove o filtro de status e restaura a visão padrão"
              ativo={cardSelecionado === 'total'} onClick={() => aoClicarCard('total')} />
          <CardKPI titulo="Concluídas" valor={resumoGeral.concluidas} sub={`${resumoGeral.taxaConclusao}%`} icon={<Users size={20}/>} cor="emerald"
              desc="Finalizadas no período" titleHint="Filtra todos os gráficos e tabelas pelas tarefas concluídas (clique de novo para limpar)"
              ativo={cardSelecionado === 'concluidas'} onClick={() => aoClicarCard('concluidas')} />
          <CardKPI titulo="Atrasadas" valor={resumoGeral.atrasadas} sub={`${resumoGeral.taxaAtraso}%`} icon={<AlertTriangle size={20}/>} cor="red"
              desc="Vencidas e não concluídas" titleHint="Filtra todos os gráficos e tabelas pelas tarefas atrasadas (clique de novo para limpar)"
              ativo={cardSelecionado === 'atrasadas'} onClick={() => aoClicarCard('atrasadas')} />
          <CardKPI titulo="Pendentes" valor={resumoGeral.pendentes} sub={`${resumoGeral.taxaPendente}%`} icon={<Clock size={20}/>} cor="indigo"
              desc="Em aberto, dentro do prazo" titleHint="Filtra todos os gráficos e tabelas pelas tarefas pendentes (clique de novo para limpar)"
              ativo={cardSelecionado === 'pendentes'} onClick={() => aoClicarCard('pendentes')} />
          <CardKPI titulo="Alterações" valor={dadosHistorico.reduce((acc, curr) => acc + curr.qtd, 0)} icon={<History size={20}/>} cor="amber"
              desc="Reagendamentos de vencimento" titleHint="Abre: Projetos & Etapas → Reagendamentos por projeto"
              ativo={cardSelecionado === 'alteracoes'} onClick={() => aoClicarCard('alteracoes')} />
      </div>

      {/* ABAS */}
      <div className="border-b border-gray-200 mt-6">
        <nav className="-mb-px flex space-x-8">
          <TabButton active={abaAtiva === 'TAREFAS'} onClick={() => setAbaAtiva('TAREFAS')} label="Tarefas & Equipe" />
          <TabButton active={abaAtiva === 'PROJETOS'} onClick={() => setAbaAtiva('PROJETOS')} label="Projetos & Etapas" />
          <TabButton active={abaAtiva === 'SPRINT'} onClick={() => setAbaAtiva('SPRINT')} label="Sprint" />
        </nav>
      </div>

      {/* CONTEÚDO */}
      <div className="min-h-[500px] pt-6 animate-in fade-in">
          
          {/* ABA TAREFAS */}
          {abaAtiva === 'TAREFAS' && (
             <div className="flex flex-col gap-4">
                <div className="flex flex-wrap justify-between items-center gap-4 bg-surface-highlight/10 p-4 rounded-xl border border-border">
                    <select value={relatorioTarefas} onChange={e => setRelatorioTarefas(e.target.value)} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-indigo-500 min-w-[250px]">
                        <option value="GERAL">Tarefas Gerais por Usuário</option>
                        <option value="PRODUTIVIDADE">Tarefas Concluidas por Usuário</option>
                        <option value="ATRASOS">Tarefas Atrasadas por Usuário</option>
                    </select>
                    <TypeSelector active={tipoGraficoTarefas} onChange={setTipoGraficoTarefas} />
                </div>

                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm min-h-[450px]">
                    {relatorioTarefas === 'GERAL' && (
                        <GraficoUniversal
                            type={tipoGraficoTarefas}
                            data={[...dadosUsuarios].sort((a,b) => (b.concluidas + b.atrasadas + b.pendentes) - (a.concluidas + a.atrasadas + a.pendentes)) as unknown as Record<string, unknown>[]}
                            xKey="nome"
                            bars={[
                                { key: 'concluidas', name: 'Concluídas', color: COLOR_CONCLUIDA },
                                { key: 'pendentes', name: 'Pendentes', color: COLOR_PENDENTE },
                                { key: 'atrasadas', name: 'Atrasadas', color: COLOR_ATRASADA }
                            ]}
                        />
                    )}
                    {relatorioTarefas === 'PRODUTIVIDADE' && (
                        <GraficoUniversal 
                            type={tipoGraficoTarefas} 
                            data={dadosUsuarios as unknown as Record<string, unknown>[]} 
                            xKey="nome" 
                            bars={[{ key: 'concluidas', name: 'Entregues', color: COLOR_CONCLUIDA }]} 
                        />
                    )}
                    {relatorioTarefas === 'ATRASOS' && (
                        <GraficoUniversal 
                            type={tipoGraficoTarefas} 
                            data={[...dadosUsuarios].sort((a,b) => b.atrasadas - a.atrasadas) as unknown as Record<string, unknown>[]}
                            xKey="nome" 
                            bars={[{ key: 'atrasadas', name: 'Atrasos', color: COLOR_ATRASADA }]} 
                        />
                    )}
                </div>
             </div>
          )}

          {/* ABA PROJETOS */}
          {abaAtiva === 'PROJETOS' && (
              <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap justify-between items-center gap-4 bg-surface-highlight/10 p-4 rounded-xl border border-border">
                    <select value={relatorioProjetos} onChange={e => setRelatorioProjetos(e.target.value)} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-indigo-500 min-w-[250px]">
                        <option value="STATUS_GERAL">Status Geral (Total)</option>
                        <option value="ETAPAS">Volume por Etapa</option>
                        <option value="VOLATILIDADE">Reagendamentos</option>
                    </select>
                    <TypeSelector active={tipoGraficoProjetos} onChange={setTipoGraficoProjetos} />
                </div>

                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm min-h-[450px]">
                    {relatorioProjetos === 'STATUS_GERAL' && (
                         <GraficoUniversal 
                            type={tipoGraficoProjetos}
                            data={dadosProjetos as unknown as Record<string, unknown>[]}
                            xKey="nome"
                            bars={tipoGraficoProjetos === 'PIE'
                                ? [{ key: 'total', name: 'Total de Tarefas', color: '#888' }] // Pizza usa total
                                : [
                                    { key: 'concluidas', name: 'Concluídas', color: COLOR_CONCLUIDA },
                                    { key: 'pendentes', name: 'Abertas', color: COLOR_PENDENTE },
                                    { key: 'atrasadas', name: 'Atrasadas', color: COLOR_ATRASADA }
                                ]
                            }
                         />
                    )}
                    {relatorioProjetos === 'ETAPAS' && (
                        <GraficoUniversal type={tipoGraficoProjetos} data={dadosEtapas as unknown as Record<string, unknown>[]} xKey="name" bars={[{ key: 'qtd', name: 'Volume', color: COLORS_PROJETOS[0] }]} />
                    )}
                    {relatorioProjetos === 'VOLATILIDADE' && (
                        <GraficoUniversal type={tipoGraficoProjetos} data={dadosHistorico as unknown as Record<string, unknown>[]} xKey="projeto" bars={[{ key: 'qtd', name: 'Alterações', color: COLORS_PROJETOS[1] }]} />
                    )}
                </div>
              </div>
          )}

          {/* ABA SPRINT */}
          {abaAtiva === 'SPRINT' && (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-surface border border-border rounded-xl border-dashed">
                  <div className="bg-indigo-50 p-4 rounded-full mb-4"><History className="w-8 h-8 text-indigo-500" /></div>
                  <h3 className="text-lg font-bold text-foreground">Relatório de Sprint</h3>
                  <p className="text-gray-500 max-w-md">Em breve.</p>
              </div>
          )}
      </div>

      {/* TABELAS DE DETALHAMENTO (abaixo do gráfico) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TabelaTarefasUsuario dados={dadosTarefasUsuario} />
          <TabelaEtapasProjeto dados={dadosProjetoEtapas} />
      </div>
    </div>
  )
}

// --- BADGE DE STATUS ---
const STATUS_INFO: Record<string, { label: string; cls: string }> = {
    concluidas: { label: 'Concluída', cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    atrasadas:  { label: 'Atrasada',  cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
    pendentes:  { label: 'Pendente',  cls: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
}

function StatusBadge({ status }: { status: string }) {
    const s = STATUS_INFO[status] ?? { label: status, cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
    return <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${s.cls}`}>{s.label}</span>
}

// --- TABELA: TAREFAS POR FUNCIONÁRIO ---
function TabelaTarefasUsuario({ dados }: { dados: DadosTarefasUsuario[] }) {
    const [aberto, setAberto] = useState<string | null>(null)

    return (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Users size={15} className="text-indigo-500" />
                <h2 className="text-sm font-semibold text-foreground">Tarefas por Funcionário</h2>
                <span className="text-xs bg-surface-highlight border border-border rounded-full px-2 py-0.5 text-gray-400">{dados.length}</span>
                <div className="ml-auto">
                    <BotaoExportarTarefasFuncionario dados={dados} />
                </div>
            </div>
            {dados.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">Nenhuma tarefa no período.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-gray-400 text-xs uppercase">
                            <tr>
                                <th className="text-left px-4 py-2">Funcionário</th>
                                <th className="text-right px-3 py-2">Total</th>
                                <th className="text-right px-3 py-2">Concl.</th>
                                <th className="text-right px-3 py-2">Atras.</th>
                                <th className="text-right px-3 py-2">Pend.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {dados.map(u => (
                                <Fragment key={u.nome}>
                                    <tr className="hover:bg-background/50 cursor-pointer" onClick={() => setAberto(aberto === u.nome ? null : u.nome)}>
                                        <td className="px-4 py-2.5 text-gray-300 flex items-center gap-2">
                                            <span className={`text-gray-500 transition-transform text-xs ${aberto === u.nome ? 'rotate-90' : ''}`}>▶</span>
                                            {u.nome}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-medium text-foreground">{u.total}</td>
                                        <td className="px-3 py-2.5 text-right text-emerald-500">{u.concluidas}</td>
                                        <td className="px-3 py-2.5 text-right text-red-500">{u.atrasadas}</td>
                                        <td className="px-3 py-2.5 text-right text-indigo-500">{u.pendentes}</td>
                                    </tr>
                                    {aberto === u.nome && (
                                        <tr>
                                            <td colSpan={5} className="p-0 bg-background/40">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="text-gray-500 uppercase border-b border-border">
                                                            <th className="text-left px-6 py-2">Tarefa</th>
                                                            <th className="text-left px-3 py-2">Projeto</th>
                                                            <th className="text-left px-3 py-2">Etapa</th>
                                                            <th className="text-center px-3 py-2">Status</th>
                                                            <th className="text-right px-4 py-2">Vencimento</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/50">
                                                        {u.tarefas.map((t, i) => (
                                                            <tr key={i} className="hover:bg-surface-highlight/20">
                                                                <td className="px-6 py-2 text-gray-300">{t.titulo}</td>
                                                                <td className="px-3 py-2 text-gray-400">{t.projeto}</td>
                                                                <td className="px-3 py-2 text-gray-400">{t.etapa}</td>
                                                                <td className="px-3 py-2 text-center"><StatusBadge status={t.status} /></td>
                                                                <td className="px-4 py-2 text-right text-gray-500">{t.vencimento ?? '—'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// --- TABELA: ETAPAS PENDENTES POR PROJETO ---
function TabelaEtapasProjeto({ dados }: { dados: DadosProjetoEtapas[] }) {
    const [aberto, setAberto] = useState<string | null>(null)

    return (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <LayoutDashboard size={15} className="text-indigo-500" />
                <h2 className="text-sm font-semibold text-foreground">Etapas Pendentes por Projeto</h2>
                <span className="ml-auto text-xs bg-surface-highlight border border-border rounded-full px-2 py-0.5 text-gray-400">{dados.length}</span>
            </div>
            {dados.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">Nenhuma etapa pendente no período.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-gray-400 text-xs uppercase">
                            <tr>
                                <th className="text-left px-4 py-2">Projeto</th>
                                <th className="text-right px-3 py-2">Etapas</th>
                                <th className="text-right px-3 py-2">Concl.</th>
                                <th className="text-right px-3 py-2">Atras.</th>
                                <th className="text-right px-3 py-2">Pend.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {dados.map(p => {
                                const concl = p.etapas.reduce((acc, e) => acc + e.concluidas, 0)
                                const pend = p.etapas.reduce((acc, e) => acc + e.pendentes, 0)
                                const atras = p.etapas.reduce((acc, e) => acc + e.atrasadas, 0)
                                return (
                                    <Fragment key={p.nome}>
                                        <tr className="hover:bg-background/50 cursor-pointer" onClick={() => setAberto(aberto === p.nome ? null : p.nome)}>
                                            <td className="px-4 py-2.5 text-gray-300 flex items-center gap-2">
                                                <span className={`text-gray-500 transition-transform text-xs ${aberto === p.nome ? 'rotate-90' : ''}`}>▶</span>
                                                {p.nome}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-medium text-foreground">{p.etapas.length}</td>
                                            <td className="px-3 py-2.5 text-right text-emerald-500">{concl}</td>
                                            <td className="px-3 py-2.5 text-right text-red-500">{atras}</td>
                                            <td className="px-3 py-2.5 text-right text-indigo-500">{pend}</td>
                                        </tr>
                                        {aberto === p.nome && (
                                            <tr>
                                                <td colSpan={5} className="p-0 bg-background/40">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="text-gray-500 uppercase border-b border-border">
                                                                <th className="text-left px-6 py-2">Etapa</th>
                                                                <th className="text-left px-3 py-2">Tarefa</th>
                                                                <th className="text-center px-3 py-2">Status</th>
                                                                <th className="text-right px-4 py-2">Vencimento</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border/50">
                                                            {p.etapas.flatMap(e =>
                                                                e.tarefas.map((t, i) => (
                                                                    <tr key={`${e.nome}-${i}`} className="hover:bg-surface-highlight/20">
                                                                        <td className="px-6 py-2 text-gray-300">{e.nome}</td>
                                                                        <td className="px-3 py-2 text-gray-400">{t.titulo}</td>
                                                                        <td className="px-3 py-2 text-center"><StatusBadge status={t.status} /></td>
                                                                        <td className="px-4 py-2 text-right text-gray-500">{t.vencimento ?? '—'}</td>
                                                                    </tr>
                                                                ))
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// --- GRÁFICO UNIVERSAL ---
function GraficoUniversal({ type, data, xKey, bars }: GraficoUniversalProps) {

    const dadosLimpos = data?.filter((item) => {
        const totalItem = bars.reduce((acc: number, b) => acc + ((item[b.key] as number) || 0), 0)
        return totalItem > 0
    }) || []

    if (dadosLimpos.length === 0) {
        return (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-gray-400 animate-in fade-in">
                <div className="bg-gray-100 p-4 rounded-full mb-3 dark:bg-gray-800"><CheckCircle2 size={40} className="text-gray-400" /></div>
                <p className="font-medium text-lg">Sem dados relevantes</p>
                <p className="text-sm">Nenhum registro encontrado com valor maior que zero.</p>
            </div>
        )
    }

    const barrasAtivas = bars.filter((b) => {
        if (type === 'PIE') return true
        const somaTotalMetrica = dadosLimpos.reduce((acc: number, item) => acc + ((item[b.key] as number) || 0), 0)
        return somaTotalMetrica > 0
    })

    if (type === 'BAR') {
        return (
            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={dadosLimpos} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey={xKey} fontSize={11} interval={0} textAnchor="end" height={60} tick={{fill: 'var(--color-foreground)', fontSize: 12, fontWeight: 600}}/>
                    <YAxis />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend />
                    {barrasAtivas.map((b) => (
                        <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4,4,0,0]} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        )
    }

    if (type === 'LINE') {
        return (
            <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dadosLimpos} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey={xKey} fontSize={11} interval={0} textAnchor="end" height={60} tick={{fill: 'var(--color-foreground)', fontSize: 12, fontWeight: 600}}/>
                    <YAxis />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                    <Legend />
                    {barrasAtivas.map((b) => (
                        <Line key={b.key} type="monotone" dataKey={b.key} name={b.name} stroke={b.color} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        )
    }

    if (type === 'PIE') {
        const metricaPrincipal = barrasAtivas[0];

        return (
            <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                    <Pie
                        data={dadosLimpos}
                        cx="50%" cy="50%"
                        innerRadius={80}
                        outerRadius={140}
                        paddingAngle={5}
                        dataKey={metricaPrincipal.key} 
                        nameKey={xKey === 'name' ? 'name' : xKey}
                        label={false} // Clean (sem texto na pizza)
                    >
                        {dadosLimpos.map((_entry, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS_PROJETOS[index % COLORS_PROJETOS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend /> 
                </PieChart>
            </ResponsiveContainer>
        )
    }

    return null
}

interface TypeSelectorProps {
  active: 'BAR' | 'LINE' | 'PIE'
  onChange: (t: 'BAR' | 'LINE' | 'PIE') => void
}

function TypeSelector({ active, onChange }: TypeSelectorProps) {
    return (
        <div className="flex bg-surface border border-border rounded-lg p-1 gap-1">
            <button onClick={() => onChange('BAR')} title="Gráfico de Barras" className={`p-2 rounded-md transition-colors ${active === 'BAR' ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-foreground'}`}><BarChart3 size={18} /></button>
            <button onClick={() => onChange('LINE')} title="Gráfico de Linhas" className={`p-2 rounded-md transition-colors ${active === 'LINE' ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-foreground'}`}><IconLine size={18} /></button>
            <button onClick={() => onChange('PIE')} title="Gráfico de Pizza" className={`p-2 rounded-md transition-colors ${active === 'PIE' ? 'bg-indigo-100 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-foreground'}`}><IconPie size={18} /></button>
        </div>
    )
}

type CorKPI = 'indigo' | 'emerald' | 'red' | 'amber'

interface CardKPIProps {
  titulo: string
  valor: number
  sub?: string
  desc?: string
  titleHint?: string
  icon: React.ReactNode
  cor: CorKPI
  ativo?: boolean
  onClick?: () => void
}

function CardKPI({ titulo, valor, sub, desc, titleHint, icon, cor, ativo, onClick }: CardKPIProps) {
    const cores: Record<CorKPI, string> = { indigo: 'bg-indigo-50 text-indigo-600', emerald: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-600', amber: 'bg-amber-50 text-amber-600' }
    const anel: Record<CorKPI, string> = { indigo: 'ring-indigo-500', emerald: 'ring-emerald-500', red: 'ring-red-500', amber: 'ring-amber-500' }
    const clicavel = typeof onClick === 'function'
    return (
        <button
            type="button"
            onClick={onClick}
            title={titleHint}
            aria-pressed={clicavel ? !!ativo : undefined}
            className={`flex flex-col text-left w-full bg-surface border rounded-xl p-5 shadow-sm transition-all ${
                clicavel ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'
            } ${ativo ? `border-transparent ring-2 ${anel[cor]}` : 'border-border'}`}
        >
            <div className="flex justify-between items-start w-full">
                <div>
                    <p className="text-xs font-bold text-text-muted uppercase tracking-wider">{titulo}</p>
                    <h3 className="text-2xl font-bold text-foreground mt-1">{valor}</h3>
                    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
                </div>
                <div className={`p-2 rounded-lg ${cores[cor]}`}>{icon}</div>
            </div>
            {desc && <p className="text-[11px] leading-tight text-text-muted mt-3">{desc}</p>}
        </button>
    )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  label: string
}

function TabButton({ active, onClick, label }: TabButtonProps) {
    return (
        <button onClick={onClick} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${active ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
        </button>
    )
}