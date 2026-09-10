'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import SidebarRecentes from '@/components/SidebarRecentes'
import ModalCriarProjeto from '@/components/ModalCriarProjeto'
import EquipeTopbar from '@/components/EquipeTopbar'
import { signOut } from 'next-auth/react'
import { Menu, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import type { Usuario, EquipeBasica, ProjetoRecente } from '@/types'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
  usuario: Usuario
  equipeAtual: EquipeBasica | null
  minhasEquipes: EquipeBasica[]
  projetosIniciais: ProjetoRecente[]
}

export default function AuthenticatedLayout({ children, usuario, equipeAtual, minhasEquipes, projetosIniciais }: AuthenticatedLayoutProps) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showModalProjeto, setShowModalProjeto] = useState(false)
  const [financeiroAberto, setFinanceiroAberto] = useState(pathname.startsWith('/financeiro'))

  if (pathname?.startsWith('/login')) {
      return <main className="min-h-screen bg-surface/50 flex flex-col justify-center">{children}</main>
  }

  const isFinanceiroAtivo = pathname.startsWith('/financeiro')

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <ModalCriarProjeto isOpen={showModalProjeto} onClose={() => setShowModalProjeto(false)} equipeId={equipeAtual?.id ?? ''}/>

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
                  <SidebarLink href="/" icon="🏠" label="Início" isOpen={isSidebarOpen} active={pathname === '/'} />

                  {/* FINANCEIRO — expansível */}
                  <div>
                    <button
                      onClick={() => { if (isSidebarOpen) setFinanceiroAberto(v => !v) }}
                      className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${!isSidebarOpen && 'justify-center'} ${isFinanceiroAtivo ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm' : 'text-gray-400 border border-transparent hover:bg-surface-highlight hover:text-foreground'}`}
                      title={!isSidebarOpen ? 'Financeiro' : ''}
                    >
                      <span className="text-lg">💰</span>
                      <span className={`ml-3 flex-1 text-left transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>Financeiro</span>
                      {isSidebarOpen && (
                        <ChevronDown size={14} className={`transition-transform duration-200 ${financeiroAberto ? 'rotate-180' : ''}`} />
                      )}
                    </button>

                    {isSidebarOpen && financeiroAberto && (
                      <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-3">
                        <SubLink href="/financeiro/balancete" label="Balancete" active={pathname === '/financeiro/balancete'} />
                        <SubLink href="/financeiro/contas-a-pagar" label="Contas a Pagar" active={pathname === '/financeiro/contas-a-pagar'} />
                        <SubLink href="/financeiro/contas-a-receber" label="Contas a Receber" active={pathname === '/financeiro/contas-a-receber'} />
                        <SubLink href="/financeiro/plano-contas" label="Plano de Contas" active={pathname === '/financeiro/plano-contas'} />
                      </div>
                    )}
                  </div>

                  {equipeAtual?.id && (
                      <>
                          <SidebarLink href={`/equipe/${equipeAtual.id}/projetos`} icon="📂" label="Projetos" isOpen={isSidebarOpen} active={pathname.includes('/projetos')} />
                          <SidebarLink href={`/equipe/${equipeAtual.id}/minhas-tarefas`} icon="✅" label="Tarefas" isOpen={isSidebarOpen} active={pathname.includes('/minhas-tarefas')} />
                          <SidebarLink href={`/equipe/${equipeAtual.id}/sprint`} icon="🚀" label="Sprint" isOpen={isSidebarOpen} active={pathname.includes('/sprint')} />
                          <SidebarLink href={`/equipe/${equipeAtual.id}/dashboards`} icon="📊" label="Dashboards" isOpen={isSidebarOpen} active={pathname.includes('/dashboards')} />
                          <SidebarLink href={`/equipe/${equipeAtual.id}/portfolio`} icon="🎯" label="Portfólio" isOpen={isSidebarOpen} active={pathname.includes('/portfolio')} />
                          <SidebarLink href={`/equipe/${equipeAtual.id}/recursos`} icon="🔗" label="Recursos" isOpen={isSidebarOpen} active={pathname.includes('/recursos')} />
                          <SidebarLink href={`/equipe/${equipeAtual.id}/relatorio`} icon="📋" label="Relatório" isOpen={isSidebarOpen} active={pathname.includes('/relatorio')} />
                      </>
                  )}
                </div>

                <div className={`border-t border-border my-2 ${!isSidebarOpen && 'border-transparent'}`}></div>

                <div className={`px-4 py-2 ${!isSidebarOpen && 'flex justify-center'}`}>
                    {isSidebarOpen ? (
                        <button onClick={() => setShowModalProjeto(true)} className="w-full flex items-center justify-between px-2 py-1 text-xs font-semibold text-gray-500 hover:text-foreground hover:bg-surface-highlight rounded transition-colors uppercase">
                            <span>Projetos Recentes</span>
                            <span className="text-lg leading-none">+</span>
                        </button>
                    ) : (
                        <button onClick={() => setShowModalProjeto(true)} className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center shadow-md" title="Novo Projeto">+</button>
                    )}
                </div>

                <div className={`flex-1 overflow-y-auto custom-scrollbar-dark ${!isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <SidebarRecentes inicialProjetos={projetosIniciais || []} equipeId={equipeAtual?.id ?? ''} />
                </div>
            </div>

            <div className="mt-auto pt-2 border-t border-border pb-4 px-2 bg-surface">
                {usuario?.role === 'OWNER' && (
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

function SubLink({ href, label, active }: { href: string; label: string; active: boolean }) {
    return (
        <Link href={href} className={`block px-2 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${active ? 'text-indigo-400 font-medium' : 'text-gray-400 hover:text-foreground hover:bg-surface-highlight'}`}>
            {label}
        </Link>
    )
}
