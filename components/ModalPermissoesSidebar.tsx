'use client'

import { useState, useTransition } from 'react'
import { X, Shield } from 'lucide-react'
import { atualizarPermissoesSidebar } from '@/app/actions'
import { toast } from 'sonner'

const ITENS_SIDEBAR = [
  { chave: 'inicio',      label: 'Início' },
  { chave: 'financeiro',  label: 'Financeiro' },
  { chave: 'projetos',    label: 'Projetos' },
  { chave: 'tarefas',     label: 'Tarefas' },
  { chave: 'sprint',      label: 'Sprint' },
  { chave: 'dashboards',  label: 'Dashboards' },
  { chave: 'portfolio',   label: 'Portfólio' },
  { chave: 'recursos',    label: 'Recursos' },
  { chave: 'relatorio',   label: 'Relatório' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  usuario: {
    id: string
    nome: string
    permissoes_sidebar?: string | null
  }
}

export default function ModalPermissoesSidebar({ isOpen, onClose, usuario }: Props) {
  const permissoesAtuais: string[] = usuario.permissoes_sidebar
    ? JSON.parse(usuario.permissoes_sidebar)
    : ITENS_SIDEBAR.map(i => i.chave)

  const [selecionados, setSelecionados] = useState<string[]>(permissoesAtuais)
  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  function toggle(chave: string) {
    setSelecionados(prev =>
      prev.includes(chave) ? prev.filter(c => c !== chave) : [...prev, chave]
    )
  }

  function handleSalvar() {
    startTransition(async () => {
      await atualizarPermissoesSidebar(usuario.id, selecionados)
      toast.success('Permissões atualizadas.')
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-indigo-400" />
            <h2 className="font-semibold text-foreground">Permissões da Sidebar</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-xs text-gray-500 mb-4">
            Selecione quais itens <span className="text-foreground font-medium">{usuario.nome}</span> pode ver na sidebar.
          </p>
          <div className="space-y-1">
            {ITENS_SIDEBAR.map(item => (
              <label key={item.chave} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-highlight cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selecionados.includes(item.chave)}
                  onChange={() => toggle(item.chave)}
                  className="w-4 h-4 rounded accent-indigo-500"
                />
                <span className="text-sm text-foreground">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={isPending}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
