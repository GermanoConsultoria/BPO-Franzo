'use client'

import { Fragment, useState, useRef, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown, FileDown } from 'lucide-react'
import jsPDF from 'jspdf'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts'
import ModalPreviewPdf from '@/components/ModalPreviewPdf'
import { gerarPdfContaResumo, gerarPdfContaDetalhado } from '@/lib/pdf-balancete-conta'
import type { Balancete, ContratoEncerrando } from '@/types'

const COR_EXPORT = {
  fundo: '#18181b',
  superficie: '#27272a',
  borda: '#3f3f46',
  texto: '#f4f4f5',
  textoMuted: '#9ca3af',
  emerald: '#34d399',
  red: '#f87171',
  indigo: '#818cf8',
  yellow: '#facc15',
  orange: '#fb923c',
}

interface Props {
  equipeId: string
  nomeCliente: string
  balancete: Balancete | null
  dataInicio: string
  dataFim: string
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function CardResumo({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${cor}`}>{formatarMoeda(valor)}</p>
    </div>
  )
}

/** Versão do card com cor via inline style (hex), usada só no bloco oculto de captura do PDF geral. */
function CardExport({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div style={{ backgroundColor: COR_EXPORT.superficie, border: `1px solid ${COR_EXPORT.borda}`, borderRadius: 10, padding: 10 }}>
      <p style={{ fontSize: 9, color: COR_EXPORT.textoMuted, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: cor, margin: '3px 0 0 0' }}>{formatarMoeda(valor)}</p>
    </div>
  )
}

function ChartBlockExport({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div style={{ backgroundColor: COR_EXPORT.superficie, border: `1px solid ${COR_EXPORT.borda}`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: COR_EXPORT.texto, margin: '0 0 8px 0' }}>{titulo}</p>
      {children}
    </div>
  )
}

const TooltipCustom = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold mb-2 text-foreground">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatarMoeda(p.value)}</p>
      ))}
    </div>
  )
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function SeletorMesBalancete({ value, onSelecionar }: { value: string; onSelecionar: (mesAno: string) => void }) {
  const [aberto, setAberto] = useState(false)
  const [ano, setAno] = useState(() => Number(value.split('-')[0]))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setAno(Number(value.split('-')[0]))
  }, [value])

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  const mesSelAtual = Number(value.split('-')[1]) - 1
  const label = `${MESES_ABREV[mesSelAtual]} / ${value.split('-')[0]}`

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAberto(v => !v)} className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm hover:border-gray-500 transition-colors">
        {label} <ChevronDown size={14} className="text-gray-400" />
      </button>
      {aberto && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-surface border border-border rounded-xl shadow-2xl p-3 w-56">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setAno(a => a - 1)} className="p-1 text-gray-400 hover:text-foreground transition-colors"><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold">{ano}</span>
            <button onClick={() => setAno(a => a + 1)} className="p-1 text-gray-400 hover:text-foreground transition-colors"><ChevronRight size={15} /></button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MESES_ABREV.map((m, i) => {
              const val = `${ano}-${String(i + 1).padStart(2, '0')}`
              const ativo = value === val
              return (
                <button key={m} onClick={() => { onSelecionar(val); setAberto(false) }}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${ativo ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-surface-highlight'}`}>
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BalanceteView({ equipeId, nomeCliente, balancete, dataInicio, dataFim }: Props) {
  const router = useRouter()
  const [modo, setModo] = useState<'mes' | 'ano' | 'periodo'>('mes')
  const [anoSel, setAnoSel] = useState(new Date().getFullYear())
  const [mesAnoSel, setMesAnoSel] = useState(() => dataInicio.slice(0, 7))
  const [periodoIni, setPeriodoIni] = useState(dataInicio)
  const [periodoFim, setPeriodoFim] = useState(dataFim)
  const [tipoGrafico, setTipoGrafico] = useState<'barra' | 'linha' | 'pizza'>('barra')
  const [preparandoExportGeral, setPreparandoExportGeral] = useState(false)
  const [gerandoPdfGeral, setGerandoPdfGeral] = useState(false)
  const [pdfBlobGeral, setPdfBlobGeral] = useState<Blob | null>(null)
  const exportGeralRef = useRef<HTMLDivElement>(null)

  function navegar(ini: string, fim: string) {
    router.push(`/equipe/${equipeId}/financeiro/balancete?inicio=${ini}&fim=${fim}`)
  }

  function aplicarAno(ano: number) {
    setAnoSel(ano)
    navegar(`${ano}-01-01`, `${ano}-12-31`)
  }

  function aplicarMes(mesAno: string) {
    setMesAnoSel(mesAno)
    const [ano, mes] = mesAno.split('-').map(Number)
    const ultimoDia = new Date(ano, mes, 0).getDate()
    navegar(`${mesAno}-01`, `${mesAno}-${String(ultimoDia).padStart(2, '0')}`)
  }

  function handleExportarGeral() {
    setGerandoPdfGeral(true)
    setPreparandoExportGeral(true)
  }

  useEffect(() => {
    if (!preparandoExportGeral) return
    let cancelado = false
    ;(async () => {
      // espera o layout e o desenho dos gráficos (Recharts) antes de capturar
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      await new Promise(r => setTimeout(r, 150))
      if (cancelado || !exportGeralRef.current) return

      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(exportGeralRef.current, {
        backgroundColor: COR_EXPORT.fundo,
        scale: 2,
      })
      if (cancelado) return

      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margemX = 10
      const margemTopoOutras = 10
      const topoPrimeiraPagina = 34
      const imgWidth = pageWidth - margemX * 2
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const imgData = canvas.toDataURL('image/png')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(20)
      doc.text('Balancete', 14, 16)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(70)
      doc.text(nomeCliente, 14, 23)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(110)
      const labelPeriodoEfeito = `${new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} até ${new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`
      doc.text(`Período: ${labelPeriodoEfeito}`, 14, 29)

      doc.addImage(imgData, 'PNG', margemX, topoPrimeiraPagina, imgWidth, imgHeight)
      let restante = imgHeight - (pageHeight - topoPrimeiraPagina)

      while (restante > 0) {
        doc.addPage()
        const mostrado = imgHeight - restante
        const posicaoY = margemTopoOutras - mostrado
        doc.addImage(imgData, 'PNG', margemX, posicaoY, imgWidth, imgHeight)
        restante -= (pageHeight - margemTopoOutras)
      }

      setPdfBlobGeral(doc.output('blob'))
      setPreparandoExportGeral(false)
      setGerandoPdfGeral(false)
    })()
    return () => { cancelado = true }
  }, [preparandoExportGeral, dataInicio, dataFim, nomeCliente])

  if (!balancete) {
    return <p className="text-center text-gray-500 py-12">Erro ao carregar balancete.</p>
  }

  const b = balancete
  const labelPeriodo = `${new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} até ${new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`
  const dadosPizzaExport = [
    { name: 'Receitas', value: b.receitas, color: '#10b981' },
    { name: 'Despesas', value: b.despesas, color: '#ef4444' },
    ...(b.lucro > 0 ? [{ name: 'Lucro', value: b.lucro, color: '#6366f1' }] : []),
  ].filter(d => d.value > 0)
  const totalPizzaExport = dadosPizzaExport.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-6">
      {/* Filtro */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['mes', 'ano', 'periodo'] as const).map(m => (
            <button key={m}
              onClick={() => {
                setModo(m)
                if (m === 'ano') aplicarAno(anoSel)
                if (m === 'mes') aplicarMes(mesAnoSel)
              }}
              className={`px-4 py-2 text-xs font-medium transition-colors ${modo === m ? 'bg-indigo-600 text-white' : 'bg-surface text-gray-400 hover:text-foreground hover:bg-surface-highlight'}`}>
              {m === 'mes' ? 'Mês' : m === 'ano' ? 'Ano' : 'Período'}
            </button>
          ))}
        </div>

        {modo === 'mes' && <SeletorMesBalancete value={mesAnoSel} onSelecionar={aplicarMes} />}

        {modo === 'ano' && (
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg overflow-hidden">
            <button onClick={() => aplicarAno(anoSel - 1)} className="px-2 py-2 text-gray-400 hover:text-foreground hover:bg-surface-highlight transition-colors"><ChevronLeft size={15} /></button>
            <span className="text-sm font-semibold px-2 min-w-[3rem] text-center">{anoSel}</span>
            <button onClick={() => aplicarAno(anoSel + 1)} className="px-2 py-2 text-gray-400 hover:text-foreground hover:bg-surface-highlight transition-colors"><ChevronRight size={15} /></button>
          </div>
        )}

        {modo === 'periodo' && (
          <div className="flex items-center gap-2">
            <input type="date" value={periodoIni} onChange={e => setPeriodoIni(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <span className="text-gray-500 text-sm">até</span>
            <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={() => navegar(periodoIni, periodoFim)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
              Aplicar
            </button>
          </div>
        )}
        </div>

        <button
          onClick={handleExportarGeral}
          disabled={gerandoPdfGeral}
          className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-highlight transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <FileDown size={16} /> {gerandoPdfGeral ? 'Gerando PDF...' : 'Exportar PDF'}
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <CardResumo label="Receitas previstas" valor={b.receitas} cor="text-emerald-400" />
        <CardResumo label="Despesas previstas" valor={b.despesas} cor="text-red-400" />
        <CardResumo label={b.lucro >= 0 ? 'Lucro previsto' : 'Prejuízo previsto'} valor={Math.abs(b.lucro)} cor={b.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <CardResumo label={b.saldo >= 0 ? 'Saldo realizado' : 'Déficit realizado'} valor={Math.abs(b.saldo)} cor={b.saldo >= 0 ? 'text-indigo-400' : 'text-red-400'} />
        <CardResumo label="A Receber no período" valor={b.a_receber} cor="text-yellow-400" />
        <CardResumo label="A Pagar no período" valor={b.a_pagar} cor="text-orange-400" />
      </div>

      {/* Gráfico */}
      {(b.dados_mensais.length > 0 || tipoGrafico === 'pizza') && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">
              {tipoGrafico === 'pizza' ? 'Distribuição do Período' : 'Receitas × Despesas × Lucro por Mês'}
            </h2>
            <div className="flex gap-1">
              {([
                { id: 'barra', label: 'Barra' },
                { id: 'linha', label: 'Linha' },
                { id: 'pizza', label: 'Pizza' },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTipoGrafico(t.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${tipoGrafico === t.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-background border-border text-gray-400 hover:text-foreground'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tipoGrafico === 'barra' && (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={b.dados_mensais} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`} domain={[0, 'auto']} />
                <Tooltip content={<TooltipCustom />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro" name="Lucro" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {tipoGrafico === 'linha' && (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={b.dados_mensais} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`} domain={[0, 'auto']} />
                <Tooltip content={<TooltipCustom />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: '#10b981' }} />
                <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#6366f1" strokeWidth={2} dot={{ r: 4, fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          {tipoGrafico === 'pizza' && (() => {
            const dadosPizza = [
              { name: 'Receitas', value: b.receitas, color: '#10b981' },
              { name: 'Despesas', value: b.despesas, color: '#ef4444' },
              ...(b.lucro > 0 ? [{ name: 'Lucro', value: b.lucro, color: '#6366f1' }] : []),
            ].filter(d => d.value > 0)
            const total = dadosPizza.reduce((s, d) => s + d.value, 0)
            return (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="60%" height={260}>
                  <PieChart>
                    <Pie data={dadosPizza} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50}>
                      {dadosPizza.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 flex-1">
                  {dadosPizza.map(d => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-sm text-gray-300">{d.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium" style={{ color: d.color }}>{formatarMoeda(d.value)}</div>
                        <div className="text-xs text-gray-500">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Contratos encerrando */}
      {b.contratos_encerrando.length > 0 && (
        <ContratosEncerrando contratos={b.contratos_encerrando} />
      )}

      {/* Tabelas por conta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TabelaConta
          titulo="Receitas por Conta"
          nomeCliente={nomeCliente}
          itens={b.receitas_por_conta}
          total={b.receitas}
          cor="text-emerald-400"
          corPdf={[4, 120, 87]}
          lancamentosPorConta={b.lancamentos_por_conta}
          labelPeriodo={labelPeriodo}
        />
        <TabelaConta
          titulo="Despesas por Conta"
          nomeCliente={nomeCliente}
          itens={b.despesas_por_conta}
          total={b.despesas}
          cor="text-red-400"
          corPdf={[185, 28, 28]}
          lancamentosPorConta={b.lancamentos_por_conta}
          labelPeriodo={labelPeriodo}
        />
      </div>

      {/* Bloco oculto — usado só para capturar o PDF geral (cards + 3 gráficos empilhados) */}
      {preparandoExportGeral && (
        <div
          ref={exportGeralRef}
          style={{ position: 'fixed', top: 0, left: '-10000px', width: 680, padding: 16, backgroundColor: COR_EXPORT.fundo }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
            <CardExport label="Receitas previstas" valor={b.receitas} cor={COR_EXPORT.emerald} />
            <CardExport label="Despesas previstas" valor={b.despesas} cor={COR_EXPORT.red} />
            <CardExport label={b.lucro >= 0 ? 'Lucro previsto' : 'Prejuízo previsto'} valor={Math.abs(b.lucro)} cor={b.lucro >= 0 ? COR_EXPORT.emerald : COR_EXPORT.red} />
            <CardExport label={b.saldo >= 0 ? 'Saldo realizado' : 'Déficit realizado'} valor={Math.abs(b.saldo)} cor={b.saldo >= 0 ? COR_EXPORT.indigo : COR_EXPORT.red} />
            <CardExport label="A Receber no período" valor={b.a_receber} cor={COR_EXPORT.yellow} />
            <CardExport label="A Pagar no período" valor={b.a_pagar} cor={COR_EXPORT.orange} />
          </div>

          <ChartBlockExport titulo="Receitas × Despesas × Lucro por Mês — Barra">
            <BarChart width={648} height={190} data={b.dados_mensais} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: COR_EXPORT.textoMuted }} />
              <YAxis tick={{ fontSize: 9, fill: COR_EXPORT.textoMuted }} tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`} domain={[0, 'auto']} />
              <Legend wrapperStyle={{ fontSize: 10, color: COR_EXPORT.textoMuted }} />
              <Bar dataKey="receitas" name="Receitas" fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="lucro" name="Lucro" fill="#6366f1" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartBlockExport>

          <ChartBlockExport titulo="Receitas × Despesas × Lucro por Mês — Linha">
            <LineChart width={648} height={190} data={b.dados_mensais} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: COR_EXPORT.textoMuted }} />
              <YAxis tick={{ fontSize: 9, fill: COR_EXPORT.textoMuted }} tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`} domain={[0, 'auto']} />
              <Legend wrapperStyle={{ fontSize: 10, color: COR_EXPORT.textoMuted }} />
              <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} isAnimationActive={false} />
              <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} isAnimationActive={false} />
              <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} isAnimationActive={false} />
            </LineChart>
          </ChartBlockExport>

          <ChartBlockExport titulo="Distribuição do Período — Pizza">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <PieChart width={340} height={170}>
                <Pie data={dadosPizzaExport} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={32} isAnimationActive={false}>
                  {dadosPizzaExport.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                {dadosPizzaExport.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: COR_EXPORT.texto }}>{d.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: d.color }}>{formatarMoeda(d.value)}</div>
                      <div style={{ fontSize: 9, color: COR_EXPORT.textoMuted }}>{totalPizzaExport > 0 ? ((d.value / totalPizzaExport) * 100).toFixed(1) : 0}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ChartBlockExport>
        </div>
      )}

      {/* Preview do PDF geral */}
      {pdfBlobGeral && (
        <ModalPreviewPdf pdfBlob={pdfBlobGeral} onClose={() => setPdfBlobGeral(null)} />
      )}
    </div>
  )
}

function ContratosEncerrando({ contratos }: { contratos: ContratoEncerrando[] }) {
  function faixa(dias: number) {
    if (dias <= 30) return { bg: 'bg-red-500/10', border: 'border-red-500/30', badge: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-500' }
    if (dias <= 60) return { bg: 'bg-orange-500/10', border: 'border-orange-500/30', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', dot: 'bg-orange-500' }
    return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-500' }
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <h2 className="text-sm font-semibold text-gray-300">Contratos Encerrando em até 90 dias</h2>
        <span className="ml-auto text-xs bg-surface-highlight border border-border rounded-full px-2 py-0.5 text-gray-400">{contratos.length}</span>
      </div>
      <div className="divide-y divide-border">
        {contratos.map(c => {
          const f = faixa(c.dias_restantes)
          const dtFormatada = new Date(c.dt_ultima_parcela + 'T12:00:00').toLocaleDateString('pt-BR')
          return (
            <div key={c.id} className={`flex items-center justify-between px-4 py-3 ${f.bg}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full shrink-0 ${f.dot}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.descricao || '(sem descrição)'}</p>
                  <p className="text-xs text-gray-500">Última parcela: {dtFormatada} · {c.parcelas_restantes}/{c.total_parcelas} parcelas restantes</p>
                </div>
              </div>
              <div className="shrink-0 ml-4">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${f.badge}`}>
                  {c.dias_restantes === 0 ? 'Vence hoje' : `${c.dias_restantes} dias`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TabelaConta({
  titulo,
  nomeCliente,
  itens,
  total,
  cor,
  corPdf,
  lancamentosPorConta,
  labelPeriodo,
}: {
  titulo: string
  nomeCliente: string
  itens: { plano_contas_id: string; nome: string; total: number }[]
  total: number
  cor: string
  corPdf: [number, number, number]
  lancamentosPorConta: Record<string, { descricao: string; valor: number; status: string; dt_vencimento: Date }[]>
  labelPeriodo: string
}) {
  const [contaAberta, setContaAberta] = useState<string | null>(null)
  const [mostrarEscolhaPdf, setMostrarEscolhaPdf] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)

  function exportarResumida() {
    setPdfBlob(gerarPdfContaResumo({ titulo, nomeCliente, itens, total, labelPeriodo, corDestaque: corPdf }))
    setMostrarEscolhaPdf(false)
  }

  function exportarDetalhada() {
    setPdfBlob(gerarPdfContaDetalhado({ titulo, nomeCliente, itens, total, labelPeriodo, corDestaque: corPdf, lancamentosPorConta }))
    setMostrarEscolhaPdf(false)
  }

  const statusLabel: Record<string, { label: string; cor: string }> = {
    PAGO:      { label: 'Pago',     cor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    PENDENTE:  { label: 'Pendente', cor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    CANCELADO: { label: 'Cancelado',cor: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">{titulo}</h2>
        {itens.length > 0 && (
          <button
            onClick={() => setMostrarEscolhaPdf(true)}
            className="p-1.5 text-gray-400 hover:text-foreground hover:bg-surface-highlight rounded-lg transition-colors"
            title="Exportar PDF"
          >
            <FileDown size={15} />
          </button>
        )}
      </div>
      {itens.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-8">Nenhum lançamento no período.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Conta</th>
              <th className="text-right px-4 py-2">Total</th>
              <th className="text-right px-4 py-2">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {itens
              .sort((a, b) => b.total - a.total)
              .map(item => (
                <Fragment key={item.plano_contas_id}>
                  <tr
                    className="hover:bg-background/50 cursor-pointer"
                    onClick={() => setContaAberta(contaAberta === item.plano_contas_id ? null : item.plano_contas_id)}
                  >
                    <td className="px-4 py-2.5 text-gray-300 flex items-center gap-2">
                      <span className={`text-gray-500 transition-transform text-xs ${contaAberta === item.plano_contas_id ? 'rotate-90' : ''}`}>▶</span>
                      {item.nome}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium ${cor}`}>
                      {item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">
                      {total > 0 ? `${((item.total / total) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>

                  {contaAberta === item.plano_contas_id && (
                    <tr key={`${item.plano_contas_id}-detalhe`}>
                      <td colSpan={3} className="px-0 py-0 bg-background/40">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 uppercase border-b border-border">
                              <th className="text-left px-8 py-2">Descrição</th>
                              <th className="text-center px-4 py-2">Status</th>
                              <th className="text-right px-4 py-2">Vencimento</th>
                              <th className="text-right px-4 py-2">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {(lancamentosPorConta[item.plano_contas_id] ?? []).map((l, i) => {
                              const s = statusLabel[l.status] ?? { label: l.status, cor: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
                              const dt = new Date(l.dt_vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                              return (
                                <tr key={i} className="hover:bg-surface-highlight/20">
                                  <td className="px-8 py-2 text-gray-400">{l.descricao}</td>
                                  <td className="px-4 py-2 text-center">
                                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${s.cor}`}>{s.label}</span>
                                  </td>
                                  <td className="px-4 py-2 text-right text-gray-500">{dt}</td>
                                  <td className={`px-4 py-2 text-right font-medium ${cor}`}>
                                    {l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            <tr className="border-t-2 border-border font-semibold">
              <td className="px-4 py-2.5 text-gray-300">Total</td>
              <td className={`px-4 py-2.5 text-right ${cor}`}>
                {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </td>
              <td className="px-4 py-2.5 text-right text-gray-500">100%</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Popup: escolher Resumida ou Detalhada */}
      {mostrarEscolhaPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold">Exportar PDF</h2>
              <p className="text-sm text-gray-400 mt-1">{titulo} — como deseja exportar?</p>
            </div>
            <div className="space-y-2">
              <button
                onClick={exportarResumida}
                className="w-full py-2.5 rounded-lg bg-surface border border-border hover:bg-surface-highlight text-sm font-medium transition-colors text-left px-4"
              >
                <div className="font-medium text-foreground">Resumida</div>
                <div className="text-xs text-gray-500 mt-0.5">Uma tabela com o total e a % de cada conta, igual à tela.</div>
              </button>
              <button
                onClick={exportarDetalhada}
                className="w-full py-2.5 rounded-lg bg-surface border border-border hover:bg-surface-highlight text-sm font-medium transition-colors text-left px-4"
              >
                <div className="font-medium text-foreground">Detalhada</div>
                <div className="text-xs text-gray-500 mt-0.5">Uma tabela por conta, com todos os lançamentos (como ao abrir cada conta).</div>
              </button>
            </div>
            <button
              onClick={() => setMostrarEscolhaPdf(false)}
              className="w-full py-2 rounded-lg border border-border text-sm text-gray-400 hover:text-foreground hover:bg-surface-highlight transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Preview do PDF gerado */}
      {pdfBlob && (
        <ModalPreviewPdf pdfBlob={pdfBlob} onClose={() => setPdfBlob(null)} />
      )}
    </div>
  )
}