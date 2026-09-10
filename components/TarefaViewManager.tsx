'use client'

import { useState, useRef, useEffect } from 'react'
import { DndProvider, useDragLayer } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import CardKanban from './CardKanban'
import ColunaKanban from './ColunaKanban'
import ModalTarefa from './ModalTarefa'
import type { TarefaComRelacoes, UsuarioBasico, ColunaBasica, ProjetoComColunas } from '@/types'

// --- COMPONENTE INTERNO (SCROLL + LAYOUT) ---
function KanbanBoardContent({
  tarefas,
  usuarios,
  colunasParaMostrar,
  tarefasPorColuna,
  usuarioId
}: {
  tarefas: TarefaComRelacoes[]
  usuarios: UsuarioBasico[]
  colunasParaMostrar: ColunaBasica[]
  tarefasPorColuna: Record<string, TarefaComRelacoes[]>
  usuarioId: string
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const mouseXRef = useRef(0)

  const { isDragging } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
  }))

  useEffect(() => {
    const update = (e: MouseEvent | DragEvent) => { mouseXRef.current = e.clientX }
    window.addEventListener('mousemove', update)
    window.addEventListener('dragover', update as EventListener)
    return () => {
      window.removeEventListener('mousemove', update)
      window.removeEventListener('dragover', update as EventListener)
    }
  }, [])

  useEffect(() => {
    if (!isDragging) return

    let animationFrameId: number
    const speed = 12
    const edgeZone = 120

    const scrollLoop = () => {
      const container = scrollContainerRef.current
      if (container) {
        const { left, right } = container.getBoundingClientRect()
        const mouseX = mouseXRef.current
        let moveX = 0
        if (mouseX < left + edgeZone && mouseX > left) moveX = -speed
        else if (mouseX > right - edgeZone && mouseX < right) moveX = speed
        if (moveX !== 0) container.scrollLeft += moveX
      }
      animationFrameId = requestAnimationFrame(scrollLoop)
    }
    scrollLoop()
    return () => cancelAnimationFrame(animationFrameId)
  }, [isDragging])

  return (
    <div 
      ref={scrollContainerRef}
      className="flex gap-6 overflow-x-auto px-2 h-full items-start custom-scrollbar w-full pb-4"
      style={{ scrollBehavior: 'auto' }} 
    >
      {/* Aviso Vazio */}
      {colunasParaMostrar.length === 0 && !tarefas.some(t => !t.coluna_id) && (
          <div className="w-full h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-border rounded-xl bg-surface/50/50">
              <p>Nenhuma tarefa encontrada.</p>
          </div>
      )}

      {/* COLUNA NÃO CLASSIFICADO */}
      {tarefas.some(t => !t.coluna_id) && (
            <div className="min-w-[300px] w-[300px] flex-shrink-0 flex flex-col bg-red-50/30 rounded-xl border border-red-100 border-dashed h-full max-h-full">
              <div className="p-3 border-b border-red-100 flex justify-between items-center bg-red-50/50 rounded-t-xl">
                  <h3 className="text-sm font-bold text-red-400 uppercase">⚠️ Não Classificado</h3>
                  <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                    {tarefas.filter(t => !t.coluna_id).length}
                  </span>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto custom-scrollbar-thin flex-1">
                  {tarefas.filter(t => !t.coluna_id).map(tarefa => (
                      <CardKanban key={tarefa.id} tarefa={tarefa} usuarios={usuarios} usuarioId={usuarioId}/>
                  ))}
              </div>
            </div>
      )}

      {/* COLUNAS REAIS */}
      {colunasParaMostrar.map(coluna => (
        <div key={coluna.id} className="h-full"> 
            <ColunaKanban 
              coluna={coluna}
              tarefas={tarefasPorColuna[coluna.id] || []}
              usuarios={usuarios}
              projetoId={tarefasPorColuna[coluna.id]?.[0]?.projeto_id || tarefas[0]?.projeto_id}
              usuarioId={usuarioId}
            />
        </div>
      ))}
      
      {/* Espaçador final para o scroll não colar na última coluna */}
      <div className="w-4 flex-shrink-0 h-1"></div>
    </div>
  )
}

// --- COMPONENTE PRINCIPAL ---

interface Props {
  tarefas: any[]
  usuarios: any[]
  projetos: any[]
  todasColunas?: any[] 
  mostrarVazias?: boolean
  usuarioId: string
}

export default function TarefaViewManager({ tarefas, usuarios, projetos, todasColunas = [], mostrarVazias = false, usuarioId }: Props) {
  const [view, setView] = useState<'LISTA' | 'QUADRO'>('QUADRO')
  const [selectedTarefa, setSelectedTarefa] = useState<any>(null)

  let colunasParaMostrar = todasColunas;
  if (!mostrarVazias) {
    const idsColunasComTarefas = new Set(tarefas.map(t => t.coluna_id).filter(Boolean));
    colunasParaMostrar = todasColunas.filter(col => idsColunasComTarefas.has(col.id));
  }

  const tarefasPorColuna: Record<string, any[]> = {};
  tarefas.forEach(t => {
    if (t.coluna_id) {
        if (!tarefasPorColuna[t.coluna_id]) tarefasPorColuna[t.coluna_id] = [];
        tarefasPorColuna[t.coluna_id].push(t);
    }
  });

  return (
    <div className="space-y-4 h-full flex flex-col">
      
      {/* CSS PARA BARRAS DE ROLAGEM VISÍVEIS (Mouse Friendly) */}
      <style jsx global>{`
        /* Barra Horizontal do Quadro - Grossa e Visível */
        .custom-scrollbar::-webkit-scrollbar {
          height: 16px; /* Altura confortável para mouse */
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9; /* Fundo claro */
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #94a3b8; /* Cinza visível */
          border-radius: 4px;
          border: 3px solid #f1f5f9; /* Espaço ao redor */
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #64748b; /* Mais escuro ao passar o mouse */
        }

        /* Barra Vertical (Dentro das Colunas) - Um pouco mais discreta */
        .custom-scrollbar-thin::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }
      `}</style>

      {/* Toggle View */}
      <div className="flex items-center gap-2 bg-surface p-1 rounded-lg w-fit border border-border shadow-sm flex-shrink-0">
        <button onClick={() => setView('LISTA')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${view === 'LISTA' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-surface/50'}`}>📄 Lista</button>
        <button onClick={() => setView('QUADRO')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${view === 'QUADRO' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-surface/50'}`}>📋 Quadro</button>
      </div>

      {view === 'QUADRO' && (
        <DndProvider backend={HTML5Backend}>
           <div className="flex-1 min-h-0 relative">
             <KanbanBoardContent 
                tarefas={tarefas}
                usuarios={usuarios}
                colunasParaMostrar={colunasParaMostrar}
                tarefasPorColuna={tarefasPorColuna}
                usuarioId={usuarioId}
             />
           </div>
        </DndProvider>
      )}

      {view === 'LISTA' && (
        <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden flex-1 overflow-y-auto custom-scrollbar-thin">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface/50 z-10 shadow-sm">
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="p-4 w-8"></th>
                        <th className="p-4">Tarefa</th>
                        <th className="p-4">Projeto</th>
                        <th className="p-4">Etapa</th>
                        <th className="p-4">Responsável</th>
                        <th className="p-4 text-right">Prazo</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {tarefas.map(tarefa => (
                        <tr key={tarefa.id} onClick={() => setSelectedTarefa(tarefa)} className="hover:bg-surface/50 cursor-pointer transition-colors group">
                            <td className="p-4"><div className={`w-2 h-2 rounded-full ${tarefa.concluida ? 'bg-green-400' : 'bg-gray-300'}`}></div></td>
                            <td className="p-4"><span className={`font-medium ${tarefa.concluida ? 'line-through text-gray-400' : 'text-foreground'}`}>{tarefa.titulo}</span></td>
                            <td className="p-4"><span className="text-xs font-bold text-indigo-600 uppercase">{tarefa.projeto?.nome}</span></td>
                            <td className="p-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${tarefa.coluna ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                    {tarefa.coluna?.nome || 'Não Classificado'}
                                </span>
                            </td>
                            <td className="p-4">{tarefa.usuario ? <span className="text-gray-600">{tarefa.usuario.nome}</span> : <span className="text-gray-400 italic">--</span>}</td>
                            <td className="p-4 text-right text-gray-500 font-mono text-xs">{tarefa.dt_vencimento ? new Date(tarefa.dt_vencimento).toLocaleDateString('pt-BR') : '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}

      {selectedTarefa && (
          <ModalTarefa 
              tarefa={selectedTarefa} 
              isOpen={!!selectedTarefa} 
              onClose={() => setSelectedTarefa(null)} 
              usuarios={usuarios} 
              projetos={projetos}
              usuarioLogadoId={usuarioId}
          />
      )}
    </div>
  )
}