'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import ModalConfirmacao from './ModalConfirmacao'

interface Props {
  onConfirm: () => void | Promise<void>
  texto?: string // Se tiver texto, é um botão normal. Se não, é ícone (lixeira).
  titulo?: string
  descricao?: string
  disabled?: boolean
  className?: string // Para permitir customizar classes extras se precisar
}

export default function BotaoDeletar({ 
    onConfirm, 
    texto, 
    titulo = "Tem certeza?", 
    descricao = "Esta ação não poderá ser desfeita.", 
    disabled = false,
    className
}: Props) {
  const [modalAberto, setModalAberto] = useState(false)
  const [loading, setLoading] = useState(false)

  // Função chamada quando clica no "Sim" dentro do modal
  const handleConfirmAction = async () => {
    setLoading(true)
    try {
        await onConfirm()
        setModalAberto(false) // Fecha só se der sucesso
    } catch {
        toast.error('Erro ao excluir. Tente novamente.')
    } finally {
        setLoading(false)
    }
  }

  return (
    <>
        {/* PARTE 1: O Gatilho (Botão ou Ícone) */}
        {texto ? (
            // Modo Texto (ex: Rodapé da Tarefa)
            <button 
                disabled={disabled || loading}
                onClick={(e) => { e.stopPropagation(); setModalAberto(true); }}
                className={`text-red-500 hover:text-red-600 text-sm font-medium px-2 hover:underline disabled:opacity-50 ${className || ''}`}
            >
                {texto}
            </button>
        ) : (
            // Modo Ícone (ex: Anexos)
            <button 
                disabled={disabled || loading}
                onClick={(e) => { e.stopPropagation(); setModalAberto(true); }}
                className={`text-text-muted hover:text-red-500 p-1.5 rounded-md hover:bg-red-500/10 transition-all disabled:opacity-50 ${className || ''}`}
                title="Excluir"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>
        )}

        {/* PARTE 2: A Telinha (Portal) */}
        <ModalConfirmacao 
            isOpen={modalAberto}
            onClose={() => setModalAberto(false)}
            onConfirm={handleConfirmAction}
            loading={loading}
            titulo={titulo}
            descricao={descricao}
        />
    </>
  )
}