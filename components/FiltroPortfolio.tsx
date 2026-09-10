'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

interface FiltroProps {
  projetos: { id: string, nome: string }[]
  fases: string[]
  responsaveis: { id: string, nome: string }[]
  mesSelecionado?: string
}

export default function FiltrosPortfolio({ projetos, fases, responsaveis, mesSelecionado = '' }: FiltroProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const projetoAtual = searchParams.get('projetoId') || ''
  const faseAtual = searchParams.get('fase') || ''
  const statusAtual = searchParams.get('status') || ''
  const responsavelAtual = searchParams.get('responsavelId') || ''
  const mesAtual = searchParams.get('mes') || mesSelecionado

  const handleFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`)
    })
  }

  const temFiltro = projetoAtual || faseAtual || statusAtual || responsavelAtual || mesAtual

  const limparFiltros = () => {
    startTransition(() => {
      router.replace(pathname)
    })
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-end shadow-sm">

      {/* FILTRO POR PROJETO */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-bold text-text-muted uppercase mb-1">Projeto</label>
        <select
          value={projetoAtual}
          onChange={(e) => handleFilter('projetoId', e.target.value)}
          disabled={isPending}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground cursor-pointer disabled:opacity-50"
        >
          <option value="">Todos</option>
          {projetos.map(proj => (
            <option key={proj.id} value={proj.id}>{proj.nome}</option>
          ))}
        </select>
      </div>

      {/* FILTRO POR STATUS */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-bold text-text-muted uppercase mb-1">Status</label>
        <select
          value={statusAtual}
          onChange={(e) => handleFilter('status', e.target.value)}
          disabled={isPending}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground cursor-pointer disabled:opacity-50"
        >
          <option value="">Todos</option>
          <option value="EM_ANDAMENTO">🟢 Em Andamento</option>
          <option value="AGUARDANDO_ONBLOX">⏳ Aguardando Onblox</option>
          <option value="AGUARDANDO_CLIENTE">🔔 Aguardando Cliente</option>
          <option value="RISCO_CHURN">🔴 Risco Churn</option>
          <option value="PAUSADO">⏸️ Pausado</option>
          <option value="CONCLUIDO">✅ Concluído</option>
        </select>
      </div>

      {/* FILTRO POR RESPONSÁVEL */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-bold text-text-muted uppercase mb-1">Responsável</label>
        <select
          value={responsavelAtual}
          onChange={(e) => handleFilter('responsavelId', e.target.value)}
          disabled={isPending}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground cursor-pointer disabled:opacity-50"
        >
          <option value="">Todos</option>
          {responsaveis.map(r => (
            <option key={r.id} value={r.id}>{r.nome}</option>
          ))}
        </select>
      </div>

      {/* FILTRO POR FASE */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-bold text-text-muted uppercase mb-1">Fase</label>
        <select
          value={faseAtual}
          onChange={(e) => handleFilter('fase', e.target.value)}
          disabled={isPending}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground cursor-pointer disabled:opacity-50"
        >
          <option value="">Todas</option>
          {fases.map(fase => (
            <option key={fase} value={fase}>{fase}</option>
          ))}
        </select>
      </div>

      {/* FILTRO POR MÊS DE ENTREGA */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-bold text-text-muted uppercase mb-1">Previsão (mês)</label>
        <input
          type="month"
          value={mesAtual}
          onChange={(e) => handleFilter('mes', e.target.value)}
          disabled={isPending}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground cursor-pointer disabled:opacity-50"
        />
      </div>

      {/* BOTÃO LIMPAR */}
      {temFiltro && (
        <button
          onClick={limparFiltros}
          disabled={isPending}
          className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50/10 rounded-lg transition-colors h-[38px] disabled:opacity-50"
        >
          Limpar
        </button>
      )}
    </div>
  )
}
