'use client'

import { useState, useTransition } from 'react'
import { Github, Plus, Trash2 } from 'lucide-react'
import { desvincularContaGithub } from '@/app/actions'
import type { EquipeCompleta } from '@/types'

export default function GerenciadorGithub({ equipe }: { equipe: EquipeCompleta }) {
  const [isPending, startTransition] = useTransition()
  const [removendoId, setRemovendoId] = useState<string | null>(null)

  const handleDesvincular = (contaId: string) => {
    setRemovendoId(contaId)
    startTransition(async () => {
      await desvincularContaGithub(contaId)
      setRemovendoId(null)
    })
  }

  return (
    <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          <Github size={16} /> Integração GitHub
        </h2>
        <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-bold">
          {equipe.contasGithub.length}
        </span>
      </div>

      <p className="text-xs text-text-muted mb-4">
        Vincule uma ou mais contas do GitHub a esta equipe. Depois, ao criar ou editar um projeto,
        você poderá escolher qual repositório corresponde a ele — cada push nesse repositório vira
        automaticamente uma tarefa no projeto.
      </p>

      {equipe.contasGithub.length === 0 ? (
        <div className="p-6 text-center border-2 border-dashed border-border rounded-xl text-gray-400 text-sm mb-4">
          Nenhuma conta do GitHub vinculada ainda.
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {equipe.contasGithub.map(conta => (
            <div
              key={conta.id}
              className="flex items-center justify-between p-3 bg-background border border-border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                  <Github size={16} />
                </div>
                <span className="text-sm font-bold text-foreground">{conta.github_login}</span>
              </div>
              <button
                onClick={() => handleDesvincular(conta.id)}
                disabled={isPending && removendoId === conta.id}
                title="Desvincular conta"
                className="text-gray-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <a
        href={`/api/integracoes/github/authorize?equipeId=${equipe.id}`}
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
      >
        <Plus size={16} /> Ativar GitHub
      </a>
    </div>
  )
}
