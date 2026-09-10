'use client'

import { useDrag } from 'react-dnd'
import { toggleConcluida, concluirTarefaComComentario } from '@/app/actions'
import { useState, useTransition } from 'react'
import ModalTarefa from './ModalTarefa'
import ModalConclusao from './ModalConclusao'
import type { TarefaComRelacoes, UsuarioBasico, ProjetoComColunas } from '@/types'

interface CardProps {
  tarefa: TarefaComRelacoes
  usuarios: UsuarioBasico[]
  projetos?: ProjetoComColunas[]
  usuarioId: string
}

export default function CardKanban({ tarefa, usuarios, projetos, usuarioId }: CardProps) {
  const [isPending, startTransition] = useTransition()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [tarefaParaConcluir, setTarefaParaConcluir] = useState(false)
  const [isSavingConclusao, setIsSavingConclusao] = useState(false)

  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'TAREFA',
    item: { id: tarefa.id, colunaId: tarefa.coluna_id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [tarefa.id, tarefa.coluna_id])

  const handleCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    const novoValor = e.target.checked
    startTransition(() => {
      toggleConcluida(tarefa.id, novoValor, tarefa.projeto_id)
    })
  }

  const handleConfirmarConclusao = async (comentario: string) => {
    setIsSavingConclusao(true)
    await concluirTarefaComComentario(tarefa.id, comentario, tarefa.projeto_id, usuarioId)
    setIsSavingConclusao(false)
    setTarefaParaConcluir(false)
  }

  const corPrioridade = {
    ALTA: 'bg-red-100 text-red-700 border-red-200',
    MEDIA: 'bg-orange-100 text-orange-700 border-orange-200',
    BAIXA: 'bg-green-100 text-green-700 border-green-200'
  }

  return (
    <>
      <div
        ref={dragRef as unknown as React.LegacyRef<HTMLDivElement>}
        onClick={() => setIsModalOpen(true)}
        className={`bg-surface p-3 rounded-lg shadow-sm border border-border cursor-pointer hover:shadow-md transition-all group relative ${isDragging ? 'opacity-50' : 'opacity-100'} ${tarefa.concluida ? 'bg-surface/50' : ''}`}
      >
        <div className="flex justify-between items-start mb-1">
          {/* Badge de Prioridade */}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${corPrioridade[tarefa.prioridade.nome as keyof typeof corPrioridade] || 'bg-surface/50 text-gray-600'}`}>
            {tarefa.prioridade.nome}
          </span>

          <input
            type="checkbox"
            checked={tarefa.concluida}
            onChange={handleCheck}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500 cursor-pointer"
          />
        </div>

        {/* --- NOME DO PROJETO --- */}
        {tarefa.projeto && (
           <div className="mb-1">
             <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide truncate block">
               {tarefa.projeto.nome}
             </span>
           </div>
        )}

        <h4 className={`text-sm font-medium text-foreground mb-3 line-clamp-2 ${tarefa.concluida ? 'line-through text-gray-400' : ''}`}>
          {tarefa.titulo}
        </h4>

        <div className="flex justify-between items-center mt-auto">
          {/* Data */}
          <div className="flex items-center text-xs text-gray-400 gap-1">
            <span>📅</span>
            <span>
              {tarefa.dt_vencimento
                ? new Date(tarefa.dt_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                : '--/--'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Finalizar */}
            {!tarefa.concluida && (
              <button
                onClick={(e) => { e.stopPropagation(); setTarefaParaConcluir(true) }}
                disabled={isPending}
                title="Finalizar tarefa"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 disabled:opacity-50"
              >
                ✓ Finalizar
              </button>
            )}

            {/* Avatar Responsável */}
            {tarefa.usuario ? (
               <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700 border border-indigo-200" title={tarefa.usuario.nome}>
                 {tarefa.usuario.nome.substring(0, 2).toUpperCase()}
               </div>
            ) : (
               <div className="w-6 h-6 rounded-full bg-surface/50 flex items-center justify-center text-[10px] text-gray-400 border border-border">
                 ?
               </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <ModalTarefa
          tarefa={tarefa}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          usuarios={usuarios}
          projetos={projetos || []}
          usuarioLogadoId={usuarioId}
        />
      )}

      <ModalConclusao
        key={tarefa.id}
        tarefaId={tarefa.id}
        isOpen={tarefaParaConcluir}
        onClose={() => setTarefaParaConcluir(false)}
        onConfirm={handleConfirmarConclusao}
        isSaving={isSavingConclusao}
      />
    </>
  )
}
