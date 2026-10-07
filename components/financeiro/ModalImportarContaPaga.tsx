'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { X, Search, ArrowRightLeft } from 'lucide-react'
import { getLancamentosFinanceiros, importarContaPagaComoInvestimento } from '@/app/actions'
import type { Investimento, LancamentoComRelacoes } from '@/types'

interface Props {
  equipeId: string
  onClose: () => void
  onImportado: (investimento: Investimento) => void
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export default function ModalImportarContaPaga({ equipeId, onClose, onImportado }: Props) {
  const [lancamentos, setLancamentos] = useState<LancamentoComRelacoes[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    (async () => {
      setCarregando(true)
      try {
        const dados = await getLancamentosFinanceiros(equipeId, 'DESPESA', { status: 'PAGO' })
        setLancamentos(dados as unknown as LancamentoComRelacoes[])
      } catch {
        toast.error('Erro ao carregar contas a pagar.')
      } finally {
        setCarregando(false)
      }
    })()
  }, [equipeId])

  const filtrados = lancamentos
    .filter(l => busca === '' || l.descricao.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => new Date(b.dt_pagamento ?? b.dt_vencimento).getTime() - new Date(a.dt_pagamento ?? a.dt_vencimento).getTime())

  async function confirmarImportacao() {
    if (!selecionadoId) return
    setEnviando(true)
    try {
      const resultado = await importarContaPagaComoInvestimento(selecionadoId, equipeId)
      if (!resultado.success) {
        toast.error(resultado.error)
        return
      }
      toast.success('Conta transferida para investimentos.')
      onImportado(resultado.data)
    } catch {
      toast.error('Erro ao importar conta a pagar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-lg font-bold">Importar de Contas a Pagar</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Escolha uma conta já paga para transferir o valor como aporte de investimento.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs text-gray-500 bg-background border border-border rounded-lg p-3 space-y-1">
            <p>• A conta selecionada sai de <span className="text-foreground font-medium">Contas a Pagar</span> e vira um aporte em Investimentos.</p>
            <p>• Data, saldo anterior, saldo atual, descrição e valor são trazidos como estavam no lançamento original.</p>
            <p>• Se a conta estava vinculada a um banco, o saldo que havia sido debitado dele é estornado (o dinheiro não saiu de verdade — só foi investido).</p>
          </div>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por descrição..."
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          {carregando ? (
            <p className="text-center text-gray-500 text-sm py-8">Carregando...</p>
          ) : filtrados.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8 border border-dashed border-border rounded-lg">
              Nenhuma conta paga encontrada.
            </p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="max-h-[45vh] overflow-y-auto divide-y divide-border">
                {filtrados.map(l => (
                  <label
                    key={l.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${selecionadoId === l.id ? 'bg-yellow-500/10' : 'hover:bg-background/60'}`}
                  >
                    <input
                      type="radio"
                      name="lancamento"
                      checked={selecionadoId === l.id}
                      onChange={() => setSelecionadoId(l.id)}
                      className="accent-yellow-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate" title={l.descricao}>{l.descricao}</p>
                      <p className="text-[11px] text-gray-500">
                        {l.dt_pagamento ? formatarData(l.dt_pagamento) : '—'}
                        {l.banco ? ` · ${l.banco.nome}` : ' · Sem banco'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-red-400 whitespace-nowrap">{formatarMoeda(l.valor)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmarImportacao}
              disabled={!selecionadoId || enviando}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <ArrowRightLeft size={15} />
              {enviando ? 'Transferindo...' : 'Transferir para Investimento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
