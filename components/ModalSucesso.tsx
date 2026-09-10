'use client'

import { CheckCircle } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  titulo: string
  descricao?: string
}

export default function ModalSucesso({ 
  isOpen, 
  onClose, 
  titulo, 
  descricao 
}: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Janela */}
      <div className="relative bg-surface w-full max-w-sm rounded-xl border border-border shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        
        <div className="flex flex-col items-center text-center">
            {/* Ícone Verde de Sucesso */}
            <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mb-4">
                <CheckCircle size={24} />
            </div>
            
            <h3 className="text-lg font-bold text-foreground mb-2">
                {titulo}
            </h3>
            
            {descricao && (
                <p className="text-sm text-text-muted mb-6">
                    {descricao}
                </p>
            )}

            {/* Botão Único */}
            <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-green-500/20 transition-all"
            >
                Entendido
            </button>
        </div>

      </div>
    </div>
  )
}