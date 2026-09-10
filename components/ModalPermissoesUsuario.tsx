'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { atualizarPermissoesUsuario } from '@/app/actions'
import { PERMISSOES_LABEL, type PermissaoChave } from '@/lib/permissoes'

interface Props {
  isOpen: boolean
  onClose: () => void
  usuario: { id: string; nome: string }
  permissoesAtuais: string[]
}

export default function ModalPermissoesUsuario({ isOpen, onClose, usuario, permissoesAtuais }: Props) {
  const [selecionadas, setSelecionadas] = useState<string[]>(permissoesAtuais)
  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  const toggle = (chave: string) => {
    setSelecionadas(prev => prev.includes(chave) ? prev.filter(c => c !== chave) : [...prev, chave])
  }

  const handleSalvar = () => {
    startTransition(async () => {
      const res = await atualizarPermissoesUsuario(usuario.id, selecionadas)
      if (res.success) {
        toast.success('Permissões atualizadas.')
        onClose()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface w-full max-w-md rounded-xl border border-border shadow-2xl p-6 animate-in zoom-in-95">

        <div className="flex items-center gap-3 mb-4 text-indigo-500">
          <div className="bg-indigo-500/10 p-2 rounded-lg">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-lg font-bold text-foreground">Permissões</h2>
        </div>

        <p className="text-sm text-text-muted mb-4">
          Ajustando o acesso de: <strong className="text-foreground">{usuario.nome}</strong>
        </p>

        <div className="space-y-2 mb-6">
          {(Object.entries(PERMISSOES_LABEL) as [PermissaoChave, string][]).map(([chave, label]) => (
            <label key={chave} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="accent-indigo-600"
                checked={selecionadas.includes(chave)}
                onChange={() => toggle(chave)}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm text-text-muted hover:text-foreground font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={isPending}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 className="animate-spin" size={16} /> : 'Salvar Permissões'}
          </button>
        </div>
      </div>
    </div>
  )
}
