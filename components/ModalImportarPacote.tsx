'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { importarPacoteTarefas } from '@/app/actions'
import { Package, Plus, Calendar, User, AlertCircle, Gauge } from 'lucide-react'
import type { ColunaBasica, UsuarioBasico } from '@/types'

interface TarefaTemplate {
  id: string
  titulo: string
  descricao?: string | null
}

interface PacoteOpcao {
  id: string
  nome: string
  tarefas: TarefaTemplate[]
}

interface Props {
  projetoId: string
  equipeId: string
  pacotes: PacoteOpcao[]
  colunas: ColunaBasica[]
  usuarios: UsuarioBasico[]
}

export default function ModalImportarPacote({ projetoId, equipeId, pacotes, colunas, usuarios }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (pacotes.length === 0) return null

  const handleImportar = (formData: FormData) => {
    startTransition(async () => {
      const resultado = await importarPacoteTarefas(formData)
      if (!resultado.success) {
        toast.error(resultado.error)
        return
      }
      toast.success(`${resultado.data.count} tarefa(s) importada(s) com sucesso.`)
      setIsOpen(false)
    })
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
      >
        <Package size={16} /> Importar Pacote
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            
            <div className="px-6 py-4 border-b border-border bg-surface-highlight/20 flex justify-between items-center">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Package size={18} className="text-indigo-500" /> Injetar Tarefas
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form action={handleImportar}>
                <input type="hidden" name="projetoId" value={projetoId} />
                <input type="hidden" name="equipeId" value={equipeId} />

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                  
                  {/* ESCOLHAS OBRIGATÓRIAS */}
                  <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-2">Qual pacote deseja importar? *</label>
                        <select name="pacoteId" required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground font-medium">
                            <option value="">Selecione um pacote...</option>
                            {pacotes.map(p => (
                                <option key={p.id} value={p.id}>{p.nome} ({p.tarefas.length} tarefas)</option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-2">Em qual etapa? *</label>
                        <select name="colunaId" required className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground font-medium">
                            <option value="">Selecione uma etapa...</option>
                            {colunas.map(c => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                        </select>
                      </div>
                  </div>

                  <hr className="border-border" />

                  {/* ATRIBUIÇÕES EM LOTE (OPCIONAIS) */}
                  <div>
                      <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                          Configurações em Lote <span className="text-xs font-normal text-gray-400">(Opcional)</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                          
                          {/* Responsável */}
                          <div className="col-span-2">
                              <label className="flex items-center gap-1 text-xs text-text-muted mb-1"><User size={12}/> Responsável por todas</label>
                              <select name="usuarioId" className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm outline-none">
                                  <option value="">Deixar sem responsável</option>
                                  {usuarios.map(u => (
                                      <option key={u.id} value={u.id}>{u.nome}</option>
                                  ))}
                              </select>
                          </div>

                          {/* Vencimento */}
                          <div className="col-span-2">
                              <label className="flex items-center gap-1 text-xs text-text-muted mb-1"><Calendar size={12}/> Prazo para todas</label>
                              <input type="date" name="dtVencimento" className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm outline-none text-foreground" />
                          </div>

                          {/* Prioridade */}
                          <div>
                              <label className="flex items-center gap-1 text-xs text-text-muted mb-1"><AlertCircle size={12}/> Prioridade</label>
                              <select name="prioridadeId" className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm outline-none">
                                  <option value="">Manter Padrão</option>
                                  <option value="1">Baixa</option>
                                  <option value="2">Média</option>
                                  <option value="3">Alta</option>
                              </select>
                          </div>

                          {/* Dificuldade */}
                          <div>
                              <label className="flex items-center gap-1 text-xs text-text-muted mb-1"><Gauge size={12}/> Dificuldade</label>
                              <select name="dificuldadeId" className="w-full bg-background border border-border rounded px-2 py-1.5 text-sm outline-none">
                                  <option value="">Manter Padrão</option>
                                  <option value="1">Fácil</option>
                                  <option value="2">Média</option>
                                  <option value="3">Difícil</option>
                              </select>
                          </div>

                      </div>
                  </div>

                </div>

                <div className="px-6 py-4 bg-surface-highlight/10 border-t border-border flex justify-end gap-2">
                  <button type="button" onClick={() => setIsOpen(false)} disabled={isPending} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-foreground">
                      Cancelar
                  </button>
                  <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">
                      {isPending ? 'Injetando...' : <><Plus size={16}/> Injetar Agora</>}
                  </button>
                </div>
            </form>

          </div>
        </div>
      )}
    </>
  )
}