'use client'

import { useState, useTransition } from 'react'
import { toggleConcluida } from '@/app/actions'
import ModalTarefa from './ModalTarefa'
import type { TarefaComRelacoes, UsuarioBasico, ProjetoComColunas } from '@/types'

interface Props {
  tarefa: TarefaComRelacoes
  usuarios: UsuarioBasico[]
  projetos: ProjetoComColunas[]
  usuarioId: string
}

export default function ItemListaTarefa({ tarefa, usuarios, projetos, usuarioId }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleCheck = (e: React.MouseEvent) => {
    e.stopPropagation()
    startTransition(() => {
      toggleConcluida(tarefa.id, !tarefa.concluida, tarefa.projeto_id)
    })
  }

  const formatarData = (data: Date | string | null) => {
    if (!data) return ''
    return new Date(data).toLocaleDateString('pt-BR')
  }

  // Define cores da prioridade
  const getPriorityColor = (id: number) => {
    if (id === 3) return 'border-red-500 bg-red-50 text-red-700'
    if (id === 2) return 'border-orange-500 bg-orange-50 text-orange-700'
    return 'border-green-500 bg-green-50 text-green-700'
  }

  return (
    <>
      <div 
        onClick={() => setShowModal(true)}
        className={`group flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer ${tarefa.concluida ? 'opacity-60 bg-gray-50' : ''}`}
      >
        <div className="flex items-center gap-4">
          <input 
            type="checkbox" 
            checked={tarefa.concluida} 
            onChange={() => {}} // Controlado pelo onClick do div pai ou handleCheck específico
            onClick={handleCheck}
            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
          />
          
          <div>
            <h4 className={`font-medium text-gray-900 ${tarefa.concluida ? 'line-through text-gray-500' : ''}`}>
              {tarefa.titulo}
            </h4>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                {tarefa.projeto?.nome || 'Sem Projeto'}
              </span>
              <span>•</span>
              <span>{formatarData(tarefa.dt_vencimento)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
            {tarefa.usuario && (
                <div title={tarefa.usuario.nome} className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                    {tarefa.usuario.nome.substring(0, 2).toUpperCase()}
                </div>
            )}
            
            <span className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${getPriorityColor(tarefa.prioridade_id)}`}>
                {tarefa.prioridade?.nome || 'Normal'}
            </span>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {showModal && (
        <ModalTarefa 
          tarefa={tarefa} 
          usuarios={usuarios} 
          projetos={projetos}
          isOpen={showModal}
          onClose={() => setShowModal(false)} 
          usuarioLogadoId={usuarioId}
        />
      )}
    </>
  )
}