'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { criarTarefa } from '@/app/actions'
import type { UsuarioBasico, ColunaBasica } from '@/types'

interface Props {
  projetoId: string
  colunas?: ColunaBasica[]
  usuarios?: UsuarioBasico[]
}

export default function BotaoNovaTarefa({ projetoId, colunas = [], usuarios = [] }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function handleAction(formData: FormData) {
    setIsSaving(true)

    const titulo = formData.get('titulo') as string
    const descricao = formData.get('descricao') as string
    const prioridadeId = formData.get('prioridadeId')
    const dificuldadeId = formData.get('dificuldadeId')
    const usuarioId = formData.get('usuarioId') as string
    const dtVencimento = formData.get('dtVencimento') as string
    const colunaId = formData.get('colunaId') as string

    // Validação Básica
    if (!titulo || !usuarioId) {
        toast.error('Preencha o título e selecione um responsável.')
        setIsSaving(false)
        return
    }

    // CORREÇÃO DE DATA (Meio-dia)
    let dataIso = null
    if (dtVencimento) {
        const d = new Date(dtVencimento)
        d.setHours(12, 0, 0, 0)
        dataIso = d
    }

    // Envia como Objeto, não como FormData
    await criarTarefa({
        titulo,
        descricao,
        dt_vencimento: dataIso,
        projeto_id: projetoId,
        coluna_id: colunaId,
        usuario_id: usuarioId,
        prioridade_id: Number(prioridadeId || 2),
        dificuldade_id: Number(dificuldadeId || 3)
    })

    setIsSaving(false)
    setIsOpen(false)
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 text-white px-3 py-2 rounded text-sm font-bold"
      >
        + Nova Tarefa
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface p-6 rounded-lg w-full max-w-md shadow-xl border border-border">
            <h2 className="text-lg font-bold mb-4 text-foreground">Nova Tarefa</h2>
            
            <form action={handleAction} className="space-y-3">
              <input type="hidden" name="projetoId" value={projetoId} />

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase">Título</label>
                <input name="titulo" required className="w-full border border-border bg-background rounded p-2 text-foreground" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase">Descrição</label>
                <textarea name="descricao" className="w-full border border-border bg-background rounded p-2 text-foreground" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase">Prioridade</label>
                    <select name="prioridadeId" className="w-full border border-border bg-background rounded p-2 text-foreground">
                        <option value="1">Baixa</option>
                        <option value="2" selected>Média</option>
                        <option value="3">Alta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase">Dificuldade</label>
                    <select name="dificuldadeId" className="w-full border border-border bg-background rounded p-2 text-foreground">
                        <option value="2">Fácil</option>
                        <option value="3" selected>Média</option>
                        <option value="4">Difícil</option>
                    </select>
                  </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase">Vencimento</label>
                <input type="date" name="dtVencimento" className="w-full border border-border bg-background rounded p-2 text-foreground scheme-dark" />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase">Responsável</label>
                <select name="usuarioId" required className="w-full border border-border bg-background rounded p-2 text-foreground">
                    <option value="">Selecione...</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-text-muted">Cancelar</button>
                <button type="submit" disabled={isSaving} className="bg-indigo-600 text-white px-4 py-2 rounded">
                    {isSaving ? 'Salvando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}