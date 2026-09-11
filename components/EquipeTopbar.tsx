'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { ChevronDown, Globe } from 'lucide-react'
import type { EquipeBasica } from '@/types'

interface Props {
  equipeAtual: EquipeBasica | null
  minhasEquipes: EquipeBasica[]
  botaoMenu: React.ReactNode
}

export default function EquipeTopbar({ equipeAtual, minhasEquipes, botaoMenu }: Props) {
  const [menuEquipeOpen, setMenuEquipeOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  
  // Lemos a URL para saber onde o usuário está
  const pathname = usePathname()
  const isGlobalHome = pathname === '/' || pathname?.startsWith('/configuracoes')

  // Fecha o menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuEquipeOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center px-4 lg:px-6 flex-shrink-0 z-30">
      
      {/* 1. Área da Logo e Hambúrguer */}
      <div className="flex items-center gap-4 w-[220px]">
         {botaoMenu}
         <span className="hidden sm:block text-xl font-bold tracking-wide text-foreground">BPO</span>
         <Image
            src="/LOGO-LETICIA-FRAZON.png"
            alt="Letícia Frazon"
            width={500}
            height={500}
            className="hidden sm:block h-9 w-9 object-contain"
         />
      </div>

      {/* 2. Área Contextual (Global vs Equipe) */}
      <div className="flex items-center gap-4 ml-2 border-l border-border pl-6">
        
        {isGlobalHome ? (
            // --- VISÃO GLOBAL (Sem Seletor) ---
            <div className="flex items-center gap-2 px-2 py-1.5 cursor-default select-none">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shadow-sm border border-indigo-500/20">
                 <Globe size={18} />
              </div>
              <div className="text-left hidden md:block">
                 <p className="text-[9px] text-indigo-400 font-bold uppercase leading-none mb-0.5">Workspace</p>
                 <p className="text-sm font-bold text-foreground leading-none">Visão Global</p>
              </div>
            </div>
        ) : (
            // --- SELETOR DE EQUIPE (Aparece apenas dentro dos módulos) ---
            <div className="relative" ref={menuRef}>
               <button onClick={() => setMenuEquipeOpen(!menuEquipeOpen)} className="flex items-center gap-2 hover:bg-surface-highlight/50 px-2 py-1.5 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                     {equipeAtual?.nome?.substring(0, 2).toUpperCase() || '?'}
                  </div>
                  <div className="text-left hidden md:block">
                     <p className="text-[9px] text-text-muted font-bold uppercase leading-none mb-0.5">Cliente Atual</p>
                     <p className="text-sm font-bold text-foreground leading-none">{equipeAtual?.nome || 'Carregando...'}</p>
                  </div>
                  <ChevronDown size={14} className="text-gray-400 ml-1" />
               </button>

               {menuEquipeOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-surface rounded-xl shadow-xl border border-border overflow-hidden z-50">
                     <div className="p-2 space-y-1">
                        {minhasEquipes.map(eq => (
                           <button
                              key={eq.id}
                              onClick={() => {
                                 setMenuEquipeOpen(false)
                                 // Navega mantendo a tela atual, mas trocando a equipe (ex: de tarefas para tarefas)
                                 const currentContext = pathname.split('/').slice(3).join('/') || 'financeiro/balancete'
                                 router.push(`/equipe/${eq.id}/${currentContext}`)
                              }}
                              className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${eq.id === equipeAtual?.id ? 'bg-indigo-50/10 border border-indigo-500/30' : 'hover:bg-surface-highlight'}`}
                           >
                              <div className={`w-7 h-7 rounded flex items-center justify-center font-bold text-xs ${eq.id === equipeAtual?.id ? 'bg-indigo-600 text-white' : 'bg-surface-highlight border border-border text-gray-400'}`}>
                                 {eq.nome.substring(0, 2).toUpperCase()}
                              </div>
                              <span className={`text-sm truncate ${eq.id === equipeAtual?.id ? 'font-bold text-indigo-400' : 'font-medium text-foreground'}`}>{eq.nome}</span>
                           </button>
                        ))}
                     </div>
                  </div>
               )}
            </div>
        )}
      </div>

    </header>
  )
}