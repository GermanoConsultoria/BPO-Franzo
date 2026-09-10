'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ProjetoRecente } from '@/types'

export default function SidebarRecentes({ inicialProjetos, equipeId }: { inicialProjetos: ProjetoRecente[], equipeId: string }) {
  const [projetos, setProjetos] = useState<ProjetoRecente[]>(inicialProjetos)
  const pathname = usePathname()

  useEffect(() => {
    if (!equipeId) return
    fetch(`/api/equipe/${equipeId}/projetos-recentes`)
      .then(res => res.json())
      .then(data => setProjetos(data))
      .catch(() => {/* mantém estado anterior */})
  }, [pathname, equipeId]) // Recarrega se mudar a rota ou a equipe

  return (
    <div className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar-dark mb-2 min-h-0">
      {projetos.map(proj => (
         <Link 
           key={proj.id}
           href={`/equipe/${equipeId}/projeto/${proj.id}`} // <--- GARANTE A URL CERTA
           className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${pathname === `/equipe/${equipeId}/projeto/${proj.id}` ? 'bg-surface/10 text-white font-medium' : 'hover:bg-surface/5 text-gray-400 hover:text-white'}`}
         >
           <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0"></span>
           <span className="truncate">{proj.nome}</span>
         </Link>
      ))}
    </div>
  )
}