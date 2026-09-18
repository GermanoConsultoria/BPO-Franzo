'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { X, FileDown } from 'lucide-react'
import { getExtratoBanco } from '@/app/actions'
import ModalPreviewPdf from '@/components/ModalPreviewPdf'
import { gerarPdfExtratoBanco } from '@/lib/pdf-extrato-banco'
import type { Banco, MovimentoExtrato } from '@/types'

interface Props {
  equipeId: string
  banco: Banco
  onClose: () => void
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export default function ModalExtratoBanco({ equipeId, banco, onClose }: Props) {
  const [movimentos, setMovimentos] = useState<MovimentoExtrato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const filtros = dataInicio && dataFim ? { dataInicio, dataFim } : undefined
      const dados = await getExtratoBanco(banco.id, equipeId, filtros)
      setMovimentos(dados as MovimentoExtrato[])
    } catch {
      toast.error('Erro ao carregar extrato.')
    } finally {
      setCarregando(false)
    }
  }, [banco.id, equipeId, dataInicio, dataFim])

  useEffect(() => {
    carregar()
  }, [carregar])

  function limparPeriodo() {
    setDataInicio('')
    setDataFim('')
  }

  const labelPeriodo = dataInicio && dataFim
    ? `${formatarData(dataInicio)} até ${formatarData(dataFim)}`
    : 'Todos os períodos'

  function handleExportarPdf() {
    if (movimentos.length === 0) {
      toast.error('Não há movimentações para exportar com os filtros atuais.')
      return
    }
    const blob = gerarPdfExtratoBanco({ nomeBanco: banco.nome, movimentos, labelPeriodo, saldoAtual: banco.saldo_atual })
    setPdfBlob(blob)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface">
          <div>
            <h2 className="text-lg font-bold">Extrato — {banco.nome}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Saldo atual: <span className={`font-semibold ${banco.saldo_atual < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatarMoeda(banco.saldo_atual)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-400 text-sm">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {(dataInicio || dataFim) && (
                <button onClick={limparPeriodo} className="text-xs text-gray-400 hover:text-foreground transition-colors px-2">
                  Limpar período
                </button>
              )}
            </div>
            <button
              onClick={handleExportarPdf}
              className="flex items-center gap-2 bg-surface border border-border text-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-surface-highlight transition-colors flex-shrink-0"
            >
              <FileDown size={16} /> Exportar PDF
            </button>
          </div>

          {carregando ? (
            <p className="text-center text-gray-500 text-sm py-8">Carregando...</p>
          ) : movimentos.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8 border border-dashed border-border rounded-lg">
              Nenhuma movimentação {dataInicio && dataFim ? 'no período selecionado.' : 'registrada ainda.'}
            </p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-2">Data</th>
                      <th className="text-left px-4 py-2">Descrição</th>
                      <th className="text-right px-4 py-2">Valor</th>
                      <th className="text-right px-4 py-2">Saldo Anterior</th>
                      <th className="text-right px-4 py-2">Saldo Atual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {movimentos.map(m => (
                      <tr key={m.id} className="hover:bg-background/50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{m.dt_pagamento ? formatarData(m.dt_pagamento) : '—'}</td>
                        <td className="px-4 py-2.5 text-foreground">{m.descricao}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${m.tipo === 'DESPESA' ? 'text-red-400' : 'text-emerald-400'}`}>
                          {m.tipo === 'DESPESA' ? '-' : '+'} {formatarMoeda(m.valor)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-400 whitespace-nowrap">{m.saldo_anterior !== null ? formatarMoeda(m.saldo_anterior) : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300 font-medium whitespace-nowrap">{m.saldo_atual !== null ? formatarMoeda(m.saldo_atual) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {pdfBlob && (
        <ModalPreviewPdf
          pdfBlob={pdfBlob}
          onClose={() => setPdfBlob(null)}
        />
      )}
    </div>
  )
}
