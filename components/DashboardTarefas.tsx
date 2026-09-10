'use client'

import { useState } from 'react'
import Link from 'next/link'
import ModalTarefa from './ModalTarefa'
import ModalConclusao from './ModalConclusao'
import { concluirTarefaComComentario } from '@/app/actions'
import type { TarefaComRelacoes, UsuarioBasico, ProjetoComColunas } from '@/types'
import { parseDateLocal, labelVencimento } from '@/lib/date'

interface Props {
  tarefas: TarefaComRelacoes[]
  usuarioNome: string
  usuarioId: string
  projetosDisponiveis: ProjetoComColunas[]
  usuariosDisponiveis: UsuarioBasico[]
  equipeAtualId: string
}

export default function DashboardTarefas({ tarefas, usuarioNome, usuarioId, projetosDisponiveis, usuariosDisponiveis, equipeAtualId }: Props) {
  const [abaAtiva, setAbaAtiva] = useState<'PROXIMAS' | 'ATRASADAS'>('PROXIMAS')
  
  // Estado para controlar qual tarefa abrir (Edição)
  const [tarefaSelecionada, setTarefaSelecionada] = useState<TarefaComRelacoes | null>(null)

  // --- NOVOS ESTADOS PARA CONCLUSÃO ---
  const [tarefaParaConcluir, setTarefaParaConcluir] = useState<TarefaComRelacoes | null>(null)
  const [isSavingConclusao, setIsSavingConclusao] = useState(false)

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const limite = new Date(hoje)
  limite.setDate(hoje.getDate() + 4)
  limite.setHours(23, 59, 59, 999)

  const tarefasAtrasadas = tarefas.filter(t => {
      const dataTarefa = parseDateLocal(t.dt_vencimento)
      if (!dataTarefa) return false
      return dataTarefa.getTime() < hoje.getTime()
  })

  const tarefasProximas = tarefas.filter(t => {
    const dataTarefa = parseDateLocal(t.dt_vencimento)
    if (!dataTarefa) return false
    return dataTarefa.getTime() >= hoje.getTime() && dataTarefa.getTime() <= limite.getTime()
  })

  const listaAtual = abaAtiva === 'PROXIMAS' ? tarefasProximas : tarefasAtrasadas

  const formatarDataAmigavel = (original: Date | string | null) => labelVencimento(original)

  const getPriorityColor = (p: { id: number; nome: string } | number | string | null | undefined) => {
    const id = typeof p === 'object' ? p?.id : p;
    
    if(id === 3 || p === 'ALTA') return 'bg-red-100 text-red-700'
    if(id === 2 || p === 'MEDIA') return 'bg-orange-100 text-orange-700'
    return 'bg-green-100 text-green-700'
  }

  // --- LÓGICA DE ABRIR O MODAL DE CONCLUSÃO ---
  const solicitarConclusao = (e: React.MouseEvent, tarefa: TarefaComRelacoes) => {
    e.stopPropagation() // Impede abrir a edição
    setTarefaParaConcluir(tarefa)
  }

  // --- LÓGICA DE SALVAR A CONCLUSÃO ---
  const handleConfirmarConclusao = async (comentario: string) => {
    if (!tarefaParaConcluir) return

    setIsSavingConclusao(true)
    
    await concluirTarefaComComentario(
        tarefaParaConcluir.id, 
        comentario, 
        tarefaParaConcluir.projeto_id, 
        usuarioId
    )
    
    setIsSavingConclusao(false)
    setTarefaParaConcluir(null)
  }

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-[500px]">
        {/* HEADER */}
        <div className="p-5 border-b border-gray-100 flex flex-col gap-4 bg-surface/50/50 min-h-[105px] justify-center">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                        {usuarioNome.substring(0,2).toUpperCase()}
                    </div>
                    <h2 className="font-bold text-foreground">Minhas Tarefas</h2>
                </div>
                <Link href={`/equipe/${equipeAtualId}/minhas-tarefas`} className="text-xs font-medium text-gray-400 hover:text-indigo-600">Expandir</Link>
            </div>

            {/* ABAS */}
            <div className="flex gap-4 text-sm font-medium border-b border-border">
                <button 
                    onClick={() => setAbaAtiva('PROXIMAS')}
                    className={`pb-2 transition-all flex items-center gap-2 ${abaAtiva === 'PROXIMAS' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Próximas
                    {tarefasProximas.length > 0 && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 rounded-full">{tarefasProximas.length}</span>}
                </button>
                <button 
                    onClick={() => setAbaAtiva('ATRASADAS')}
                    className={`pb-2 transition-all flex items-center gap-2 ${abaAtiva === 'ATRASADAS' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Atrasadas
                    {tarefasAtrasadas.length > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 rounded-full">{tarefasAtrasadas.length}</span>}
                </button>
            </div>
        </div>

        {/* LISTA */}
        <div className="flex-1 overflow-y-auto p-2">
            {listaAtual.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <div className="mb-3 p-4 bg-surface/50 rounded-full">
                        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p className="text-sm text-center px-6 font-medium text-gray-500">
                        {abaAtiva === 'PROXIMAS' 
                           ? 'Nada agendado para os próximos 5 dias.' 
                           : 'Tudo em dia! Nenhuma tarefa atrasada.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-1">
                {listaAtual.map(t => (
                    <div 
                        key={t.id} 
                        // --- CLIQUE PARA ABRIR O MODAL DE EDIÇÃO ---
                        onClick={() => setTarefaSelecionada(t)}
                        className="flex items-center gap-3 p-3 hover:bg-surface/50 rounded-xl transition-colors group cursor-pointer border border-transparent hover:border-gray-100"
                    >
                        {/* --- CÍRCULO DE CONCLUSÃO (ESQUERDA) --- */}
                        <div 
                            onClick={(e) => solicitarConclusao(e, t)}
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer hover:bg-green-500/20 transition-all ${
                                abaAtiva === 'ATRASADAS' ? 'border-red-300' : 'border-gray-300 group-hover:border-indigo-400'
                            }`}
                            title="Concluir tarefa"
                        ></div>
                    
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{t.titulo}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider truncate flex items-center gap-1">
                                {t.projeto?.nome || 'Sem projeto'} • 
                                <span className={abaAtiva === 'ATRASADAS' ? "text-red-500 font-bold" : (formatarDataAmigavel(t.dt_vencimento) === 'Hoje' ? "text-green-600 font-bold" : "")}>
                                    {formatarDataAmigavel(t.dt_vencimento)}
                                </span>
                            </p>
                        </div>

                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getPriorityColor(t.prioridade || t.prioridade_id)}`}>
                            {typeof t.prioridade === 'object' ? t.prioridade.nome : t.prioridade}
                        </span>
                    </div>
                ))}
                </div>
            )}
        </div>

        {/* MODAL DE EDIÇÃO */}
        <ModalTarefa 
            isOpen={!!tarefaSelecionada}
            onClose={() => setTarefaSelecionada(null)}
            tarefa={tarefaSelecionada!}
            usuarios={usuariosDisponiveis}
            projetos={projetosDisponiveis}
            usuarioLogadoId={usuarioId}

        />

        {/* --- MODAL DE CONCLUSÃO --- */}
        <ModalConclusao
            key={tarefaParaConcluir?.id ?? 'none'}
            tarefaId={tarefaParaConcluir?.id ?? ''}
            isOpen={!!tarefaParaConcluir}
            onClose={() => setTarefaParaConcluir(null)}
            onConfirm={handleConfirmarConclusao}
            isSaving={isSavingConclusao}
        />
    </div>
  )
}