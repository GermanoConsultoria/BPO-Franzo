'use client'

import { toggleStatusProjeto } from '@/app/actions'
import { useTransition } from 'react'

export default function BotaoStatusProjeto({ projetoId, ativo }: { projetoId: string, ativo: boolean }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button 
      onClick={() => startTransition(() => toggleStatusProjeto(projetoId))}
      disabled={isPending}
      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-2
        ${ativo 
          ? 'text-red-600 border-red-200 hover:bg-red-50' 
          : 'text-green-600 border-green-200 hover:bg-green-50'
        }
      `}
      title={ativo ? "Arquivar projeto (oculta tarefas)" : "Reativar projeto"}
    >
      {isPending ? '...' : (ativo ? '⛔ Inativar' : '✅ Reativar')}
    </button>
  )
}