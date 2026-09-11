'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import EquipeTopbar from '@/components/EquipeTopbar'
import { signOut } from 'next-auth/react'
import { Menu, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { Usuario, EquipeBasica } from '@/types'
import { PERMISSOES, temPermissao } from '@/lib/permissoes'

const ITENS_FINANCEIRO = [
  { slug: 'financeiro/balancete', icon: '📊', label: 'Balancete' },
  { slug: 'financeiro/contas-a-pagar', icon: '📤', label: 'Contas a Pagar' },
  { slug: 'financeiro/contas-a-receber', icon: '📥', label: 'Contas a Receber' },
  { slug: 'financeiro/plano-contas', icon: '🗂️', label: 'Plano de Contas' },
] as const

interface AuthenticatedLayoutProps {
  children: React.ReactNode
  usuario: Usuario
  equipeAtual: EquipeBasica | null
  minhasEquipes: EquipeBasica[]
}

export default function AuthenticatedLayout({ children, usuario, equipeAtual, minhasEquipes }: AuthenticatedLayoutProps) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [equipeExpandida, setEquipeExpandida] = useState<string | null>(equipeAtual?.id ?? null)

  // Segue o cliente atual conforme a navegação muda (link direto, seletor da topbar, etc.)
  const [ultimoEquipeAtualId, setUltimoEquipeAtualId] = useState(equipeAtual?.id ?? null)
  if (equipeAtual?.id && equipeAtual.id !== ultimoEquipeAtualId) {
    setUltimoEquipeAtualId(equipeAtual.id)
    setEquipeExpandida(equipeAtual.id)
  }

  if (pathname?.startsWith('/login')) {
      return <main className="min-h-screen bg-surface/50 flex flex-col justify-center">{children}</main>
  }

  // ADMIN e PERSONALIZADO com "ver todos os clientes" navegam entre todos os
  // clientes direto pela sidebar; os demais só veem o cliente atual.
  const veTodosOsClientes = usuario?.role === 'ADMIN' || temPermissao(usuario, PERMISSOES.VER_TODOS_CLIENTES)

  // PERSONALIZADO sem "controle financeiro" não vê nenhuma aba do financeiro.
  const podeVerFinanceiro = usuario?.role !== 'PERSONALIZADO' || temPermissao(usuario, PERMISSOES.CONTROLE_FINANCEIRO)

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
                  {veTodosOsClientes ? (
                      minhasEquipes.map(equipe => (
                          <ClienteMenuGroup
                              key={equipe.id}
                              equipe={equipe}
                              sidebarOpen={isSidebarOpen}
                              expanded={isSidebarOpen && equipeExpandida === equipe.id}
                              onToggle={() => setEquipeExpandida(prev => prev === equipe.id ? null : equipe.id)}
                              pathname={pathname}
                              podeVerFinanceiro={podeVerFinanceiro}
                          />
                      ))
                  ) : equipeAtual?.id && podeVerFinanceiro && (
                      <>
                          {ITENS_FINANCEIRO.map(item => (
                              <SidebarLink
                                  key={item.slug}
                                  href={`/equipe/${equipeAtual.id}/${item.slug}`}
                                  icon={item.icon}
                                  label={item.label}
                                  isOpen={isSidebarOpen}
                                  active={pathname.includes(`/${item.slug}`)}
                              />
                          ))}
                      </>
                  )}
                </div>
            </div>

            <div className="mt-auto pt-2 border-t border-border pb-4 px-2 bg-surface">
                {(usuario?.role === 'ADMIN'
                  || temPermissao(usuario, PERMISSOES.GERENCIAR_USUARIOS)
                  || temPermissao(usuario, PERMISSOES.GERENCIAR_EQUIPES)) && (
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

interface ClienteMenuGroupProps {
    equipe: EquipeBasica
    sidebarOpen: boolean
    expanded: boolean
    onToggle: () => void
    pathname: string
    podeVerFinanceiro: boolean
}

function ClienteMenuGroup({ equipe, sidebarOpen, expanded, onToggle, pathname, podeVerFinanceiro }: ClienteMenuGroupProps) {
    if (!podeVerFinanceiro) return null

    const ativoNesteCliente = pathname.startsWith(`/equipe/${equipe.id}/`)
    const iniciais = equipe.nome.substring(0, 2).toUpperCase()

    if (!sidebarOpen) {
        return (
            <Link
                href={`/equipe/${equipe.id}/financeiro/balancete`}
                title={equipe.nome}
                className={`group flex items-center justify-center px-3 py-2 rounded-md transition-all border ${ativoNesteCliente ? 'bg-indigo-500/10 border-indigo-500/20 shadow-sm' : 'border-transparent hover:bg-surface-highlight'}`}
            >
                <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${ativoNesteCliente ? 'bg-indigo-600 text-white' : 'bg-surface-highlight border border-border text-gray-400'}`}>
                    {iniciais}
                </span>
            </Link>
        )
    }

    return (
        <div>
            <button
                onClick={onToggle}
                className={`w-full group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${ativoNesteCliente ? 'text-indigo-400' : 'text-gray-400 hover:bg-surface-highlight hover:text-foreground'}`}
            >
                <span className="flex items-center gap-2 truncate">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${ativoNesteCliente ? 'bg-indigo-600 text-white' : 'bg-surface-highlight border border-border text-gray-400'}`}>
                        {iniciais}
                    </span>
                    <span className="truncate">{equipe.nome}</span>
                </span>
                <ChevronRight size={14} className={`flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>

            {expanded && (
                <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
                    {ITENS_FINANCEIRO.map(item => (
                        <SidebarLink
                            key={item.slug}
                            href={`/equipe/${equipe.id}/${item.slug}`}
                            icon={item.icon}
                            label={item.label}
                            isOpen={true}
                            active={pathname.startsWith(`/equipe/${equipe.id}/${item.slug}`)}
                        />
                    ))}
                </div>
            )}
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
