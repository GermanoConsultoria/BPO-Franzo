'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { parseDateLocal, formatarDataBR } from '@/lib/date'

type Etapa = {
  nome: string
  data_inicio: Date | string | null
  data_fim: Date | string | null
  cor?: string | null
}

interface Props {
  etapas: Etapa[]
  dataInicioProjeto: Date | string | null
  dataPrevistaEntrega: Date | string | null
  nomeProjeto: string
}

const CORES = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899']

function toMs(v: Date | string | null | undefined): number | null {
  if (!v) return null
  const d = parseDateLocal(v)
  return d ? d.getTime() : null
}

function formatLabel(ms: number) {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function GanttProjeto({ etapas, dataInicioProjeto, dataPrevistaEntrega, nomeProjeto }: Props) {
  const { dados, minMs, maxMs } = useMemo(() => {
    const todos: number[] = []
    const projInicio = toMs(dataInicioProjeto)
    const projFim = toMs(dataPrevistaEntrega)
    if (projInicio) todos.push(projInicio)
    if (projFim) todos.push(projFim)

    const dadosComDatas = etapas
      .map((e, i) => {
        const inicio = toMs(e.data_inicio)
        const fim = toMs(e.data_fim)
        if (inicio) todos.push(inicio)
        if (fim) todos.push(fim)
        return { nome: e.nome, inicio, fim, cor: e.cor || CORES[i % CORES.length] }
      })
      .filter(e => e.inicio || e.fim)

    if (todos.length === 0) return { dados: [], minMs: 0, maxMs: 0 }

    const minMs = Math.min(...todos) - 86400000 // -1 dia de margem
    const maxMs = Math.max(...todos) + 86400000

    const dados = dadosComDatas.map(e => ({
      nome: e.nome,
      cor: e.cor,
      offset: (e.inicio ?? minMs) - minMs,
      duracao: (e.fim ?? e.inicio ?? minMs) - (e.inicio ?? minMs) + 86400000,
      inicio: e.inicio,
      fim: e.fim,
    }))

    return { dados, minMs, maxMs }
  }, [etapas, dataInicioProjeto, dataPrevistaEntrega])

  if (dados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted">
        <span className="text-4xl mb-3">📅</span>
        <p className="text-sm font-medium">Nenhuma etapa com datas definidas.</p>
        <p className="text-xs mt-1">Defina o início e fim de cada etapa no Kanban do projeto.</p>
      </div>
    )
  }

  const totalMs = maxMs - minMs

  const CustomTooltip = ({ active, payload }: { active?: boolean, payload?: Array<{ payload: typeof dados[0] }> }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <p className="font-bold text-foreground mb-1">{d.nome}</p>
        <p className="text-text-muted">Início: {d.inicio ? formatarDataBR(new Date(d.inicio)) : '—'}</p>
        <p className="text-text-muted">Fim: {d.fim ? formatarDataBR(new Date(d.fim)) : '—'}</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      <p className="text-xs text-text-muted mb-4 text-center">Gráfico Gantt — {nomeProjeto}</p>
      <ResponsiveContainer width="100%" height={dados.length * 48 + 40}>
        <BarChart
          layout="vertical"
          data={dados}
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          barSize={18}
        >
          <XAxis
            type="number"
            domain={[0, totalMs]}
            tickFormatter={(v) => formatLabel(minMs + v)}
            tick={{ fontSize: 10 }}
            tickCount={6}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={140}
            tick={{ fontSize: 11, fontWeight: 600 }}
          />
          <Tooltip content={<CustomTooltip />} />
          {/* Barra invisível de offset */}
          <Bar dataKey="offset" stackId="gantt" fill="transparent" />
          {/* Barra visível da duração */}
          <Bar dataKey="duracao" stackId="gantt" radius={[4, 4, 4, 4]}>
            {dados.map((entry, i) => (
              <Cell key={i} fill={entry.cor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {dados.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: d.cor }} />
            {d.nome}
          </div>
        ))}
      </div>
    </div>
  )
}
