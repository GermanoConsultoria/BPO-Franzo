import Link from 'next/link'
import { Users, Building2, ShieldAlert, ChevronRight } from 'lucide-react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesHubPage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (usuarioLogado?.role !== 'OWNER') redirect('/')

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen animate-in fade-in">
      
      <header className="mb-10 border-b border-border pb-6">
        <h1 className="text-3xl font-bold text-foreground">Configurações do Workspace</h1>
        <p className="text-gray-500 mt-2">Central de controle da empresa, equipes e acessos.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* --- CARD 1: USUÁRIOS --- */}
        <Link 
            href="/configuracoes/usuarios" 
            className="group relative flex flex-col justify-between h-full bg-surface border border-border rounded-xl p-6 hover:border-indigo-500/50 hover:shadow-lg transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                <Users size={28} />
              </div>
              <ChevronRight className="text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-xl font-bold text-foreground group-hover:text-indigo-500 transition-colors">Gestão de Usuários</h3>
            <p className="text-sm text-gray-500 mt-2">
              Controle global. Crie contas, resete senhas e desative colaboradores da empresa.
            </p>
          </div>
        </Link>

        {/* --- CARD 2: EQUIPES (NOVO) --- */}
        <Link 
            href="/configuracoes/equipes" 
            className="group relative flex flex-col justify-between h-full bg-surface border border-border rounded-xl p-6 hover:border-emerald-500/50 hover:shadow-lg transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <Building2 size={28} />
              </div>
              <ChevronRight className="text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-xl font-bold text-foreground group-hover:text-emerald-500 transition-colors">Equipes e Departamentos</h3>
            <p className="text-sm text-gray-500 mt-2">
              Crie equipes, defina as etapas do Kanban de cada uma e aloque quem participa.
            </p>
          </div>
        </Link>

        {/* --- CARD 3: EM BREVE --- */}
        <div className="group relative flex flex-col justify-between h-full bg-surface/40 border border-border/50 border-dashed rounded-xl p-6 cursor-not-allowed opacity-60">
          <div>
             <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gray-500/10 rounded-lg text-gray-400">
                <ShieldAlert size={28} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-400">Segurança & Auditoria</h3>
            <p className="text-sm text-gray-500 mt-2">
              Logs de ações e restrições avançadas do Workspace. (Em desenvolvimento)
            </p>
          </div>
          <div className="mt-4">
             <span className="text-[10px] font-bold uppercase bg-gray-200 dark:bg-gray-800 text-gray-500 px-2 py-1 rounded">Em Breve</span>
          </div>
        </div>

      </div>
    </div>
  )
}