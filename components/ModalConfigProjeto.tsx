'use client'

import { useState } from 'react'
import { vincularMultiplasColunas, desvincularColunaDoProjeto } from '@/app/actions'
import type { ProjetoBasico, ColunaBasica } from '@/types'

interface ProjetoColuna {
  coluna_id: string
  ordem: number
  coluna: ColunaBasica
}

interface Props {
  projeto: ProjetoBasico
  colunasDisponiveis: ColunaBasica[]
  colunasDoProjeto: ProjetoColuna[]
}

export default function ModalConfigProjeto({ projeto, colunasDisponiveis, colunasDoProjeto }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Estado para controlar visualmente o loading do botão Salvar
  const [isSaving, setIsSaving] = useState(false)

  // Filtra as colunas que AINDA NÃO estão no projeto (disponíveis para adicionar)
  const idsUsados = new Set(colunasDoProjeto.map(c => c.coluna_id))
  const colunasParaAdicionar = colunasDisponiveis.filter(c => !idsUsados.has(c.id))

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-surface/50 transition-colors"
        title="Configurar Etapas do Projeto"
      >
        ⚙️ Configurar Etapas
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-surface/50">
          <div>
            <h3 className="font-bold text-foreground text-lg">Configurar Fluxo</h3>
            <p className="text-xs text-gray-500">Adicione ou remova etapas deste projeto.</p>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 p-2">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* 1. LISTA DE ETAPAS JÁ ADICIONADAS (REMOVER) */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              ✅ Etapas Ativas no Projeto
              <span className="bg-surface/50 text-gray-600 px-2 py-0.5 rounded-full text-[10px]">{colunasDoProjeto.length}</span>
            </h4>
            
            {colunasDoProjeto.length === 0 ? (
               <div className="text-sm text-gray-400 italic bg-surface/50 p-4 rounded-lg text-center border border-dashed border-border">
                 Projeto sem etapas. Selecione abaixo para começar.
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {colunasDoProjeto.map((pc) => (
                  <div key={pc.coluna_id} className="flex items-center justify-between p-2 pl-3 bg-surface border border-indigo-100 rounded-lg shadow-sm group hover:border-red-200 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="w-5 h-5 min-w-[20px] rounded bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                        {pc.ordem}
                      </span>
                      <span className="font-medium text-foreground text-sm truncate" title={pc.coluna.nome}>{pc.coluna.nome}</span>
                    </div>
                    
                    <form action={desvincularColunaDoProjeto}>
                      <input type="hidden" name="projetoId" value={projeto.id} />
                      <input type="hidden" name="colunaId" value={pc.coluna_id} />
                      <button className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="Remover etapa">
                        🗑️
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* 2. CHECKLIST PARA ADICIONAR NOVAS */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              ➕ Adicionar Etapas Disponíveis
            </h4>
            
            <form 
              action={async (formData) => {
                setIsSaving(true)
                await vincularMultiplasColunas(formData)
                setIsSaving(false)
                // Opcional: Fechar modal após salvar
                // setIsOpen(false) 
              }}
            >
              <input type="hidden" name="projetoId" value={projeto.id} />

              {colunasParaAdicionar.length === 0 ? (
                <p className="text-sm text-gray-400 mb-4">Todas as colunas da biblioteca já foram adicionadas.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {colunasParaAdicionar.map(c => (
                    <label 
                      key={c.id} 
                      className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-surface/50 hover:border-gray-300 transition-all select-none active:scale-[0.98]"
                    >
                      <input 
                        type="checkbox" 
                        name="colunasIds" 
                        value={c.id} 
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                      <span className="text-sm color-foreground">{c.nome}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* BARRA DE AÇÃO FIXA EMBAIXO SE TIVER ITEM */}
              {colunasParaAdicionar.length > 0 && (
                <div className="flex justify-end">
                   <button 
                     disabled={isSaving}
                     className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2.5 rounded-lg font-medium shadow-md shadow-rose-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                   >
                     {isSaving ? 'Salvando...' : '💾 Salvar Selecionados'}
                   </button>
                </div>
              )}
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}