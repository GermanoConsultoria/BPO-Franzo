'use client'
import { toggleStatusUsuario } from '@/app/actions'

export default function BotaoStatusUsuario({ id, ativo }: { id: string, ativo: boolean }) {
  return (
    <button
      onClick={() => toggleStatusUsuario(id)}
      className={`text-xs font-medium px-3 py-1.5 rounded transition-colors border ${
        ativo 
          ? 'text-red-400 border-red-900/30 hover:bg-red-900/20' 
          : 'text-green-400 border-green-900/30 hover:bg-green-900/20'
      }`}
    >
      {ativo ? 'Inativar Acesso' : 'Reativar Acesso'}
    </button>
  )
}