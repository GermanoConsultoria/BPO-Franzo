'use client'

import { useState } from 'react'
import BotaoAnexo from './BotaoAnexo' // Certifique-se que o import está correto

interface Props {
  tarefaId: string // <--- NOVA PROP NECESSÁRIA
  isOpen: boolean
  onClose: () => void
  onConfirm: (comentario: string) => void
  isSaving: boolean
}

export default function ModalConclusao({ tarefaId, isOpen, onClose, onConfirm, isSaving }: Props) {
  const [comentario, setComentario] = useState('')
  const [anexosEnviados, setAnexosEnviados] = useState(0)

  if (!isOpen) return null

  const podeConcluir = comentario.trim().length > 0 || anexosEnviados > 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <h3 className="text-lg font-bold text-foreground mb-2">Concluir Tarefa</h3>
          <p className="text-sm text-gray-500 mb-4">
             Para finalizar, deixe um comentário <strong>ou</strong> anexe um arquivo final.
          </p>

          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Ex: Finalizado conforme solicitado..."
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none h-32 mb-4"
            autoFocus
          />

          {/* ÁREA DE ANEXO INTEGRADA */}
          <div className={`
             flex items-center justify-between p-3 rounded-lg border border-dashed transition-all mb-4
             ${anexosEnviados > 0 ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-300'}
          `}>
             <div className="flex flex-col">
                <span className={`text-sm font-medium ${anexosEnviados > 0 ? 'text-green-700' : 'text-gray-600'}`}>
                    {anexosEnviados > 0 ? `${anexosEnviados} arquivo${anexosEnviados > 1 ? 's' : ''} anexado${anexosEnviados > 1 ? 's' : ''}` : 'Anexar comprovante'}
                </span>
                <span className="text-[10px] text-gray-400">
                    {anexosEnviados > 0 ? 'Pode enviar mais arquivos ou concluir.' : 'Opcional se tiver comentário.'}
                </span>
             </div>

             <BotaoAnexo
                tarefaId={tarefaId}
                compacto={true}
                onUploadComplete={() => setAnexosEnviados(n => n + 1)}
             />
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <button 
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-500 hover:bg-surface/50 rounded-lg text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button 
              onClick={() => onConfirm(comentario)}
              // Desabilita se NÃO tiver comentário E NÃO tiver anexo
              disabled={!podeConcluir || isSaving}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors
                ${podeConcluir 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              `}
            >
              {isSaving ? 'Concluindo...' : 'Concluir Tarefa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}