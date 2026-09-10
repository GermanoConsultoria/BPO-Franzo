'use client'

import { useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { moverTarefaDeColuna, atualizarDatasEtapa } from '@/app/actions'
import CardKanban from './CardKanban'
import { useState } from 'react'
import type { ColunaBasica, TarefaComRelacoes, UsuarioBasico } from '@/types'
import { extrairDataYMD } from '@/lib/date'

interface Props {
  coluna: ColunaBasica
  tarefas: TarefaComRelacoes[]
  usuarios: UsuarioBasico[]
  projetoId: string
  equipeId?: string
  index?: number
  moveColuna?: (dragIndex: number, hoverIndex: number) => void
  onDropColuna?: () => void
  usuarioId: string
}

// Tipos de Item para diferenciar o arraste
const ItemTypes = {
  TAREFA: 'TAREFA',
  COLUNA: 'COLUNA'
}

export default function ColunaKanban({
  coluna,
  tarefas,
  usuarios,
  projetoId,
  equipeId,
  index,
  moveColuna,
  onDropColuna,
  usuarioId
}: Props) {
  const [isUpdating, setIsUpdating] = useState(false)
  const toInputDate = (v: Date | string | null | undefined) => extrairDataYMD(v) || ''
  const [dataInicio, setDataInicio] = useState(toInputDate(coluna.data_inicio))
  const [dataFim, setDataFim] = useState(toInputDate(coluna.data_fim))

  const salvarDatas = (inicio: string, fim: string) => {
    if (!equipeId) return
    atualizarDatasEtapa(projetoId, coluna.id, inicio || null, fim || null, equipeId)
  }
  const ref = useRef<HTMLDivElement>(null)

  // --- 1. LÓGICA DE ARRASTAR A COLUNA (REORDENAÇÃO) ---
  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.COLUNA,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
       // Quando soltar a coluna, chama a função para salvar no banco
       if (onDropColuna) onDropColuna()
    }
  })

  const [, dropColuna] = useDrop({
    accept: ItemTypes.COLUNA,
    hover(item: { index: number }) {
      if (!ref.current) return
      const dragIndex = item.index
      const hoverIndex = index

      // Se não passou index (ex: fora do modo kanban), ignora
      if (dragIndex === undefined || hoverIndex === undefined) return
      if (dragIndex === hoverIndex) return

      // Troca visualmente
      if (moveColuna) {
        moveColuna(dragIndex, hoverIndex)
        item.index = hoverIndex // Mantém o item atualizado
      }
    },
  })

  // --- 2. LÓGICA DE RECEBER TAREFAS (JÁ EXISTIA) ---
  const [{ isOverTarefa }, dropTarefa] = useDrop(() => ({
    accept: ItemTypes.TAREFA,
    drop: (item: { id: string, colunaId: string }) => {
      if (item.colunaId !== coluna.id) {
        setIsUpdating(true)
        moverTarefaDeColuna(item.id, coluna.id, projetoId)
          .finally(() => setIsUpdating(false))
      }
    },
    collect: (monitor) => ({
      isOverTarefa: monitor.isOver(),
    }),
  }), [coluna.id, projetoId])

  // Inicializa os refs (Colunas arrastáveis apenas se tiver index e função)
  if (index !== undefined && moveColuna) {
    drag(dropColuna(ref))
  }

  // Ref para soltar tarefas (o container inteiro aceita tarefas)
  // Precisamos de um ref separado ou conectar o dropTarefa ao elemento externo
  // Simplificando: Vamos usar um div wrapper para a coluna e o ref interno para o drag da coluna

  return (
    <div 
      ref={ref} // A Coluna inteira é arrastável (se tiver props de reordenação)
      className={`flex-shrink-0 transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
      data-handler-id={index} // Ajuda no debug do dnd
    >
      <div 
        // Este ref aceita as TAREFAS
        ref={dropTarefa as unknown as React.LegacyRef<HTMLDivElement>}
        className={`min-w-[300px] w-[300px] flex flex-col rounded-xl border h-full transition-colors ${
          isOverTarefa ? 'bg-indigo-50 border-indigo-300 shadow-inner' : 'bg-surface/50 border-border/60'
        }`}
      >
        {/* CABEÇALHO (Onde pegamos para arrastar a coluna) */}
        <div className="p-3 border-b border-gray-100 bg-surface/50 rounded-t-xl backdrop-blur-sm flex-shrink-0 cursor-grab active:cursor-grabbing">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isUpdating ? 'bg-yellow-400 animate-pulse' : 'bg-indigo-500'}`}></div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide truncate max-w-[180px]" title={coluna.nome}>
                {coluna.nome}
              </h3>
            </div>
            <span className="bg-surface text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-border">
              {tarefas.length}
            </span>
          </div>
          {equipeId && (
            <div className="flex gap-1.5 cursor-default" onClick={(e) => e.stopPropagation()}>
              <div className="flex-1">
                <label className="text-[9px] text-gray-400 uppercase font-bold block mb-0.5">Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  onBlur={(e) => salvarDatas(e.target.value, dataFim)}
                  className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-background text-foreground focus:ring-1 focus:ring-indigo-400 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-gray-400 uppercase font-bold block mb-0.5">Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  onBlur={(e) => salvarDatas(dataInicio, e.target.value)}
                  className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-background text-foreground focus:ring-1 focus:ring-indigo-400 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* ÁREA DE CARDS */}
        <div className="p-2 space-y-2 overflow-y-auto custom-scrollbar-thin flex-1 min-h-[150px]">
          {tarefas.map(tarefa => (
            <CardKanban 
              key={tarefa.id} 
              tarefa={tarefa} 
              usuarios={usuarios}
              usuarioId={usuarioId}
            />
          ))}
          
          {tarefas.length === 0 && (
              <div className="h-full flex items-center justify-center text-xs text-gray-300 italic pointer-events-none min-h-[100px]">
                  Solte tarefas aqui
              </div>
          )}
        </div>
      </div>
    </div>
  )
}