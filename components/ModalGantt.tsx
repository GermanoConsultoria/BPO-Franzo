'use client'

import { useState } from 'react'
import { BarChart2, Printer, X } from 'lucide-react'
import GanttProjeto from './GanttProjeto'
import { formatarDataBR } from '@/lib/date'

type Etapa = {
  nome: string
  data_inicio: Date | string | null
  data_fim: Date | string | null
  cor?: string | null
}

interface Props {
  nomeProjeto: string
  etapas: Etapa[]
  dataInicioProjeto: Date | string | null
  dataPrevistaEntrega: Date | string | null
}

export default function ModalGantt({ nomeProjeto, etapas, dataInicioProjeto, dataPrevistaEntrega }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Visualizar Gráfico Gantt"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        <BarChart2 size={15} />
        Gantt
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:bg-white print:inset-auto print:p-0">
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col print:shadow-none print:rounded-none print:max-h-none print:w-full">

            <div className="px-6 py-4 border-b border-border flex justify-between items-center print:hidden">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <BarChart2 size={18} className="text-indigo-500" />
                Gráfico Gantt — {nomeProjeto}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-gray-600 border border-border rounded-lg hover:bg-surface-highlight transition-colors"
                >
                  <Printer size={14} /> Imprimir / PDF
                </button>
                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Cabeçalho visível só no print */}
              <div className="hidden print:block mb-6">
                <h1 className="text-xl font-bold">{nomeProjeto} — Gráfico Gantt</h1>
                {dataInicioProjeto && (
                  <p className="text-sm text-gray-500 mt-1">
                    Início: {formatarDataBR(dataInicioProjeto)}
                    {dataPrevistaEntrega ? ` — Previsão: ${formatarDataBR(dataPrevistaEntrega)}` : ''}
                  </p>
                )}
              </div>

              {/* Datas do projeto */}
              {(dataInicioProjeto || dataPrevistaEntrega) && (
                <div className="flex gap-4 mb-6 p-3 bg-surface-highlight/50 rounded-lg border border-border">
                  {dataInicioProjeto && (
                    <div>
                      <p className="text-[10px] text-text-muted uppercase font-bold">Início do Projeto</p>
                      <p className="text-sm font-bold text-foreground">{formatarDataBR(dataInicioProjeto)}</p>
                    </div>
                  )}
                  {dataPrevistaEntrega && (
                    <div>
                      <p className="text-[10px] text-text-muted uppercase font-bold">Previsão de Entrega</p>
                      <p className="text-sm font-bold text-indigo-600">{formatarDataBR(dataPrevistaEntrega)}</p>
                    </div>
                  )}
                </div>
              )}

              <GanttProjeto
                etapas={etapas}
                dataInicioProjeto={dataInicioProjeto}
                dataPrevistaEntrega={dataPrevistaEntrega}
                nomeProjeto={nomeProjeto}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
