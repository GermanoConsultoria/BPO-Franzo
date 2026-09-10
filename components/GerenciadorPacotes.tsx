'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { DndProvider, useDrag, useDrop, useDragLayer } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Package, Plus, Trash2 } from 'lucide-react'
import { criarPacoteTemplate, excluirPacoteTemplate, adicionarTarefaTemplate, reordenarTarefasTemplate } from '@/app/actions'
import ItemTarefaTemplate from './ItemTarefaTemplate'
import type { EquipeCompleta, PacoteComTarefas, TarefaTemplate } from '@/types'

const ItemTypes = { TAREFA_TEMPLATE: 'TAREFA_TEMPLATE' }

// --- 1. HOOK DE AUTO-SCROLL VERTICAL ---
function useVerticalAutoScroll(scrollContainerRef: React.RefObject<HTMLDivElement | null>) {
    const isDraggingRef = useRef(false)
    
    useDragLayer(monitor => {
        isDraggingRef.current = monitor.isDragging()
        return {}
    })

    useEffect(() => {
        const container = scrollContainerRef.current
        if (!container) return

        let animationFrameId: number
        let mouseY = 0

        const handleMouseMove = (e: MouseEvent) => {
            mouseY = e.clientY
        }

        const autoScrollLoop = () => {
            if (isDraggingRef.current && container) {
                const { top, bottom } = container.getBoundingClientRect()
                // Aumentei o edgeSize para facilitar o scroll
                const edgeSize = 100 
                const maxSpeed = 15

                if (mouseY < top + edgeSize && mouseY > 0) {
                    const intensity = Math.max(0, (top + edgeSize - mouseY) / edgeSize)
                    container.scrollTop -= maxSpeed * intensity
                } 
                else if (mouseY > bottom - edgeSize && mouseY < window.innerHeight) {
                    const intensity = Math.max(0, (mouseY - (bottom - edgeSize)) / edgeSize)
                    container.scrollTop += maxSpeed * intensity
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

// --- 2. CONTAINER COM AUTO SCROLL VERTICAL ---
const DraggableListContainer = ({ children }: { children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null)
    useVerticalAutoScroll(ref)

    return (
        <div ref={ref} className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar-thin pr-2 pb-10">
             {children}
        </div>
    )
}

export default function GerenciadorPacotes({ equipe }: { equipe: EquipeCompleta }) {
    const [pacotes, setPacotes] = useState<PacoteComTarefas[]>(equipe.pacotes)
    // Ref sempre aponta para o estado mais recente (evita closure stale no save)
    const pacotesRef = useRef(pacotes)

    useEffect(() => {
        const sorted = equipe.pacotes.map(p => ({
            ...p,
            tarefas: [...p.tarefas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        }))
        setPacotes(sorted)
        pacotesRef.current = sorted
    }, [equipe.pacotes])

    const moverTarefa = useCallback((tarefaId: string, pacoteOrigemId: string, pacoteDestinoId: string, hoverIndex: number) => {
        setPacotes(prevPacotes => {
            const novosPacotes: PacoteComTarefas[] = JSON.parse(JSON.stringify(prevPacotes))

            const pacoteOrigem = novosPacotes.find(p => p.id === pacoteOrigemId)
            const pacoteDestino = novosPacotes.find(p => p.id === pacoteDestinoId)

            if (!pacoteOrigem || !pacoteDestino) return prevPacotes

            const tarefaIndex = pacoteOrigem.tarefas.findIndex(t => t.id === tarefaId)
            if (tarefaIndex === -1) return prevPacotes

            const [tarefaMovida] = pacoteOrigem.tarefas.splice(tarefaIndex, 1)
            tarefaMovida.pacote_id = pacoteDestinoId
            pacoteDestino.tarefas.splice(hoverIndex, 0, tarefaMovida)

            pacotesRef.current = novosPacotes
            return novosPacotes
        })
    }, [])

    const salvarOrdemNoBanco = useCallback(() => {
        const todasTarefasAtualizadas: { id: string; ordem: number; pacote_id: string }[] = []

        // Lê do ref para garantir estado mais recente, sem closure stale
        pacotesRef.current.forEach(pacote => {
            pacote.tarefas.forEach((tarefa, index) => {
                todasTarefasAtualizadas.push({
                    id: tarefa.id,
                    ordem: index + 1,
                    pacote_id: pacote.id
                })
            })
        })

        if (todasTarefasAtualizadas.length > 0) {
            reordenarTarefasTemplate(todasTarefasAtualizadas, equipe.id)
        }
    }, [equipe.id])

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="bg-surface border border-border p-6 rounded-xl shadow-sm mt-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                        <Package size={16}/> Pacotes de Tarefas (Templates)
                    </h2>
                    <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-bold">{pacotes.length}</span>
                </div>
                <p className="text-xs text-text-muted mb-6">
                    Crie grupos de tarefas padrão. <strong>Arraste as tarefas para reordenar ou mover para outro pacote.</strong>
                </p>

                {/* FORMULÁRIO DE CRIAR PACOTE */}
                <form action={criarPacoteTemplate} className="flex gap-3 mb-8 bg-background p-4 rounded-lg border border-border">
                    <input type="hidden" name="equipeId" value={equipe.id} />
                    <div className="flex-1 space-y-3">
                        <input name="nome" placeholder="Nome do Pacote (Ex: Implantação Básica)" className="w-full bg-transparent border-b border-border px-2 py-1 outline-none focus:border-indigo-500 text-foreground font-medium text-sm transition-colors" required />
                        <input name="descricao" placeholder="Descrição rápida (Opcional)" className="w-full bg-transparent border-b border-border px-2 py-1 outline-none focus:border-indigo-500 text-text-muted text-xs transition-colors" />
                    </div>
                    <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors self-end text-sm flex items-center gap-2">
                        <Plus size={16} /> Criar Pacote
                    </button>
                </form>

                {/* LISTA DE PACOTES (DROP ZONES) */}
                <DraggableListContainer>
                    {pacotes.length === 0 && (
                        <div className="p-6 text-center border-2 border-dashed border-border rounded-xl text-gray-400 text-sm">
                            Nenhum pacote criado.
                        </div>
                    )}
                    {pacotes.map(pacote => (
                        <DropZonePacote 
                            key={pacote.id} 
                            pacote={pacote} 
                            equipeId={equipe.id} 
                            moverTarefa={moverTarefa}
                            salvarOrdemNoBanco={salvarOrdemNoBanco}
                        />
                    ))}
                </DraggableListContainer>
            </div>
        </DndProvider>
    )
}

interface DropZonePacoteProps {
    pacote: PacoteComTarefas
    equipeId: string
    moverTarefa: (tarefaId: string, pacoteOrigemId: string, pacoteDestinoId: string, hoverIndex: number) => void
    salvarOrdemNoBanco: () => void
}

function DropZonePacote({ pacote, equipeId, moverTarefa, salvarOrdemNoBanco }: DropZonePacoteProps) {
    const ref = useRef<HTMLDivElement>(null)

    // Recebe drops de tarefas vindas de outros pacotes
    const [{ isOver }, drop] = useDrop({
        accept: ItemTypes.TAREFA_TEMPLATE,
        drop: (item: { id: string; index: number; pacoteId: string }) => {
            if (item.pacoteId !== pacote.id) {
                // Cross-package: adiciona ao final do pacote destino
                moverTarefa(item.id, item.pacoteId, pacote.id, pacote.tarefas.length)
                item.pacoteId = pacote.id
                item.index = pacote.tarefas.length
            }
            salvarOrdemNoBanco()
        },
        collect: monitor => ({ isOver: monitor.isOver({ shallow: true }) })
    })

    drop(ref)

    return (
        <div ref={ref} className={`border rounded-xl overflow-hidden bg-background transition-colors ${isOver ? 'border-indigo-500 bg-indigo-50/10' : 'border-border'}`}>
            <div className="bg-surface-highlight/30 px-4 py-3 flex justify-between items-center border-b border-border">
                <div>
                    <h3 className="font-bold text-primary-hover text-m">{pacote.nome}</h3>
                    {pacote.descricao && <p className="text-xs text-text-muted">{pacote.descricao}</p>}
                </div>
                <form action={excluirPacoteTemplate}>
                    <input type="hidden" name="pacoteId" value={pacote.id} />
                    <input type="hidden" name="equipeId" value={equipeId} />
                    <button title="Excluir Pacote" className="text-gray-400 hover:text-red-500 p-1 transition-colors">
                        <Trash2 size={16} />
                    </button>
                </form>
            </div>

            <div className="p-4">
                <form action={adicionarTarefaTemplate} className="flex flex-col gap-2 mb-5 bg-surface-highlight/10 p-3 rounded-lg border border-border border-dashed">
                    <input type="hidden" name="pacoteId" value={pacote.id} />
                    <input type="hidden" name="equipeId" value={equipeId} />
                    <input name="titulo" placeholder="Título da tarefa padrão..." className="w-full bg-surface border border-border rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-foreground font-medium" required />
                    <textarea name="descricao" placeholder="Descrição ou checklist (Opcional)..." rows={2} className="w-full bg-surface border border-border rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-foreground resize-none" />
                    <button className="bg-surface-highlight hover:bg-border text-foreground px-4 py-1.5 rounded text-sm font-medium transition-colors self-end">Adicionar Tarefa</button>
                </form>

                <ul className="space-y-2 mt-4 min-h-[30px]">
                    {pacote.tarefas.length === 0 && !isOver && (
                        <li className="text-xs text-gray-500 italic px-2">Arraste tarefas para cá ou crie uma nova.</li>
                    )}
                    {pacote.tarefas.map((tarefa, index) => (
                        <DraggableTarefaItem 
                            key={tarefa.id} 
                            tarefa={tarefa} 
                            index={index} 
                            pacoteId={pacote.id} 
                            equipeId={equipeId}
                            moverTarefa={moverTarefa}
                            salvarOrdemNoBanco={salvarOrdemNoBanco}
                        />
                    ))}
                </ul>
            </div>
        </div>
    )
}

interface DraggableTarefaItemProps {
    tarefa: TarefaTemplate
    index: number
    pacoteId: string
    equipeId: string
    moverTarefa: (tarefaId: string, pacoteOrigemId: string, pacoteDestinoId: string, hoverIndex: number) => void
    salvarOrdemNoBanco: () => void
}

function DraggableTarefaItem({ tarefa, index, pacoteId, equipeId, moverTarefa, salvarOrdemNoBanco }: DraggableTarefaItemProps) {
    // ALTERAÇÃO CRÍTICA AQUI: Mudamos de HTMLLIElement para HTMLDivElement
    const ref = useRef<HTMLDivElement>(null)

    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.TAREFA_TEMPLATE,
        item: { id: tarefa.id, index, pacoteId },
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        end: () => salvarOrdemNoBanco() // Salva quando soltar o card
    })

    const [, drop] = useDrop({
        accept: ItemTypes.TAREFA_TEMPLATE,
        hover(item: { id: string; index: number; pacoteId: string }, monitor) {
            if (!ref.current) return
            // Hover só reordena dentro do mesmo pacote; cross-package é tratado no drop do container
            if (item.pacoteId !== pacoteId) return

            const dragIndex = item.index
            const hoverIndex = index
            if (dragIndex === hoverIndex) return

            // Guarda de meia-altura para ordenação suave
            const hoverBoundingRect = ref.current.getBoundingClientRect()
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
            const clientOffset = monitor.getClientOffset()
            if (!clientOffset) return
            const hoverClientY = clientOffset.y - hoverBoundingRect.top

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return

            moverTarefa(item.id, pacoteId, pacoteId, hoverIndex)
            item.index = hoverIndex
        }
    })

    drag(drop(ref))

    return (
        // ALTERAÇÃO CRÍTICA AQUI: Mudamos de <li> para <div>
        <div ref={ref} className={`transition-opacity ${isDragging ? 'opacity-30' : 'opacity-100'} cursor-grab active:cursor-grabbing`}>
            {/* Aqui nós reutilizamos o seu componente de Item, só adicionando uma marcação visual de que é arrastável */}
            <div className="relative group/drag">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/drag:opacity-100 text-gray-400 z-10">
                    ⋮⋮
                </div>
                <ItemTarefaTemplate tarefa={tarefa} equipeId={equipeId} />
            </div>
        </div>
    )
}