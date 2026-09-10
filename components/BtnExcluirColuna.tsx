'use client'

import { useFormStatus } from 'react-dom'

export default function BtnExcluirColuna() {
  const { pending } = useFormStatus()

  return (
    <button 
      className="text-gray-300 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50 disabled:opacity-50" 
      title="Excluir Coluna"
      disabled={pending}
      onClick={(e) => {
         // Lógica do navegador (Client Side)
         if(!confirm('Tem certeza? Se houver tarefas nessa coluna, a exclusão pode falhar.')) {
            e.preventDefault();
         }
      }}
    >
      {pending ? '...' : '🗑️'}
    </button>
  )
}