'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useDrop, useDrag } from 'react-dnd'
import { atualizarDataTarefa } from '@/app/actions'
import { parseDateLocal } from '@/lib/date'
import type { TarefaComRelacoes } from '@/types'

interface Props {
  tarefas: TarefaComRelacoes[]
  abrirModal: (t: TarefaComRelacoes) => void
  enableNavigation?: boolean
  initialDate?: string
  fixedViewMode?: 'SEMANA' | 'MES'
}

export default function CalendarView({
    tarefas,
    abrirModal,
    enableNavigation = true,
    initialDate,
    fixedViewMode
}: Props) {

  const router = useRouter()
  const [, startTransition] = useTransition()
  const [dataAtual, setDataAtual] = useState<Date>(() => parseDateLocal(initialDate) ?? new Date())
  const [modo, setModo] = useState<'SEMANA' | 'MES'>(fixedViewMode || 'SEMANA')

  useEffect(() => {
    const parsed = parseDateLocal(initialDate)
    if (parsed) setDataAtual(parsed)
  }, [initialDate])

  useEffect(() => {
    if (fixedViewMode) setModo(fixedViewMode)
  }, [fixedViewMode])

  const mudarPeriodo = (direcao: number) => {
    const novaData = new Date(dataAtual)
    if (modo === 'MES') {
        // --- CORREÇÃO IMPORTANTE MANTIDA ---
        // Fixa dia 1 antes de somar mês para evitar pular Fevereiro (ex: 30 Jan -> 01 Mar)
        novaData.setDate(1) 
        novaData.setMonth(novaData.getMonth() + direcao)
    } else {
        novaData.setDate(novaData.getDate() + (direcao * 7))
    }
    setDataAtual(novaData)
  }

  const irParaHoje = () => setDataAtual(parseDateLocal(initialDate) ?? new Date())

  const nomeMesRaw = dataAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const nomeMes = nomeMesRaw.charAt(0).toUpperCase() + nomeMesRaw.slice(1)
  
  const getDiasDoMes = () => {
    const ano = dataAtual.getFullYear()
    const mes = dataAtual.getMonth()
    // Fixa dia 1 ao meio-dia para segurança de fuso
    const primeiroDia = new Date(ano, mes, 1, 12, 0, 0)
    const ultimoDia = new Date(ano, mes + 1, 0, 12, 0, 0)
    
    const dias = []
    for (let i = 0; i < primeiroDia.getDay(); i++) dias.push(null)
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
        dias.push(new Date(ano, mes, i, 12, 0, 0))
    }
    return dias
  }

  const getDiasDaSemana = () => {
    const dias = []
    const diaRef = new Date(dataAtual)
    diaRef.setHours(12, 0, 0, 0)

    const diaSemana = diaRef.getDay() 
    const domingo = new Date(diaRef)
    domingo.setDate(diaRef.getDate() - diaSemana)
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(domingo)
        d.setDate(domingo.getDate() + i)
        d.setHours(12, 0, 0, 0)
        dias.push(d)
    }
    return dias
  }

  const diasRenderizados = modo === 'MES' ? getDiasDoMes() : getDiasDaSemana()

  const getTarefasDoDia = (dia: Date) => {
    return tarefas.filter(t => {
        if (!t.dt_vencimento) return false
        
        let dataTarefaISO = ''
        if (t.dt_vencimento instanceof Date) {
            dataTarefaISO = t.dt_vencimento.toISOString()
        } else {
            dataTarefaISO = String(t.dt_vencimento)
        }
        const dataTarefaYMD = dataTarefaISO.split('T')[0]
        const ano = dia.getFullYear()
        const mes = String(dia.getMonth() + 1).padStart(2, '0')
        const d = String(dia.getDate()).padStart(2, '0')
        const dataCalendarioYMD = `${ano}-${mes}-${d}`
        
        return dataTarefaYMD === dataCalendarioYMD
    })
  }

  const handleDropTarefa = (tarefaId: string, projetoId: string, novaData: Date) => {
    const dataSegura = new Date(novaData)
    dataSegura.setHours(12, 0, 0, 0)
    startTransition(async () => {
      await atualizarDataTarefa(tarefaId, dataSegura, projetoId)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col h-full bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
      
      {/* HEADER */}
      <div className="flex justify-between items-center p-4 border-b border-border bg-surface flex-shrink-0">
        <div className="flex items-center gap-4">
            <h2 className="font-bold text-lg text-foreground min-w-[150px] capitalize">{nomeMes}</h2>
            {enableNavigation && (
                <div className="flex items-center bg-surface-highlight rounded-lg p-0.5 border border-border">
                    <button onClick={() => mudarPeriodo(-1)} className="w-8 h-8 flex items-center justify-center hover:bg-surface rounded-md text-text-muted hover:text-foreground transition-colors">◀</button>
                    <button onClick={irParaHoje} className="px-3 h-8 text-xs font-semibold hover:bg-surface rounded-md text-foreground transition-colors">Hoje</button>
                    <button onClick={() => mudarPeriodo(1)} className="w-8 h-8 flex items-center justify-center hover:bg-surface rounded-md text-text-muted hover:text-foreground transition-colors">▶</button>
                </div>
            )}
        </div>
        {!fixedViewMode && (
            <div className="flex bg-surface-highlight p-1 rounded-lg border border-border">
                <button onClick={() => setModo('SEMANA')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${modo === 'SEMANA' ? 'bg-surface text-indigo-400 shadow-sm' : 'text-text-muted hover:text-foreground'}`}>Semana</button>
                <button onClick={() => setModo('MES')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${modo === 'MES' ? 'bg-surface text-indigo-400 shadow-sm' : 'text-text-muted hover:text-foreground'}`}>Mês</button>
            </div>
        )}
      </div>

      {/* MODO MÊS */}
      {modo === 'MES' && (
        <>
            <div className="grid grid-cols-7 border-b border-border bg-surface-highlight/30 flex-shrink-0">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                    <div key={d} className="py-2 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 flex-1 auto-rows-[minmax(120px,1fr)] overflow-y-auto bg-surface custom-scrollbar-dark">
                {diasRenderizados.map((dia, index) => {
                    if (!dia) return <div key={index} className="bg-surface-highlight/10 border-b border-r border-border min-h-[120px]" />
                    return <CalendarDayCell key={index} dia={dia} tarefas={getTarefasDoDia(dia)} onDrop={handleDropTarefa} onClickTask={abrirModal} viewMode="MES" />
                })}
            </div>
        </>
      )}

      {/* MODO SEMANA */}
      {modo === 'SEMANA' && (
         <div className="flex h-full overflow-x-auto divide-x divide-border bg-surface custom-scrollbar-dark">
             {diasRenderizados.map((dia, index) => {
                 if (!dia) return null
                 return <CalendarDayCell key={index} dia={dia} tarefas={getTarefasDoDia(dia)} onDrop={handleDropTarefa} onClickTask={abrirModal} viewMode="SEMANA" />
             })}
         </div>
      )}
    </div>
  )
}

interface CalendarDayCellProps {
    dia: Date
    tarefas: TarefaComRelacoes[]
    onDrop: (tarefaId: string, projetoId: string, novaData: Date) => void
    onClickTask: (t: TarefaComRelacoes) => void
    viewMode: 'MES' | 'SEMANA'
}

function CalendarDayCell({ dia, tarefas, onDrop, onClickTask, viewMode }: CalendarDayCellProps) {
    const [{ isOver }, dropRef] = useDrop(() => ({
        accept: 'CALENDAR_TASK',
        drop: (item: { id: string, projetoId: string }) => { onDrop(item.id, item.projetoId, dia) },
        collect: (monitor) => ({ isOver: monitor.isOver() }),
    }), [dia])

    const hoje = new Date()
    const isHoje = dia.toDateString() === hoje.toDateString()
    const bgClass = isOver ? 'bg-indigo-500/10' : (isHoje ? 'bg-indigo-500/5' : 'bg-transparent')

    if (viewMode === 'MES') {
        return (
            <div ref={dropRef as unknown as React.LegacyRef<HTMLDivElement>} className={`border-b border-r border-border p-2 flex flex-col transition-colors ${bgClass}`}>
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isHoje ? 'bg-indigo-600 text-white' : 'text-text-muted'}`}>{dia.getDate()}</span>
                <div className="space-y-1 overflow-y-auto custom-scrollbar-thin flex-1 max-h-[120px]">
                    {tarefas.map(t => <DraggableTaskPill key={t.id} tarefa={t} onClick={() => onClickTask(t)} />)}
                </div>
            </div>
        )
    } 
    
    return (
        <div ref={dropRef as unknown as React.LegacyRef<HTMLDivElement>} className={`flex-1 min-w-[140px] flex flex-col h-full transition-colors ${bgClass}`}>
            <div className={`p-3 text-center border-b border-border ${isHoje ? 'bg-indigo-500/10' : 'bg-surface-highlight/30'}`}>
                <p className="text-xs font-bold text-text-muted uppercase">{dia.toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
                <p className={`text-xl font-bold mt-1 ${isHoje ? 'text-indigo-400' : 'text-foreground'}`}>{dia.getDate()}</p>
            </div>
            <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar-thin">
                {tarefas.map(t => <DraggableTaskCard key={t.id} tarefa={t} onClick={() => onClickTask(t)} />)}
            </div>
        </div>
    )
}

// --- VISUAL RESTAURADO: Pílula Pequena ---
function DraggableTaskPill({ tarefa, onClick }: { tarefa: TarefaComRelacoes; onClick: () => void }) {
    const [{ isDragging }, dragRef] = useDrag(() => ({
        type: 'CALENDAR_TASK', item: { id: tarefa.id, projetoId: tarefa.projeto_id },
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }), [tarefa.id])

    return (
        <div ref={dragRef as unknown as React.LegacyRef<HTMLDivElement>} onClick={onClick}
            className={`text-[10px] px-1.5 py-1 rounded border cursor-pointer truncate transition-all flex justify-between items-center gap-1 
            ${isDragging ? 'opacity-40 pointer-events-none' : 'opacity-100'} 
            ${tarefa.concluida ? 'bg-surface-highlight/50 text-text-muted line-through border-transparent' : 'bg-surface-highlight text-foreground border-border hover:border-indigo-500/50'}`}>
            <span className="truncate">{tarefa.titulo}</span>
            {tarefa.usuario && (
                <div className="w-3 h-3 rounded-full bg-indigo-500/20 flex items-center justify-center text-[6px] font-bold text-indigo-400 border border-indigo-500/30 shrink-0">
                    {tarefa.usuario.nome.substring(0, 1).toUpperCase()}
                </div>
            )}
        </div>
    )
}

// --- VISUAL RESTAURADO: Card Grande ---
function DraggableTaskCard({ tarefa, onClick }: { tarefa: TarefaComRelacoes; onClick: () => void }) {
    const [{ isDragging }, dragRef] = useDrag(() => ({
        type: 'CALENDAR_TASK', item: { id: tarefa.id, projetoId: tarefa.projeto_id },
        collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }), [tarefa.id])

    return (
        <div ref={dragRef as unknown as React.LegacyRef<HTMLDivElement>} onClick={onClick}
            className={`p-3 rounded-lg border shadow-sm cursor-pointer group transition-all 
            ${isDragging ? 'opacity-40 pointer-events-none scale-95 grayscale' : 'opacity-100'} 
            ${tarefa.concluida ? 'bg-surface-highlight/30 border-border text-text-muted' : 'bg-surface border-border hover:border-indigo-400 hover:shadow-md'}`}>
            
            <div className={`w-8 h-1 rounded-full mb-2 ${tarefa.prioridade_id === 3 ? 'bg-red-500' : (tarefa.prioridade_id === 2 ? 'bg-orange-500' : 'bg-green-500')}`}></div>
            <p className={`text-sm font-medium leading-tight mb-2 ${tarefa.concluida ? 'line-through text-text-muted' : 'text-foreground'}`}>{tarefa.titulo}</p>
            
            <div className="flex justify-between items-center border-t border-border pt-2 mt-1">
                <p className="text-[10px] text-text-muted font-bold uppercase truncate max-w-[70%]">{tarefa.projeto?.nome}</p>
                {tarefa.usuario && (
                    <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-[9px] font-bold text-indigo-400 border border-indigo-500/20 shrink-0" title={tarefa.usuario.nome}>
                        {tarefa.usuario.nome.substring(0, 2).toUpperCase()}
                    </div>
                )}
            </div>
        </div>
    )
}