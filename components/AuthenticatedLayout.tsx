'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import EquipeTopbar from '@/components/EquipeTopbar'
import { signOut } from 'next-auth/react'
import { Menu } from 'lucide-react'
import Link from 'next/link'
import type { Usuario, EquipeBasica } from '@/types'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
  usuario: Usuario
  equipeAtual: EquipeBasica | null
  minhasEquipes: EquipeBasica[]
}

export default function AuthenticatedLayout({ children, usuario, equipeAtual, minhasEquipes }: AuthenticatedLayoutProps) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  if (pathname?.startsWith('/login')) {
      return <main className="min-h-screen bg-surface/50 flex flex-col justify-center">{children}</main>
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <EquipeTopbar
        equipeAtual={equipeAtual}
        minhasEquipes={minhasEquipes || []}
        botaoMenu={
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md hover:bg-surface-highlight/50 text-gray-400 hover:text-foreground transition-all">
            <Menu size={20} />
          </button>
        }
      />

      <div className="flex flex-1 overflow-hidden">
         <aside className={`${isSidebarOpen ? 'w-64' : 'w-[72px]'} bg-surface border-r border-border flex flex-col flex-shrink-0 transition-all duration-300 z-20`}>

            <div className="flex-1 flex flex-col overflow-hidden pt-4">
                <div className="p-2 space-y-1">
                  {equipeAtual?.id && (
                      <>
                          <SidebarLink href={`/equipe/${equipeAtual.id}/financeiro/balancete`} icon="📊" label="Balancete" isOpen={isSidebarOpen} active={pathname.includes('/financeiro/balancete')} />
                          <SidebarLink href={`/equipe/${equipeAtual.id}/financeiro/contas-a-pagar`} icon="📤" label="Contas a Pagar" isOpen={isSidebarOpen} active={pathname.includes('/financeiro/contas-a-pagar')} />
                          <SidebarLink href={`/equipe/${equipeAtual.id}/financeiro/contas-a-receber`} icon="📥" label="Contas a Receber" isOpen={isSidebarOpen} active={pathname.includes('/financeiro/contas-a-receber')} />
                          <SidebarLink href={`/equipe/${equipeAtual.id}/financeiro/plano-contas`} icon="🗂️" label="Plano de Contas" isOpen={isSidebarOpen} active={pathname.includes('/financeiro/plano-contas')} />
                      </>
                  )}
                </div>
            </div>

            <div className="mt-auto pt-2 border-t border-border pb-4 px-2 bg-surface">
                {usuario?.role === 'ADMIN' && (
                    <div className="pb-1">
                        <SidebarLink href="/configuracoes" icon="⚙️" label="Configurações" isOpen={isSidebarOpen} active={pathname?.includes('/configuracoes')} />
                    </div>
                )}
                 <button onClick={() => signOut({ callbackUrl: '/login' })} className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-red-500/10 text-gray-500 hover:text-red-400 whitespace-nowrap transition-colors ${!isSidebarOpen && 'justify-center'}`} title="Sair">
                    <span className="text-lg">🚪</span>
                    <span className={`ml-3 transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Sair</span>
                 </button>
            </div>
         </aside>

         <main className="flex-1 overflow-y-auto h-full bg-background p-4 lg:p-6">
            {children}
         </main>
      </div>
    </div>
  )
}

interface SidebarLinkProps {
    href: string
    icon: string
    label: string
    isOpen: boolean
    active: boolean
}

function SidebarLink({ href, icon, label, isOpen, active }: SidebarLinkProps) {
    return (
        <Link href={href} className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${!isOpen && 'justify-center'} ${active ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm' : 'text-gray-400 border border-transparent hover:bg-surface-highlight hover:text-foreground'}`} title={!isOpen ? label : ''}>
            <span className="text-lg">{icon}</span>
            <span className={`ml-3 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>{label}</span>
        </Link>
    )
}
