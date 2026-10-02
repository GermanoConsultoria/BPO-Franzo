'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { excluirInvestimento } from '@/app/actions'
import ModalInvestimento from '@/components/financeiro/ModalInvestimento'
import type { Investimento, TipoInvestimento, Banco } from '@/types'

interface Props {
  equipeId: string
  nomeCliente: string
  investimentos: Investimento[]
  bancos: Banco[]
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  const d = new Date(data)
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export default function InvestimentosView({ equipeId, investimentos: iniciais, bancos }: Props) {
  const [investimentos, setInvestimentos] = useState(iniciais)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Investimento | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoInvestimento | 'TODOS'>('TODOS')
  const [filtroBanco, setFiltroBanco] = useState<string>('TODOS')

  // Filtro de banco também recorta os cards — assim dá pra ver o saldo total
  // geral ("Todos os bancos") ou o saldo respectivo de um banco específico.
  const porBanco = useMemo(() => {
    if (filtroBanco === 'TODOS') return investimentos
    if (filtroBanco === 'SEM_BANCO') return investimentos.filter(m => !m.banco_id)
    return investimentos.filter(m => m.banco_id === filtroBanco)
  }, [investimentos, filtroBanco])

  const ordenados = useMemo(
    () => [...porBanco].sort((a, b) => new Date(a.dt_movimento).getTime() - new Date(b.dt_movimento).getTime()),
    [porBanco]
  )

  const totalAportado = porBanco.filter(m => m.tipo === 'APORTE').reduce((s, m) => s + Number(m.valor), 0)
  const totalResgatado = porBanco.filter(m => m.tipo === 'RESGATE').reduce((s, m) => s + Number(m.valor), 0)
  const saldoInvestido = totalAportado - totalResgatado

  const filtrados = useMemo(() => {
    return ordenados
      .filter(m => filtroTipo === 'TODOS' || m.tipo === filtroTipo)
      .filter(m => busca === '' || m.descricao.toLowerCase().includes(busca.toLowerCase()))
      .reverse() // mais recente primeiro
  }, [ordenados, filtroTipo, busca])

  async function handleExcluir(m: Investimento) {
    if (!confirm(`Excluir o movimento "${m.descricao}"?`)) return
    const resultado = await excluirInvestimento(m.id, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success('Movimento excluído.')
    setInvestimentos(prev => prev.filter(i => i.id !== m.id))
  }

  function abrirEditar(m: Investimento) {
    setEditando(m)
    setShowModal(true)
  }

  function handleSuccess(salvo: Investimento) {
    setInvestimentos(prev => {
      const existe = prev.some(i => i.id === salvo.id)
      return existe ? prev.map(i => i.id === salvo.id ? salvo : i) : [...prev, salvo]
    })
  }

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Aportado</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{formatarMoeda(totalAportado)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Resgatado</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{formatarMoeda(totalResgatado)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Saldo Investido</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{formatarMoeda(saldoInvestido)}</p>
        </div>
      </div>

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por descrição..."
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value as TipoInvestimento | 'TODOS')}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 flex-shrink-0"
        >
          <option value="TODOS">Todos</option>
          <option value="APORTE">Aportes</option>
          <option value="RESGATE">Resgates</option>
        </select>
        <select
          value={filtroBanco}
          onChange={e => setFiltroBanco(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 flex-shrink-0"
        >
          <option value="TODOS">Todos os bancos</option>
          <option value="SEM_BANCO">Sem banco</option>
          {bancos.map(b => (
            <option key={b.id} value={b.id}>{b.nome}</option>
          ))}
        </select>
        <button
          onClick={() => { setEditando(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <Plus size={16} /> Novo Movimento
        </button>
      </div>

      {/* Tabela */}
      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm border border-dashed border-border rounded-xl">
          Nenhum movimento encontrado.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface text-gray-400 text-[10px] uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Descrição</th>
                  <th className="text-center px-3 py-2">Tipo</th>
                  <th className="text-center px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Banco</th>
                  <th className="text-center px-3 py-2">Nº Doc.</th>
                  <th className="text-right px-3 py-2">Valor</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtrados.map(m => (
                  <tr
                    key={m.id}
                    onClick={() => abrirEditar(m)}
                    className="hover:bg-surface/50 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2 font-medium text-foreground max-w-[220px] truncate" title={m.descricao}>{m.descricao}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${m.tipo === 'APORTE' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-yellow-500/5 text-yellow-600 border-yellow-500/20'}`}>
                        {m.tipo === 'APORTE' ? <ArrowUpCircle size={11} /> : <ArrowDownCircle size={11} />}
                        {m.tipo === 'APORTE' ? 'Aporte' : 'Resgate'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-gray-300 whitespace-nowrap">{formatarData(m.dt_movimento)}</td>
                    <td className="px-3 py-2 text-gray-400 max-w-[120px] truncate">{bancos.find(b => b.id === m.banco_id)?.nome ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-gray-400">{m.numero_documento ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold text-yellow-400 whitespace-nowrap">
                      {m.tipo === 'RESGATE' ? '- ' : ''}{formatarMoeda(Number(m.valor))}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => abrirEditar(m)} className="p-1 text-gray-400 hover:text-yellow-400 transition-colors" title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleExcluir(m)} className="p-1 text-gray-400 hover:text-red-400 transition-colors" title="Excluir">
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

      {showModal && (
        <ModalInvestimento
          equipeId={equipeId}
          bancos={bancos}
          investimento={editando ?? undefined}
          onClose={() => { setShowModal(false); setEditando(null) }}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
