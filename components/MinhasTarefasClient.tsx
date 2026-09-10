'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatarDataBR } from '@/lib/date'
import type { TarefaComRelacoes, ProjetoBasico } from '@/types'

interface Props {
  tarefasIniciais: TarefaComRelacoes[]
  listaProjetos: ProjetoBasico[]
}

export default function MinhasTarefasClient({ tarefasIniciais, listaProjetos }: Props) {
  const [busca, setBusca] = useState('')
  const [projetoId, setProjetoId] = useState('')
  const [prioridade, setPrioridade] = useState('')

  // Cores de Prioridade
  const getPriorityColor = (p: string) => {
    if(p === 'ALTA') return 'bg-red-100 text-red-700 border-red-200'
    if(p === 'MEDIA') return 'bg-orange-100 text-orange-700 border-orange-200'
    return 'bg-green-100 text-green-700 border-green-200'
  }

  // --- LÓGICA DE FILTRAGEM ---
  const tarefasFiltradas = tarefasIniciais.filter(t => {
    // 1. Filtro de Texto (Título)
    const matchTexto = t.titulo.toLowerCase().includes(busca.toLowerCase());
    
    // 2. Filtro de Projeto
    const matchProjeto = projetoId ? t.projeto_id === projetoId : true;

    // 3. Filtro de Prioridade
    const matchPrioridade = prioridade ? t.prioridade.nome === prioridade : true;

    return matchTexto && matchProjeto && matchPrioridade;
  });

  return (
    <div className="flex flex-col h-full">
      
      {/* BARRA DE FILTROS */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
        
        {/* Busca por Texto */}
        <div className="relative flex-1 w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input 
                type="text" 
                placeholder="Buscar tarefa..." 
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
            />
        </div>

        {/* Filtro de Projeto */}
        <select 
            className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-surface"
            value={projetoId}
            onChange={(e) => setProjetoId(e.target.value)}
        >
            <option value="">Todos os Projetos</option>
            {listaProjetos.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
        </select>

        {/* Filtro de Prioridade */}
        <select 
            className="w-full md:w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-surface"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value)}
        >
            <option value="">Todas Prioridades</option>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Média</option>
            <option value="BAIXA">Baixa</option>
        </select>

        {/* Botão Limpar */}
        {(busca || projetoId || prioridade) && (
            <button 
                onClick={() => { setBusca(''); setProjetoId(''); setPrioridade('') }}
                className="text-sm text-red-500 hover:text-red-700 font-medium whitespace-nowrap"
            >
                Limpar filtros
            </button>
        )}
      </div>

      {/* RESULTADOS */}
      <div className="flex-1 overflow-y-auto">
         {tarefasFiltradas.length === 0 ? (
             <div className="text-center py-20 text-gray-400">
                 <p className="text-xl">Nenhuma tarefa encontrada.</p>
                 <p className="text-sm">Tente ajustar os filtros.</p>
             </div>
         ) : (
             <div className="space-y-2">
                 {tarefasFiltradas.map(t => (
                     <div key={t.id} className="bg-surface p-4 rounded-xl border border-border shadow-sm hover:shadow-md transition-all flex items-center gap-4 group">
                         
                         {/* Checkbox Visual */}
                         <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-indigo-500 cursor-pointer flex-shrink-0"></div>

                         {/* Infos */}
                         <div className="flex-1 min-w-0">
                             <h3 className="font-semibold text-foreground truncate">{t.titulo}</h3>
                             <div className="flex items-center gap-2 text-xs mt-1">
                                 <span className="font-bold text-gray-500 uppercase tracking-wider">{t.projeto?.nome || 'Sem Projeto'}</span>
                                 <span className="text-gray-300">•</span>
                                 <span className={`${t.dt_vencimento ? 'text-gray-600' : 'text-gray-400'}`}>
                                     📅 {t.dt_vencimento ? formatarDataBR(t.dt_vencimento) : 'Sem prazo'}
                                 </span>
                             </div>
                         </div>

                         {/* Badge Prioridade */}
                         <span className={`text-[10px] px-2 py-1 rounded-full font-bold border ${getPriorityColor(t.prioridade.nome)}`}>
                             {t.prioridade.nome}
                         </span>
                         
                         {/* Link para abrir */}
                         <Link href={`/equipe/${t.projeto.equipe_id}/projeto/${t.projeto_id}`} className="text-gray-300 hover:text-indigo-600">
                            ↗
                        </Link>
                     </div>
                 ))}
             </div>
         )}
      </div>
    </div>
  )
}