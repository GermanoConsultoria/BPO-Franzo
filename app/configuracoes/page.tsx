import Link from 'next/link'
import { Users, Building2, ChevronRight } from 'lucide-react'
import { redirect } from 'next/navigation'
import { PERMISSOES, temPermissao } from '@/lib/permissoes'
import { getUsuarioLogado } from '@/lib/usuario-logado'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesHubPage() {
  const usuarioLogado = await getUsuarioLogado()
  if (!usuarioLogado) redirect('/login')

  const acessaConfiguracoes = usuarioLogado.role === 'ADMIN'
    || temPermissao(usuarioLogado, PERMISSOES.GERENCIAR_USUARIOS)
    || temPermissao(usuarioLogado, PERMISSOES.GERENCIAR_EQUIPES)
  if (!acessaConfiguracoes) redirect('/')

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen animate-in fade-in">

      <header className="mb-10 border-b border-border pb-6">
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-gray-500 mt-2">Central de controle do BPO: usuários e clientes.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

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
              Crie contas, defina o papel de acesso e desative usuários.
            </p>
          </div>
        </Link>

        {/* --- CARD 2: CLIENTES --- */}
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
            <h3 className="text-xl font-bold text-foreground group-hover:text-emerald-500 transition-colors">Clientes</h3>
            <p className="text-sm text-gray-500 mt-2">
              Cadastre o financeiro de cada cliente e defina quem tem acesso a ele.
            </p>
          </div>
        </Link>

      </div>
    </div>
  )
}
