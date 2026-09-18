'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, CheckCircle, XCircle, Trash2, Search, ChevronDown, ChevronLeft, ChevronRight, FileDown, RotateCcw } from 'lucide-react'
import { pagarLancamento, estornarPagamento, cancelarLancamento, excluirLancamento, excluirEAvancarRecorrencia, excluirGrupoParcelas, excluirParcelasAPartirDesta, getLancamentosFinanceiros } from '@/app/actions'
import ModalLancamento from '@/components/financeiro/ModalLancamento'
import ModalPreviewPdf from '@/components/ModalPreviewPdf'
import { gerarPdfLancamentos } from '@/lib/pdf-lancamentos'
import type { LancamentoComRelacoes, PlanoContas, Banco, TipoLancamento, StatusLancamento } from '@/types'

interface Props {
  equipeId: string
  lancamentos: LancamentoComRelacoes[]
  planoContas: PlanoContas[]
  bancos: Banco[]
  tipo: TipoLancamento
}

const STATUS_LABEL: Record<StatusLancamento, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
}

const STATUS_COR: Record<StatusLancamento, string> = {
  PENDENTE: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  PAGO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELADO: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function SeletorMes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const [ano, setAno] = useState(() => value === 'TODOS' ? new Date().getFullYear() : Number(value.split('-')[0]))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value !== 'TODOS') setAno(Number(value.split('-')[0]))
  }, [value])

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  const label = value === 'TODOS'
    ? 'Todos os meses'
    : new Date(Number(value.split('-')[0]), Number(value.split('-')[1]) - 1, 1)
        .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto(v => !v)}
        className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize flex items-center gap-2 whitespace-nowrap"
      >
        {label}
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>

      {aberto && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-surface border border-border rounded-xl shadow-2xl p-3 w-56">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setAno(a => a - 1)} className="p-1 text-gray-400 hover:text-foreground transition-colors rounded">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold">{ano}</span>
            <button onClick={() => setAno(a => a + 1)} className="p-1 text-gray-400 hover:text-foreground transition-colors rounded">
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {MESES_ABREV.map((m, i) => {
              const val = `${ano}-${String(i + 1).padStart(2, '0')}`
              const ativo = value === val
              return (
                <button
                  key={m}
                  onClick={() => { onChange(val); setAberto(false) }}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${ativo ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-surface-highlight'}`}
                >
                  {m}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => { onChange('TODOS'); setAberto(false) }}
            className={`mt-2 w-full py-1.5 rounded-lg text-xs transition-colors ${value === 'TODOS' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-foreground hover:bg-surface-highlight'}`}
          >
            Todos os meses
          </button>
        </div>
      )}
    </div>
  )
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  const d = new Date(data)
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}


export default function LancamentosView({ equipeId, lancamentos: inicial, planoContas, bancos, tipo }: Props) {
  const [lancamentos, setLancamentos] = useState(inicial)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<LancamentoComRelacoes | null>(null)
  const [modalPagar, setModalPagar] = useState<string | null>(null)
  const [dtPagamento, setDtPagamento] = useState(new Date().toISOString().split('T')[0])
  const [modalExcluirRecorrente, setModalExcluirRecorrente] = useState<string | null>(null)
  const [modalExcluirGrupo, setModalExcluirGrupo] = useState<LancamentoComRelacoes | null>(null)
  const [modalEstornar, setModalEstornar] = useState<LancamentoComRelacoes | null>(null)
  const [estornando, setEstornando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusLancamento | 'TODOS'>('TODOS')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS')
  const [filtroBanco, setFiltroBanco] = useState<string>('TODOS')
  const [filtroMes, setFiltroMes] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [modoData, setModoData] = useState<'MES' | 'PERIODO'>('MES')
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('')
  const [filtroDataFim, setFiltroDataFim] = useState<string>('')
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)

  const montado = useRef(false)

  const recarregarLancamentos = useCallback(async () => {
    try {
      let dataInicio: string | undefined
      let dataFim: string | undefined
      if (modoData === 'PERIODO') {
        if (filtroDataInicio && filtroDataFim) {
          dataInicio = filtroDataInicio
          dataFim = filtroDataFim
        }
      } else if (filtroMes !== 'TODOS') {
        const [ano, mes] = filtroMes.split('-')
        dataInicio = `${ano}-${mes}-01`
        const ultimo = new Date(Number(ano), Number(mes), 0)
        dataFim = `${ano}-${mes}-${String(ultimo.getDate()).padStart(2, '0')}`
      }
      const atualizados = await getLancamentosFinanceiros(equipeId, tipo, {
        dataInicio,
        dataFim,
        status: filtroStatus,
        plano_contas_id: filtroCategoria,
        banco_id: filtroBanco,
      })
      setLancamentos(atualizados as never)
    } catch {
      toast.error('Erro ao carregar lançamentos.')
    }
  }, [equipeId, tipo, modoData, filtroMes, filtroDataInicio, filtroDataFim, filtroStatus, filtroCategoria, filtroBanco])

  useEffect(() => {
    if (!montado.current) { montado.current = true; return }
    recarregarLancamentos()
  }, [recarregarLancamentos])


  const lancamentosFiltrados = useMemo(() => {
    if (busca === '') return lancamentos
    const q = busca.toLowerCase()
    return lancamentos.filter(l =>
      l.descricao.toLowerCase().includes(q) || (l.beneficiario ?? '').toLowerCase().includes(q)
    )
  }, [lancamentos, busca])

  const somaParciais = (l: LancamentoComRelacoes) => (l.parciais ?? []).reduce((s, p) => s + Number(p.valor), 0)
  // Pendente = saldo restante (valor - parciais já pagos). Sem parcial, é o valor cheio.
  const totalPendente = lancamentos
    .filter(l => l.status === 'PENDENTE')
    .reduce((s, l) => s + Math.max(0, Number(l.valor) - somaParciais(l)), 0)
  // Pago/Recebido = lançamentos quitados + a parte já paga dos parciais em aberto.
  const totalPago = lancamentos.filter(l => l.status === 'PAGO').reduce((s, l) => s + Number(l.valor), 0)
    + lancamentos.filter(l => l.status === 'PENDENTE').reduce((s, l) => s + somaParciais(l), 0)

  async function handlePagar() {
    if (!modalPagar) return
    const isRecorrente = lancamentos.find(l => l.id === modalPagar)?.recorrencia !== 'NAO'
    const resultado = await pagarLancamento(modalPagar, dtPagamento, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success(isRecorrente ? 'Pago. Próximo lançamento criado.' : 'Lançamento marcado como pago.')
    if (isRecorrente) {
      await recarregarLancamentos()
    } else {
      setLancamentos(prev => prev.map(l => l.id === modalPagar ? { ...l, status: 'PAGO', dt_pagamento: dtPagamento } : l))
    }
    setModalPagar(null)
  }

  async function handleCancelar(id: string) {
    if (!confirm('Cancelar este lançamento?')) return
    const resultado = await cancelarLancamento(id, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success('Lançamento cancelado.')
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status: 'CANCELADO' } : l))
  }

  async function handleConfirmarEstorno() {
    if (!modalEstornar) return
    setEstornando(true)
    const resultado = await estornarPagamento(modalEstornar.id, equipeId)
    setEstornando(false)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success(tipo === 'DESPESA' ? 'Pagamento estornado.' : 'Recebimento estornado.')
    setModalEstornar(null)
    await recarregarLancamentos()
  }

  async function handleExcluir(id: string) {
    const lancamento = lancamentos.find(l => l.id === id)
    if (!lancamento) return
    if (lancamento.grupo_parcela_id) {
      setModalExcluirGrupo(lancamento)
      return
    }
    if (lancamento.recorrencia !== 'NAO') {
      setModalExcluirRecorrente(id)
      return
    }
    if (!confirm('Excluir este lançamento permanentemente?')) return
    const resultado = await excluirLancamento(id, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success('Lançamento excluído.')
    setLancamentos(prev => prev.filter(l => l.id !== id))
  }

  async function handleExcluirSoParcela(id: string) {
    const resultado = await excluirLancamento(id, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success('Parcela excluída.')
    setLancamentos(prev => prev.filter(l => l.id !== id))
    setModalExcluirGrupo(null)
  }

  async function handleExcluirGrupoParcelas(grupo_parcela_id: string) {
    const resultado = await excluirGrupoParcelas(grupo_parcela_id, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success('Todas as parcelas do grupo foram excluídas.')
    setLancamentos(prev => prev.filter(l => l.grupo_parcela_id !== grupo_parcela_id))
    setModalExcluirGrupo(null)
  }

  async function handleExcluirAPartirDesta(lancamento: LancamentoComRelacoes) {
    const resultado = await excluirParcelasAPartirDesta(lancamento.id, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success('Parcelas excluídas a partir desta.')
    await recarregarLancamentos()
    setModalExcluirGrupo(null)
  }

  async function handleExcluirSomenteEste(id: string) {
    const resultado = await excluirLancamento(id, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success('Lançamento excluído. Recorrência encerrada.')
    setLancamentos(prev => prev.filter(l => l.id !== id))
    setModalExcluirRecorrente(null)
  }

  async function handleExcluirEAvancar(id: string) {
    const resultado = await excluirEAvancarRecorrencia(id, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success('Lançamento excluído. Próximo gerado.')
    await recarregarLancamentos()
    setModalExcluirRecorrente(null)
  }

  const corPrincipal = tipo === 'DESPESA' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
  const hoje = new Date().toISOString().split('T')[0]

  function isVencido(l: LancamentoComRelacoes) {
    if (l.status !== 'PENDENTE') return false
    return new Date(l.dt_vencimento) < new Date(hoje)
  }

  const labelPeriodo = modoData === 'PERIODO'
    ? (filtroDataInicio && filtroDataFim ? `${formatarData(filtroDataInicio)} até ${formatarData(filtroDataFim)}` : 'Todos os períodos')
    : filtroMes === 'TODOS'
      ? 'Todos os meses'
      : new Date(Number(filtroMes.split('-')[0]), Number(filtroMes.split('-')[1]) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function handleExportarPdf() {
    if (lancamentosFiltrados.length === 0) {
      toast.error('Não há lançamentos para exportar com os filtros atuais.')
      return
    }
    const blob = gerarPdfLancamentos({ lancamentos: lancamentosFiltrados, tipo, labelPeriodo })
    setPdfBlob(blob)
  }

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Pendente</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{formatarMoeda(totalPendente)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">{tipo === 'DESPESA' ? 'Pago' : 'Recebido'}</p>
          <p className={`text-2xl font-bold mt-1 ${tipo === 'DESPESA' ? 'text-red-400' : 'text-emerald-400'}`}>{formatarMoeda(totalPago)}</p>
        </div>
      </div>

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por descrição ou beneficiário..."
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
        >
          <option value="TODAS">Todas as categorias</option>
          {planoContas.map(c => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <select
          value={filtroBanco}
          onChange={e => setFiltroBanco(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
        >
          <option value="TODOS">Todos os bancos</option>
          <option value="SEM_BANCO">Sem banco</option>
          {bancos.map(b => (
            <option key={b.id} value={b.id}>{b.nome}</option>
          ))}
        </select>
        <div className="relative inline-flex flex-shrink-0 bg-surface border border-border rounded-lg p-1">
          <div
            className={`absolute top-1 left-1 h-[calc(100%-0.5rem)] w-24 rounded-md bg-indigo-600 transition-transform duration-200 ease-out ${modoData === 'PERIODO' ? 'translate-x-24' : 'translate-x-0'}`}
          />
          <button
            onClick={() => setModoData('MES')}
            className={`relative z-10 w-24 py-1.5 rounded-md text-sm font-medium transition-colors ${modoData === 'MES' ? 'text-white' : 'text-gray-400 hover:text-foreground'}`}
          >
            Por mês
          </button>
          <button
            onClick={() => setModoData('PERIODO')}
            className={`relative z-10 w-24 py-1.5 rounded-md text-sm font-medium transition-colors ${modoData === 'PERIODO' ? 'text-white' : 'text-gray-400 hover:text-foreground'}`}
          >
            Por período
          </button>
        </div>
        {modoData === 'MES' ? (
          <SeletorMes value={filtroMes} onChange={setFiltroMes} />
        ) : (
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <input
              type="date"
              value={filtroDataInicio}
              onChange={e => setFiltroDataInicio(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-gray-400 text-sm">até</span>
            <input
              type="date"
              value={filtroDataFim}
              onChange={e => setFiltroDataFim(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
        <select
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value as StatusLancamento | 'TODOS')}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-shrink-0"
        >
          <option value="TODOS">Todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="PAGO">{tipo === 'DESPESA' ? 'Pago' : 'Recebido'}</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
        <button
          onClick={() => { setEditando(null); setShowModal(true) }}
          className={`flex items-center gap-2 ${corPrincipal} text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0`}
        >
          <Plus size={16} /> {tipo === 'DESPESA' ? 'Nova Despesa' : 'Nova Receita'}
        </button>
        <button
          onClick={handleExportarPdf}
          className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-highlight transition-colors flex-shrink-0"
        >
          <FileDown size={16} /> Exportar PDF
        </button>
      </div>

      {/* Tabela */}
      {lancamentosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm border border-dashed border-border rounded-xl">
          Nenhum lançamento encontrado.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] leading-tight">
              <thead className="bg-surface text-gray-400 text-[9px] uppercase">
                <tr>
                  <th className="text-left px-1.5 py-1.5">Descrição</th>
                  {tipo === 'DESPESA' && <th className="text-left px-1.5 py-1.5">Beneficiário</th>}
                  <th className="text-left px-1.5 py-1.5">Categoria</th>
                  <th className="text-left px-1.5 py-1.5">Banco</th>
                  <th className="text-right px-1.5 py-1.5">Saldo Ant.</th>
                  <th className="text-right px-1.5 py-1.5">Saldo Atual</th>
                  <th className="text-right px-1.5 py-1.5">Valor</th>
                  <th className="text-right px-1.5 py-1.5">Parciais</th>
                  <th className="text-right px-1.5 py-1.5">Restante</th>
                  <th className="text-center px-1.5 py-1.5">Vencto.</th>
                  <th className="text-center px-1.5 py-1.5">Pagto.</th>
                  <th className="text-center px-1.5 py-1.5">Nº Doc.</th>
                  <th className="text-center px-1.5 py-1.5">Status</th>
                  <th className="px-1.5 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lancamentosFiltrados.map(l => (
                  <tr
                    key={l.id}
                    onClick={() => { setEditando(l); setShowModal(true) }}
                    className={`hover:bg-surface/50 transition-colors cursor-pointer ${isVencido(l) ? 'bg-red-500/5' : ''}`}
                  >
                    <td className="px-1.5 py-1.5 max-w-[130px]">
                      <div className="font-medium text-foreground truncate" title={l.descricao}>{l.descricao}</div>
                      {l.numero_parcelas && l.numero_parcelas > 1 && (
                        <div className="text-gray-500">{l.parcela_atual}/{l.numero_parcelas}x</div>
                      )}
                      {isVencido(l) && <div className="text-red-400">Vencido</div>}
                    </td>
                    {tipo === 'DESPESA' && (
                      <td className="px-1.5 py-1.5 text-gray-400 max-w-[90px] truncate" title={l.beneficiario ?? undefined}>{l.beneficiario ?? '—'}</td>
                    )}
                    <td className="px-1.5 py-1.5 text-gray-400 max-w-[90px] truncate" title={l.plano_contas.nome}>{l.plano_contas.nome}</td>
                    <td className="px-1.5 py-1.5 text-gray-400 max-w-[80px] truncate" title={l.banco?.nome}>{l.banco?.nome ?? '—'}</td>
                    <td className="px-1.5 py-1.5 text-right text-gray-400 whitespace-nowrap">{l.saldo_anterior !== null ? formatarMoeda(l.saldo_anterior) : '—'}</td>
                    <td className="px-1.5 py-1.5 text-right text-gray-400 whitespace-nowrap">{l.saldo_atual !== null ? formatarMoeda(l.saldo_atual) : '—'}</td>
                    <td className={`px-1.5 py-1.5 text-right font-semibold whitespace-nowrap ${tipo === 'DESPESA' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {formatarMoeda(Number(l.valor))}
                    </td>
                    <td className="px-1.5 py-1.5 text-right text-gray-400 whitespace-nowrap">
                      {somaParciais(l) > 0 ? formatarMoeda(somaParciais(l)) : '—'}
                    </td>
                    <td className={`px-1.5 py-1.5 text-right font-semibold whitespace-nowrap ${tipo === 'DESPESA' ? 'text-red-400' : 'text-emerald-400'}`}>
                      {somaParciais(l) > 0 ? formatarMoeda(Math.max(0, Number(l.valor) - somaParciais(l))) : '—'}
                    </td>
                    <td className="px-1.5 py-1.5 text-center text-gray-300 whitespace-nowrap">{formatarData(l.dt_vencimento)}</td>
                    <td className="px-1.5 py-1.5 text-center text-gray-400 whitespace-nowrap">
                      {l.dt_pagamento ? formatarData(l.dt_pagamento) : '—'}
                    </td>
                    <td className="px-1.5 py-1.5 text-center text-gray-400 max-w-[70px] truncate" title={l.numero_documento ?? undefined}>{l.numero_documento ?? '—'}</td>
                    <td className="px-1.5 py-1.5 text-center whitespace-nowrap">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full border ${STATUS_COR[l.status]}`}>
                        {STATUS_LABEL[l.status]}
                      </span>
                    </td>
                    <td className="px-1 py-1.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-0.5 justify-end">
                        {l.status === 'PENDENTE' && (
                          <>
                            <button
                              onClick={() => { setModalPagar(l.id); setDtPagamento(new Date().toISOString().split('T')[0]) }}
                              className="p-1 text-gray-400 hover:text-emerald-400 transition-colors"
                              title={tipo === 'DESPESA' ? 'Registrar pagamento' : 'Registrar recebimento'}
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button
                              onClick={() => handleCancelar(l.id)}
                              className="p-1 text-gray-400 hover:text-yellow-400 transition-colors"
                              title="Cancelar"
                            >
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                        {l.status === 'PAGO' && (
                          <button
                            onClick={() => setModalEstornar(l)}
                            className="p-1 text-gray-400 hover:text-yellow-400 transition-colors"
                            title={tipo === 'DESPESA' ? 'Estornar pagamento' : 'Estornar recebimento'}
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => handleExcluir(l.id)}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      {showModal && (
        <ModalLancamento
          equipeId={equipeId}
          tipo={tipo}
          planoContas={planoContas}
          bancos={bancos}
          lancamento={editando ?? undefined}
          onClose={() => { setShowModal(false); setEditando(null) }}
          onSuccess={recarregarLancamentos}
        />
      )}

      {/* Modal excluir grupo de parcelas */}
      {modalExcluirGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold">Excluir Parcela</h2>
              <p className="text-sm text-gray-400 mt-1">
                Este lançamento faz parte de um grupo de <strong className="text-foreground">{modalExcluirGrupo.numero_parcelas}x parcelas</strong>. O que deseja excluir?
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleExcluirSoParcela(modalExcluirGrupo.id)}
                className="w-full py-2.5 rounded-lg bg-surface border border-border hover:bg-surface-highlight text-sm font-medium transition-colors text-left px-4"
              >
                <div className="font-medium text-foreground">Só esta parcela</div>
                <div className="text-xs text-gray-500 mt-0.5">Parcela {modalExcluirGrupo.parcela_atual} de {modalExcluirGrupo.numero_parcelas}</div>
              </button>
              <button
                onClick={() => handleExcluirAPartirDesta(modalExcluirGrupo)}
                className="w-full py-2.5 rounded-lg bg-surface border border-border hover:bg-surface-highlight text-sm font-medium transition-colors text-left px-4"
              >
                <div className="font-medium text-foreground">Esta e as próximas parcelas</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Remove as parcelas {modalExcluirGrupo.parcela_atual} a {modalExcluirGrupo.numero_parcelas} (somente pendentes)
                </div>
              </button>
              <button
                onClick={() => handleExcluirGrupoParcelas(modalExcluirGrupo.grupo_parcela_id!)}
                className="w-full py-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-medium transition-colors text-left px-4"
              >
                <div className="font-medium">Todas as parcelas do grupo</div>
                <div className="text-xs text-red-300/70 mt-0.5">Remove as {modalExcluirGrupo.numero_parcelas}x parcelas permanentemente</div>
              </button>
            </div>
            <button onClick={() => setModalExcluirGrupo(null)} className="w-full py-2 rounded-lg border border-border text-sm text-gray-400 hover:text-foreground hover:bg-surface-highlight transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal excluir recorrente */}
      {modalExcluirRecorrente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold">Lançamento Recorrente</h2>
              <p className="text-sm text-gray-400 mt-1">O que deseja fazer com este lançamento?</p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleExcluirEAvancar(modalExcluirRecorrente)}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors text-left px-4"
              >
                <div className="font-medium">Excluir só este</div>
                <div className="text-xs text-indigo-200 mt-0.5">Remove este e gera o próximo automaticamente</div>
              </button>
              <button
                onClick={() => handleExcluirSomenteEste(modalExcluirRecorrente)}
                className="w-full py-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-medium transition-colors text-left px-4"
              >
                <div className="font-medium">Cancelar a recorrência</div>
                <div className="text-xs text-red-300/70 mt-0.5">Remove este e não cria mais nenhum</div>
              </button>
            </div>
            <button onClick={() => setModalExcluirRecorrente(null)} className="w-full py-2 rounded-lg border border-border text-sm text-gray-400 hover:text-foreground hover:bg-surface-highlight transition-colors">
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* Modal registrar pagamento */}
      {modalPagar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold mb-4">
              {tipo === 'DESPESA' ? 'Registrar Pagamento' : 'Registrar Recebimento'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Data do {tipo === 'DESPESA' ? 'Pagamento' : 'Recebimento'}
                </label>
                <input
                  type="date"
                  value={dtPagamento}
                  onChange={e => setDtPagamento(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModalPagar(null)} className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
                  Cancelar
                </button>
                <button onClick={handlePagar} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal estornar pagamento */}
      {modalEstornar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-4">
                <RotateCcw size={22} className="text-yellow-400" />
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Estornar {tipo === 'DESPESA' ? 'pagamento' : 'recebimento'}?
              </h2>
              <p className="text-sm text-gray-400 mt-2">
                <span className="text-foreground font-medium">{modalEstornar.descricao}</span>
                {' — '}
                <span className={tipo === 'DESPESA' ? 'text-red-400' : 'text-emerald-400'}>{formatarMoeda(Number(modalEstornar.valor))}</span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                O lançamento volta para <span className="font-medium text-yellow-400">Pendente</span>
                {modalEstornar.banco ? <> e o valor retorna ao saldo do banco <span className="font-medium text-foreground">{modalEstornar.banco.nome}</span></> : null}.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setModalEstornar(null)}
                disabled={estornando}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarEstorno}
                disabled={estornando}
                className="flex-1 py-2.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {estornando ? 'Estornando...' : 'Estornar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal preview PDF */}
      {pdfBlob && (
        <ModalPreviewPdf
          pdfBlob={pdfBlob}
          onClose={() => setPdfBlob(null)}
        />
      )}
    </div>
  )
}
