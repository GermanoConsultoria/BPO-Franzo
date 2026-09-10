'use client'

import { useState } from 'react'
import { Trash2, Edit2, Check, X } from 'lucide-react'
import { editarTarefaTemplate, removerTarefaTemplate } from '@/app/actions'

interface Props {
    tarefa: { id: string, titulo: string, descricao: string | null }
    equipeId: string
}

export default function ItemTarefaTemplate({ tarefa, equipeId }: Props) {
    const [isEditing, setIsEditing] = useState(false)

    // --- MODO EDIÇÃO ---
    if (isEditing) {
        return (
            <li className="bg-surface-highlight/20 px-3 py-3 rounded-lg border border-indigo-300 shadow-sm transition-all">
                <form action={async (formData) => {
                    await editarTarefaTemplate(formData)
                    setIsEditing(false) // Fecha a edição ao salvar
                }} className="flex flex-col gap-2">
                    <input type="hidden" name="tarefaId" value={tarefa.id} />
                    <input type="hidden" name="equipeId" value={equipeId} />
                    
                    <input 
                        name="titulo" 
                        defaultValue={tarefa.titulo}
                        className="w-full bg-surface border border-border rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-foreground font-bold"
                        required
                    />
                    <textarea 
                        name="descricao" 
                        defaultValue={tarefa.descricao || ''}
                        rows={3}
                        className="w-full bg-surface border border-border rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-foreground resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-1">
                        <button type="button" onClick={() => setIsEditing(false)} className="text-xs font-medium text-gray-500 hover:text-foreground px-2 py-1 flex items-center gap-1">
                            <X size={14} /> Cancelar
                        </button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm transition-colors flex items-center gap-1">
                            <Check size={14} /> Salvar Alterações
                        </button>
                    </div>
                </form>
            </li>
        )
    }

    // --- MODO VISUALIZAÇÃO ---
    return (
        <li className="flex justify-between items-start bg-surface px-3 py-2.5 rounded-lg border border-border/50 group hover:border-border transition-colors">
            <div className="pr-4">
                <span className="text-sm font-bold text-foreground block">{tarefa.titulo}</span>
                {tarefa.descricao && (
                    <span className="text-xs text-text-muted mt-1 block whitespace-pre-wrap">
                        {tarefa.descricao}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                <button 
                    onClick={() => setIsEditing(true)} 
                    type="button" 
                    title="Editar Tarefa"
                    className="text-gray-400 hover:text-indigo-500 p-1.5 rounded hover:bg-surface-highlight transition-colors"
                >
                    <Edit2 size={14} />
                </button>
                <form action={removerTarefaTemplate}>
                    <input type="hidden" name="tarefaId" value={tarefa.id} />
                    <input type="hidden" name="equipeId" value={equipeId} />
                    <button 
                        title="Excluir Tarefa"
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-surface-highlight transition-colors"
                    >
                        <Trash2 size={14} />
                    </button>
                </form>
            </div>
        </li>
    )
}