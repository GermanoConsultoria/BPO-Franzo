'use client'

import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import {
    toggleConcluida,
    moverTarefaDeColuna,
    concluirTarefaComComentario,
    reordenarColunas,
    atualizarOrdemTarefas,
    atualizarDatasEtapa
} from '@/app/actions'
import CalendarView from './CalendarView'
import ModalTarefa from './ModalTarefa'
import ModalConclusao from './ModalConclusao'

import { DndProvider, useDrag, useDrop, useDragLayer } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import type { TarefaComRelacoes, UsuarioBasico, ProjetoComColunas, ColunaBasica } from '@/types'
import { extrairDataYMD, formatarDataBR, hojeNoFusoBrasil, parseDateLocal } from '@/lib/date'

interface Props {
  tarefasIniciais: TarefaComRelacoes[]
  listaProjetos: ProjetoComColunas[]
  usuarios?: UsuarioBasico[]
  colunas?: ColunaBasica[]
  tituloPagina?: string
  enableCalendarNavigation?: boolean
  initialCalendarDate?: string
  calendarViewMode?: 'SEMANA' | 'MES'
  agrupamento?: 'PROJETO' | 'COLUNA'
  esconderFiltroProjeto?: boolean
  usuarioLogadoId: string
  defaultStatusFilter?: string
}

const ItemTypes = {
  TASK: 'KANBAN_TASK',
  COLUMN: 'KANBAN_COLUMN'
}

const EMPTY_COLUNAS: ColunaBasica[] = []

// --- 1. HOOK DE AUTO-SCROLL ---
function useAutoScroll(scrollContainerRef: React.RefObject<HTMLDivElement | null>) {
    const isDraggingRef = useRef(false)
    
    useDragLayer(monitor => {
        isDraggingRef.current = monitor.isDragging()
        return {}
    })

    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        let animationFrameId: number
        let mouseX = 0

        const handleMouseMove = (e: MouseEvent) => {
            mouseX = e.clientX
        }

        const autoScrollLoop = () => {
            if (isDraggingRef.current && container) {
                const { left, right } = container.getBoundingClientRect()
                const edgeSize = 300
                const maxSpeed = 25

                if (mouseX < left + edgeSize && mouseX > 0) {
                    const intensity = Math.max(0, (left + edgeSize - mouseX) / edgeSize)
                    container.scrollLeft -= maxSpeed * intensity
                } 
                else if (mouseX > right - edgeSize && mouseX < window.innerWidth) {
                    const intensity = Math.max(0, (mouseX - (right - edgeSize)) / edgeSize)
                    container.scrollLeft += maxSpeed * intensity
                }
            }
            animationFrameId = requestAnimationFrame(autoScrollLoop)
        }

        autoScrollLoop()
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('dragover', handleMouseMove)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('dragover', handleMouseMove)
            cancelAnimationFrame(animationFrameId)
        }
    }, [scrollContainerRef])
}

// --- 2. CONTAINER COM AUTO SCROLL ---
const KanbanBoardContainer = ({ children }: { children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null)
    useAutoScroll(ref) 

    return (
        <div 
            ref={ref}
            className="h-full overflow-x-auto overflow-y-hidden flex gap-4 pb-2 custom-scrollbar"
        >
            {children}
        </div>
    )
}

// --- 3. COMPONENTE PRINCIPAL ---
export default function MinhasTarefasView({ 
    tarefasIniciais, 
    listaProjetos, 
    usuarios = [], 
    colunas = EMPTY_COLUNAS,
    enableCalendarNavigation = true, 
    initialCalendarDate,
    calendarViewMode,
    agrupamento = 'PROJETO', 
    esconderFiltroProjeto = false,
    usuarioLogadoId,
    defaultStatusFilter = 'TODOS'
}: Props) {
  const getColunaId = (t: TarefaComRelacoes) => {
      return t.coluna_id || t.coluna?.id || null
  }
  const [view, setView] = useState<'LISTA' | 'QUADRO' | 'CALENDARIO'>('QUADRO')
  const [isPending, startTransition] = useTransition()
  const [selectedTarefa, setSelectedTarefa] = useState<TarefaComRelacoes | null>(null)
  const [tarefaParaConcluir, setTarefaParaConcluir] = useState<string | null>(null)
  const [colunasOrdenadas, setColunasOrdenadas] = useState<ColunaBasica[]>(colunas ?? [])

  useEffect(() => {
    setColunasOrdenadas(prev => {
      const novas = colunas ?? []
      const idsAntigos = JSON.stringify(prev.map(c => c.id))
      const idsNovos = JSON.stringify(novas.map(c => c.id))
      if (idsAntigos !== idsNovos) return novas
      // IDs iguais: preserva a ordem atual, mas atualiza datas e outros campos
      const mapaNovas = Object.fromEntries(novas.map(c => [c.id, c]))
      return prev.map(c => ({ ...c, ...mapaNovas[c.id] }))
    })
  }, [colunas])

  const [busca, setBusca] = useState('')
  const [projetoId, setProjetoId] = useState('')
  const [prioridadeFilter, setPrioridadeFilter] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter)

  const formatarData = (dataOriginal: Date | string | null) => {
    const r = formatarDataBR(dataOriginal)
    return r === '-' ? null : r
  }

  const getPriorityColor = (id: number) => {
    if(id === 3) return 'bg-red-500/10 text-red-500 border-red-500/20'
    if(id === 2) return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    return 'bg-green-500/10 text-green-500 border-green-500/20'
  }

  const handleCheck = (tarefaId: string, concluidaAtual: boolean, projetoId: string) => {
    if (!concluidaAtual) {
        setTarefaParaConcluir(tarefaId)
    } else {
        startTransition(() => {
            toggleConcluida(tarefaId, false, projetoId)
        })
    }
  }

  const confirmarConclusao = (comentario: string) => {
    if (!tarefaParaConcluir) return
    const tarefa = tarefasIniciais.find(t => t.id === tarefaParaConcluir)
    if (!tarefa) return
    const quemConcluiuId = usuarios[0]?.id || tarefa.usuario_id 

    startTransition(async () => {
        await concluirTarefaComComentario(tarefaParaConcluir, comentario, tarefa.projeto_id, quemConcluiuId ?? '')
        setTarefaParaConcluir(null) 
    })
  }

  const trocarColunas = useCallback((dragIndex: number, hoverIndex: number) => {
     const novasColunas = [...colunasOrdenadas]
     const [colunaRemovida] = novasColunas.splice(dragIndex, 1)
     novasColunas.splice(hoverIndex, 0, colunaRemovida)
     setColunasOrdenadas(novasColunas)

     const projetoAtualId = listaProjetos[0]?.id
     if (projetoAtualId) {
         const idsNaOrdem = novasColunas.map(c => c.id)
         startTransition(async () => {
             await reordenarColunas(projetoAtualId, idsNaOrdem)
         })
     }
  }, [colunasOrdenadas, listaProjetos, startTransition])

  const tarefasFiltradas = tarefasIniciais.filter(t => {
    const matchTexto = t.titulo.toLowerCase().includes(busca.toLowerCase());
    const matchProjeto = (esconderFiltroProjeto || !projetoId) ? true : t.projeto_id === projetoId;
    let matchPrioridade = true;
    if (prioridadeFilter === 'ALTA') matchPrioridade = t.prioridade_id === 3;
    if (prioridadeFilter === 'MEDIA') matchPrioridade = t.prioridade_id === 2;
    if (prioridadeFilter === 'BAIXA') matchPrioridade = t.prioridade_id === 1;
    const matchUsuario = usuarioId ? t.usuario_id === usuarioId : true;
    let matchStatus = true;
    if (statusFilter === 'PENDENTE') matchStatus = !t.concluida;
    if (statusFilter === 'CONCLUIDA') matchStatus = t.concluida;
    return matchTexto && matchProjeto && matchPrioridade && matchUsuario && matchStatus;
  });

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full">
        
        {/* BARRA DE CONTROLE */}
        <div className="bg-surface p-4 rounded-xl border border-border shadow-sm mb-6 flex flex-col xl:flex-row gap-4 justify-between items-center flex-shrink-0">
          <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto flex-1 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
                  <input type="text" placeholder="Buscar tarefa..." className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-foreground placeholder-text-muted"
                      value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <select className="px-3 py-2 border border-border rounded-lg outline-none bg-surface text-sm text-foreground"
                  value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="TODOS">Todas (Status)</option>
                  <option value="PENDENTE">🕒 Pendentes</option>
                  <option value="CONCLUIDA">✅ Concluídas</option>
              </select>
              {!esconderFiltroProjeto && (
                  <select className="px-3 py-2 border border-border rounded-lg outline-none bg-surface text-sm text-foreground"
                      value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
                      <option value="">Todos os Projetos</option>
                      {listaProjetos.map(p => (<option key={p.id} value={p.id}>{p.nome}</option>))}
                  </select>
              )}
              {usuarios.length > 0 && (
                  <select className="px-3 py-2 border border-border rounded-lg outline-none bg-surface text-sm text-foreground"
                      value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                      <option value="">Todos Responsáveis</option>
                      {usuarios.map(u => (<option key={u.id} value={u.id}>{u.nome}</option>))}
                  </select>
              )}
              <select className="px-3 py-2 border border-border rounded-lg outline-none bg-surface text-sm text-foreground"
                  value={prioridadeFilter} onChange={(e) => setPrioridadeFilter(e.target.value)}>
                  <option value="">Todas Prioridades</option>
                  <option value="ALTA">Alta</option>
                  <option value="MEDIA">Média</option>
                  <option value="BAIXA">Baixa</option>
              </select>
          </div>
          <div className="flex bg-surface-highlight p-1 rounded-lg flex-shrink-0 border border-border">
              <button onClick={() => setView('LISTA')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'LISTA' ? 'bg-surface text-indigo-400 shadow-sm' : 'text-text-muted hover:text-foreground'}`}>≣ Lista</button>
              <button onClick={() => setView('QUADRO')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'QUADRO' ? 'bg-surface text-indigo-400 shadow-sm' : 'text-text-muted hover:text-foreground'}`}>☷ Quadro</button>
              <button onClick={() => setView('CALENDARIO')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'CALENDARIO' ? 'bg-surface text-indigo-400 shadow-sm' : 'text-text-muted hover:text-foreground'}`}>📅 Calendário</button>
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          
          {/* MODO LISTA */}
          {view === 'LISTA' && (
              <div className="h-full overflow-y-auto bg-surface rounded-xl border border-border shadow-sm custom-scrollbar-thin">
                  {tarefasFiltradas.length === 0 ? <div className="p-10 text-center text-text-muted">Nenhuma tarefa encontrada.</div> : (
                      <table className="w-full text-left border-collapse">
                          <thead className="bg-surface-highlight sticky top-0 z-10 text-xs uppercase text-text-muted font-semibold">
                              <tr>
                                  <th className="p-4 border-b border-border w-10"></th>
                                  <th className="p-4 border-b border-border">Tarefa</th>
                                  <th className="p-4 border-b border-border">Projeto</th>
                                  <th className="p-4 border-b border-border">Etapa / Status</th>
                                  <th className="p-4 border-b border-border">Vencimento</th>
                                  <th className="p-4 border-b border-border text-center">Prioridade</th>
                                  <th className="p-4 border-b border-border text-center">Ações</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                              {tarefasFiltradas.map(t => (
                                  <tr key={t.id} className={`hover:bg-surface-highlight/20 transition-colors group ${t.concluida ? 'bg-surface-highlight/10' : ''}`}>
                                      <td className="p-4">
                                          <input type="checkbox" checked={t.concluida} onChange={() => handleCheck(t.id, t.concluida, t.projeto_id)} className="w-4 h-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-surface" />
                                      </td>
                                      <td className="p-4 font-medium text-foreground"><span className={t.concluida ? "line-through text-text-muted" : ""}>{t.titulo}</span></td>
                                      <td className="p-4 text-sm text-text-muted"><span className="bg-surface-highlight/50 px-2 py-1 rounded text-xs font-bold">{t.projeto?.nome}</span></td>
                                      <td className="p-4 text-sm text-text-muted text-xs"><span className={`px-2 py-1 rounded border ${t.concluida ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>{t.concluida ? 'Concluída' : (t.coluna?.nome || 'Backlog')}</span></td>
                                      <td className="p-4 text-sm text-text-muted">{formatarData(t.dt_vencimento) || '-'}</td>
                                      <td className="p-4 text-center">
                                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${getPriorityColor(t.prioridade_id)}`}>
                                            {t.prioridade?.nome || 'Normal'}
                                        </span>
                                      </td>
                                      <td className="p-4 text-center"><button onClick={() => setSelectedTarefa(t)} className="text-indigo-400 hover:underline text-sm font-medium">Abrir</button></td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>
          )}

          {/* MODO QUADRO */}
          {view === 'QUADRO' && (
              <KanbanBoardContainer>
                  {agrupamento === 'PROJETO' ? (
                      listaProjetos
                        .filter(p => (esconderFiltroProjeto || !projetoId) ? true : p.id === projetoId)
                        .map(projeto => {
                            const tarefasDoProjeto = tarefasFiltradas.filter(t => t.projeto_id === projeto.id);
                            if (tarefasDoProjeto.length === 0 && !projetoId) return null;
                            return (
                                <KanbanColumn 
                                    key={projeto.id} 
                                    titulo={projeto.nome} 
                                    count={tarefasDoProjeto.length}
                                    tarefas={tarefasDoProjeto} 
                                    onDrop={() => {}} 
                                    onCheck={handleCheck} 
                                    onOpen={setSelectedTarefa} 
                                    isPending={isPending} 
                                    tipo="PROJETO" 
                                    usuarioLogadoId={usuarioLogadoId}
                                />
                            )
                        })
                  ) : (
                      <>
                        {tarefasFiltradas.some(t => !getColunaId(t)) && (
                            <KanbanColumn 
                                titulo="Não Classificado" 
                                count={tarefasFiltradas.filter(t => !getColunaId(t)).length}
                                tarefas={tarefasFiltradas.filter(t => !getColunaId(t))}
                                onDrop={() => {}} 
                                onCheck={handleCheck} 
                                onOpen={setSelectedTarefa} 
                                isPending={isPending} 
                                isWarning 
                                tipo="COLUNA"
                                usuarioLogadoId={usuarioLogadoId}
                            />
                        )}

                        {/* COLUNAS NORMAIS */}
                        {colunasOrdenadas.map((coluna, index) => (
                            <KanbanColumn
                                key={coluna.id}
                                id={coluna.id}
                                index={index}
                                onTrocarColuna={trocarColunas}
                                titulo={coluna.nome}
                                count={tarefasFiltradas.filter(t => getColunaId(t) === coluna.id).length}
                                tarefas={tarefasFiltradas.filter(t => getColunaId(t) === coluna.id)}
                                onDrop={(itemId: string) => {
                                    const tarefaMovida = tarefasFiltradas.find(t => t.id === itemId)
                                    if (tarefaMovida && tarefaMovida.projeto_id) {
                                        startTransition(() => moverTarefaDeColuna(itemId, coluna.id, tarefaMovida.projeto_id))
                                    }
                                }}
                                onCheck={handleCheck}
                                onOpen={setSelectedTarefa}
                                isPending={isPending}
                                tipo="COLUNA"
                                dropId={coluna.id}
                                dataInicioColuna={extrairDataYMD(coluna.data_inicio)}
                                dataFimColuna={extrairDataYMD(coluna.data_fim)}
                                projetoIdColuna={listaProjetos[0]?.id}
                                equipeIdColuna={listaProjetos[0]?.equipe_id ?? undefined}
                            />
                        ))}
                      </>
                  )}
              </KanbanBoardContainer>
          )}

          {/* MODO CALENDÁRIO */}
          {view === 'CALENDARIO' && (
              <div className="h-full overflow-hidden">
                  <CalendarView 
                      tarefas={tarefasFiltradas} 
                      abrirModal={(t) => setSelectedTarefa(t)}
                      enableNavigation={enableCalendarNavigation}
                      initialDate={initialCalendarDate}
                      fixedViewMode={calendarViewMode} 
                  />
              </div>
          )}

        </div>
        
        {/* MODAIS */}
        {selectedTarefa && <ModalTarefa tarefa={selectedTarefa} isOpen={!!selectedTarefa} onClose={() => setSelectedTarefa(null)} usuarios={usuarios} projetos={listaProjetos} usuarioLogadoId={usuarioLogadoId}/>}
        {tarefaParaConcluir && <ModalConclusao key={tarefaParaConcluir} tarefaId={tarefaParaConcluir} isOpen={!!tarefaParaConcluir} onClose={() => setTarefaParaConcluir(null)} onConfirm={confirmarConclusao} isSaving={isPending} />}
      
      </div>
    </DndProvider>
  )
}

// --- 4. SUB-COMPONENTES DO KANBAN ---

interface KanbanColumnProps {
    id?: string
    index?: number
    onTrocarColuna?: (dragIndex: number, hoverIndex: number) => void
    titulo: string
    count: number
    tarefas: TarefaComRelacoes[]
    onDrop: (itemId: string) => void
    onCheck: (tarefaId: string, concluidaAtual: boolean, projetoId: string) => void
    onOpen: (tarefa: TarefaComRelacoes) => void
    isPending: boolean
    isWarning?: boolean
    tipo: 'PROJETO' | 'COLUNA'
    dropId?: string
    usuarioLogadoId?: string
    dataInicioColuna?: string | null
    dataFimColuna?: string | null
    projetoIdColuna?: string
    equipeIdColuna?: string
}

function KanbanColumn({
    id, index, onTrocarColuna,
    titulo, count, tarefas, onDrop, onCheck, onOpen, isPending, isWarning, tipo, dropId,
    dataInicioColuna, dataFimColuna, projetoIdColuna, equipeIdColuna
}: KanbanColumnProps) {
    const ref = useRef<HTMLDivElement>(null)
    const [, startTransitionOrder] = useTransition()
    const toInput = (v: string | null | undefined) => extrairDataYMD(v) || ''
    const [localDataInicio, setLocalDataInicio] = useState(toInput(dataInicioColuna))
    const [localDataFim, setLocalDataFim] = useState(toInput(dataFimColuna))

    useEffect(() => {
        setLocalDataInicio(toInput(dataInicioColuna))
        setLocalDataFim(toInput(dataFimColuna))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataInicioColuna, dataFimColuna])

    const salvarDatasColuna = (inicio: string, fim: string) => {
        if (!equipeIdColuna || !projetoIdColuna || !id) return
        atualizarDatasEtapa(projetoIdColuna, id, inicio || null, fim || null, equipeIdColuna)
    }

    // Estado local para animação instantânea de ordenação
    const [localTarefas, setLocalTarefas] = useState<TarefaComRelacoes[]>(tarefas)

    // Sincroniza sempre que a propriedade externa mudar
    useEffect(() => {
        setLocalTarefas([...tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)))
    }, [tarefas])

    // Função que troca os cards de lugar VISUALMENTE
    const moveCard = useCallback((dragIndex: number, hoverIndex: number) => {
        setLocalTarefas((prev: TarefaComRelacoes[]) => {
            const atualizadas = [...prev]
            const temp = atualizadas[dragIndex]
            atualizadas.splice(dragIndex, 1)
            atualizadas.splice(hoverIndex, 0, temp)
            return atualizadas
        })
    }, [])

    // Função que SALVA a ordem no banco de dados quando soltamos o clique
    const saveOrder = useCallback(() => {
        const sofreuAlteracao = localTarefas.some((t, i) => t.id !== tarefas[i]?.id)

        if (sofreuAlteracao && localTarefas.length > 0) {
            const updates = localTarefas.map((t, i) => ({ id: t.id, ordem: i + 1 }))
            const projetoId = localTarefas[0]?.projeto_id
            const equipeId = localTarefas[0]?.projeto?.equipe_id ?? ''

            if (projetoId) {
                startTransitionOrder(async () => {
                    await atualizarOrdemTarefas(updates, projetoId, equipeId)
                })
            }
        }
    }, [localTarefas, tarefas, startTransitionOrder])

    // DRAG DA COLUNA
    const [{ isDraggingColumn }, dragColumn] = useDrag({
        type: ItemTypes.COLUMN,
        item: { index },
        canDrag: () => tipo === 'COLUNA' && !!onTrocarColuna,
        collect: (monitor) => ({ isDraggingColumn: monitor.isDragging() }),
    }, [index, tipo, onTrocarColuna])

    // DROP DA COLUNA
    const [{ isOverColumn }, dropColumn] = useDrop({
        accept: ItemTypes.COLUMN,
        drop: (item: { index: number }) => {
            if (onTrocarColuna && index !== undefined) {
                const dragIndex = item.index
                const hoverIndex: number = index
                if (dragIndex === hoverIndex) return
                onTrocarColuna(dragIndex, hoverIndex)
                item.index = hoverIndex
            }
        },
        collect: (monitor) => ({ isOverColumn: monitor.isOver() }),
    }, [index, onTrocarColuna])

    dropColumn(ref)
    
    // DROP DE TAREFA (Mover de uma coluna para a outra)
    const [{ isOverTask }, dropTask] = useDrop(() => ({
        accept: ItemTypes.TASK,
        drop: (item: { id: string, colunaId: string }) => { 
            if (tipo === 'COLUNA' && item.colunaId !== dropId) {
                onDrop(item.id) 
            }
        },
        collect: (monitor) => ({ isOverTask: monitor.isOver() }),
        canDrop: () => tipo === 'COLUNA'
    }), [dropId, onDrop, tipo])

    const isTarget = isOverColumn && tipo === 'COLUNA'

    return (
        <div 
            ref={ref} 
            className={`w-80 flex-shrink-0 flex flex-col bg-surface rounded-xl border max-h-full transition-all 
            ${isDraggingColumn ? 'opacity-50 border-dashed border-gray-400' : 'opacity-100'} 
            ${isTarget ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50' : 'border-border'}
            ${isOverTask ? 'bg-indigo-500/10 border-indigo-500/30' : ''} 
            ${isWarning ? 'bg-red-500/10 border-red-500/20' : ''}
            `}
        >
            <div 
                ref={dragColumn as unknown as React.LegacyRef<HTMLDivElement>}
                className={`p-3 font-bold text-foreground text-sm border-b border-border rounded-t-xl
                ${isWarning ? 'text-red-400' : 'bg-surface'}
                ${onTrocarColuna ? 'cursor-grab active:cursor-grabbing hover:bg-gray-50' : ''}`}
            >
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {onTrocarColuna && <span className="text-gray-300 text-xs">⋮⋮</span>}
                        <span className="truncate" title={titulo}>{titulo}</span>
                    </div>
                    <span className="bg-surface-highlight text-text-muted px-2 rounded-full text-xs flex items-center border border-border">{count}</span>
                </div>
                {equipeIdColuna && projetoIdColuna && id && (
                    <div className="flex gap-1.5 mt-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                        <div className="flex-1">
                            <label className="text-[9px] text-gray-400 uppercase font-bold block mb-0.5">Início</label>
                            <input type="date" value={localDataInicio}
                                onChange={(e) => setLocalDataInicio(e.target.value)}
                                onBlur={(e) => salvarDatasColuna(e.target.value, localDataFim)}
                                className="w-full text-[10px] border border-border rounded px-1.5 py-0.5 bg-background text-foreground focus:ring-1 focus:ring-indigo-400 outline-none font-normal" />
                        </div>
                        <div className="flex-1">
                            {(() => {
                                const fimAtrasado = !!localDataFim && parseDateLocal(localDataFim)! < hojeNoFusoBrasil()
                                return (
                                    <>
                                        <label className={`text-[9px] uppercase font-bold block mb-0.5 ${fimAtrasado ? 'text-red-400' : 'text-gray-400'}`}>Fim</label>
                                        <input type="date" value={localDataFim}
                                            onChange={(e) => setLocalDataFim(e.target.value)}
                                            onBlur={(e) => salvarDatasColuna(localDataInicio, e.target.value)}
                                            className={`w-full text-[10px] border rounded px-1.5 py-0.5 bg-background focus:ring-1 outline-none font-normal ${fimAtrasado ? 'border-red-400 text-red-500 focus:ring-red-400' : 'border-border text-foreground focus:ring-indigo-400'}`} />
                                    </>
                                )
                            })()}
                        </div>
                    </div>
                )}
            </div>

            <div ref={dropTask as unknown as React.LegacyRef<HTMLDivElement>} className="p-2 overflow-y-auto flex-1 space-y-2 custom-scrollbar-thin min-h-[100px]">
                {localTarefas.length === 0 ? <div className="text-center text-text-muted text-xs py-4 italic">Vazio</div> : localTarefas.map((t, idx) => (
                        <DraggableKanbanCard
                            key={t.id}
                            index={idx}
                            tarefa={t}
                            onCheck={onCheck}
                            onOpen={onOpen}
                            isPending={isPending}
                            moveCard={moveCard}
                            saveOrder={saveOrder}
                        />
                ))}
            </div>
        </div>
    )
}

interface DraggableKanbanCardProps {
    tarefa: TarefaComRelacoes
    index: number
    moveCard: (dragIndex: number, hoverIndex: number) => void
    saveOrder: () => void
    onCheck: (tarefaId: string, concluidaAtual: boolean, projetoId: string) => void
    onOpen: (tarefa: TarefaComRelacoes) => void
    isPending: boolean
}

function DraggableKanbanCard({ tarefa, index, moveCard, saveOrder, onCheck, onOpen, isPending }: DraggableKanbanCardProps) {
    const ref = useRef<HTMLDivElement>(null)

    const [{ isDragging }, dragRef] = useDrag(() => ({
        type: ItemTypes.TASK,
        item: { id: tarefa.id, index, colunaId: tarefa.coluna_id },
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        end: () => { if (saveOrder) saveOrder() }
    }), [tarefa.id, index, tarefa.coluna_id, saveOrder])

    const [, dropRef] = useDrop({
        accept: ItemTypes.TASK,
        hover(item: { id: string; index: number; colunaId: string | null }, monitor) {
            if (!ref.current) return
            const dragIndex = item.index
            const hoverIndex = index

            if (dragIndex === hoverIndex) return
            if (item.colunaId !== tarefa.coluna_id) return

            const hoverBoundingRect = ref.current?.getBoundingClientRect()
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
            const clientOffset = monitor.getClientOffset()
            if(!clientOffset) return
            const hoverClientY = clientOffset.y - hoverBoundingRect.top

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return

            if (moveCard) {
                moveCard(dragIndex, hoverIndex)
                item.index = hoverIndex 
            }
        }
    })

    dragRef(dropRef(ref))

    const formatarData = (dt: Date | string | null) => { const r = formatarDataBR(dt); return r === '-' ? null : r }

    return (
        <div ref={ref as unknown as React.LegacyRef<HTMLDivElement>} onClick={() => onOpen(tarefa)}
            className={`bg-surface p-3 rounded-lg border border-border shadow-sm hover:border-indigo-500/50 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative ${isPending ? 'opacity-50' : ''} ${tarefa.concluida ? 'opacity-60 bg-surface-highlight/20' : ''} ${isDragging ? 'opacity-30' : ''}`}>
            
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${tarefa.prioridade_id === 3 ? 'bg-red-500' : (tarefa.prioridade_id === 2 ? 'bg-orange-500' : 'bg-green-500')}`}></div>
            
            <div className="pl-2">
                <div className="flex justify-between items-start mb-1">
                    <span className={`text-[10px] border px-1.5 rounded uppercase font-semibold ${tarefa.concluida ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-surface-highlight border-border text-text-muted'}`}>{tarefa.concluida ? 'Concluída' : (tarefa.coluna?.nome || 'A Fazer')}</span>
                    <input type="checkbox" checked={tarefa.concluida} onChange={() => onCheck(tarefa.id, tarefa.concluida, tarefa.projeto_id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer bg-surface" />
                </div>
                <h4 className={`font-semibold text-foreground text-sm mb-2 leading-tight ${tarefa.concluida ? 'line-through text-text-muted' : ''}`}>{tarefa.titulo}</h4>
                <div className="flex justify-between items-center text-xs text-text-muted border-t pt-2 border-border">
                    <span className={tarefa.dt_vencimento ? "text-text-muted" : "text-gray-600"}>📅 {formatarData(tarefa.dt_vencimento) || 'S/ Data'}</span>
                    {tarefa.usuario && <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-[9px] font-bold text-indigo-400 border border-indigo-500/20" title={tarefa.usuario.nome}>{tarefa.usuario.nome.substring(0, 2).toUpperCase()}</div>}
                </div>
            </div>
        </div>
    )
}