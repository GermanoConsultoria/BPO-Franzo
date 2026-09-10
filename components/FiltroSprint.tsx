'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import type { ProjetoBasico, UsuarioBasico } from '@/types'

interface Props {
  projetos: ProjetoBasico[]
  usuarios: UsuarioBasico[]
}

export default function FiltroSprint({ projetos, usuarios }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Estado dos Menus (qual está aberto?)
  const [openMenu, setOpenMenu] = useState<'PROJETO' | 'USUARIO' | 'STATUS' | null>(null)
  
  // Refs para fechar ao clicar fora
  const menuRef = useRef<HTMLDivElement>(null)

  // Leitura da URL atual
  const projetosSelecionados = searchParams.get('projetos')?.split(',') || []
  const usuariosSelecionados = searchParams.get('usuarios')?.split(',') || []
  const statusSelecionado = searchParams.get('status') || 'TODOS' // TODOS, PENDENTE, FEITO

  // Fecha o menu se clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Função central que atualiza a URL
  const updateFilters = (tipo: 'projetos' | 'usuarios' | 'status', valor: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (tipo === 'status') {
      if (valor === 'TODOS') params.delete('status')
      else params.set('status', valor)
    } 
    else {
      // Lógica de Multi-Select (Adicionar/Remover ID da lista)
      const atuais = tipo === 'projetos' ? projetosSelecionados : usuariosSelecionados
      let novos = [...atuais]
      
      if (novos.includes(valor)) {
        novos = novos.filter(id => id !== valor) // Remove
      } else {
        novos.push(valor) // Adiciona
      }

      if (novos.length > 0) params.set(tipo, novos.join(','))
      else params.delete(tipo)
    }

    router.push(`?${params.toString()}`)
  }

  const limparFiltros = () => {
    // Mantém a 'view' (semana/mes) mas limpa o resto
    const view = searchParams.get('view') || 'semana'
    router.push(`?view=${view}`)
    setOpenMenu(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 relative" ref={menuRef}>
      
      {/* --- DROPDOWN PROJETOS --- */}
      <div className="relative">
        <button 
          onClick={() => setOpenMenu(openMenu === 'PROJETO' ? null : 'PROJETO')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${projetosSelecionados.length > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-surface border-border text-gray-600 hover:border-gray-300'}`}
        >
          📂 Projetos {projetosSelecionados.length > 0 && <span className="bg-indigo-600 text-white text-[10px] px-1.5 rounded-full">{projetosSelecionados.length}</span>}
          <span className="text-[10px]">▼</span>
        </button>

        {openMenu === 'PROJETO' && (
          <div className="absolute top-full mt-2 left-0 w-64 bg-surface rounded-xl shadow-xl border border-gray-100 z-50 p-2">
            <div className="max-h-60 overflow-y-auto space-y-1">
              {projetos.map(proj => (
                <label key={proj.id} className="flex items-center gap-3 p-2 hover:bg-surface/50 rounded-lg cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={projetosSelecionados.includes(proj.id)}
                    onChange={() => updateFilters('projetos', proj.id)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700 truncate">{proj.nome}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- DROPDOWN USUÁRIOS --- */}
      <div className="relative">
        <button 
          onClick={() => setOpenMenu(openMenu === 'USUARIO' ? null : 'USUARIO')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${usuariosSelecionados.length > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-surface border-border text-gray-600 hover:border-gray-300'}`}
        >
          👤 Responsável {usuariosSelecionados.length > 0 && <span className="bg-indigo-600 text-white text-[10px] px-1.5 rounded-full">{usuariosSelecionados.length}</span>}
          <span className="text-[10px]">▼</span>
        </button>

        {openMenu === 'USUARIO' && (
          <div className="absolute top-full mt-2 left-0 w-64 bg-surface rounded-xl shadow-xl border border-gray-100 z-50 p-2">
            <div className="max-h-60 overflow-y-auto space-y-1">
              {usuarios.map(user => (
                <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-surface/50 rounded-lg cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={usuariosSelecionados.includes(user.id)}
                    onChange={() => updateFilters('usuarios', user.id)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                        {user.nome.slice(0,2).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700 truncate">{user.nome}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- DROPDOWN STATUS --- */}
      <div className="relative">
        <button 
          onClick={() => setOpenMenu(openMenu === 'STATUS' ? null : 'STATUS')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${statusSelecionado !== 'TODOS' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-surface border-border text-gray-600 hover:border-gray-300'}`}
        >
          ✅ Status: {statusSelecionado === 'TODOS' ? 'Todos' : statusSelecionado === 'FEITO' ? 'Concluídas' : 'A Fazer'}
          <span className="text-[10px]">▼</span>
        </button>

        {openMenu === 'STATUS' && (
          <div className="absolute top-full mt-2 left-0 w-48 bg-surface rounded-xl shadow-xl border border-gray-100 z-50 p-1 overflow-hidden">
            <button onClick={() => { updateFilters('status', 'TODOS'); setOpenMenu(null) }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface/50 ${statusSelecionado === 'TODOS' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}>
              Todos
            </button>
            <button onClick={() => { updateFilters('status', 'PENDENTE'); setOpenMenu(null) }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface/50 ${statusSelecionado === 'PENDENTE' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}>
              🕒 A Fazer (Pendentes)
            </button>
            <button onClick={() => { updateFilters('status', 'FEITO'); setOpenMenu(null) }} className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-surface/50 ${statusSelecionado === 'FEITO' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}>
              🏁 Concluídas
            </button>
          </div>
        )}
      </div>

      {/* BOTÃO LIMPAR */}
      {(projetosSelecionados.length > 0 || usuariosSelecionados.length > 0 || statusSelecionado !== 'TODOS') && (
        <button 
          onClick={limparFiltros}
          className="text-xs text-rose-500 hover:text-rose-700 hover:underline px-2"
        >
          Limpar filtros
        </button>
      )}

    </div>
  )
}