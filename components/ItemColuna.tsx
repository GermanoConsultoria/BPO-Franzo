'use client'

import { useState, useRef, useEffect } from 'react'
import BtnExcluirColuna from '@/components/BtnExcluirColuna'

interface Props {
  coluna: { id: string, nome: string }
  atualizarAction: (id: string, novoNome: string) => Promise<void>
  excluirAction: (formData: FormData) => Promise<void>
}

export default function ItemColuna({ coluna, atualizarAction, excluirAction }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [nome, setNome] = useState(coluna.nome)
  const inputRef = useRef<HTMLInputElement>(null)

  // Foca no input assim que entra no modo edição
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleSave = async () => {
    if (!nome.trim() || nome === coluna.nome) {
      setIsEditing(false)
      setNome(coluna.nome) // Reverte se vazio
      return
    }

    // Otimista: Fecha edição imediatamente
    setIsEditing(false)
    await atualizarAction(coluna.id, nome)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      setIsEditing(false)
      setNome(coluna.nome)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg group hover:border-indigo-300 transition-colors shadow-sm">
      <div className="flex items-center gap-3 flex-1">
        {/* Ícone / Letra */}
        <span className="w-8 h-8 rounded-lg bg-surface/50 flex items-center justify-center text-gray-500 text-xs font-bold border border-gray-100 flex-shrink-0">
          {nome.substring(0, 1).toUpperCase()}
        </span>

        {/* Lógica de Edição */}
        {isEditing ? (
          <input
            ref={inputRef}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={handleSave} // Salva ao clicar fora
            onKeyDown={handleKeyDown}
            className="flex-1 bg-white border border-indigo-500 rounded px-2 py-1 text-sm outline-none shadow-sm text-foreground"
          />
        ) : (
          <span 
            onClick={() => setIsEditing(true)}
            title="Clique para editar"
            className="font-medium text-foreground cursor-pointer hover:text-indigo-600 hover:underline decoration-dashed underline-offset-4 decoration-gray-300 transition-all flex-1"
          >
            {nome}
          </span>
        )}
      </div>

      {/* Botão de Excluir (Só aparece se não estiver editando para não atrapalhar) */}
      {!isEditing && (
        <form action={excluirAction} className="ml-4">
          <input type="hidden" name="id" value={coluna.id} />
          <BtnExcluirColuna />
        </form>
      )}
    </div>
  )
}