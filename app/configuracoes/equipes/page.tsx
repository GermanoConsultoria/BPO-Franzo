import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { criarEquipe } from '@/app/actions'
import { Settings, Users, Wallet } from 'lucide-react'
import { PERMISSOES, temPermissao } from '@/lib/permissoes'
import { getUsuarioLogado } from '@/lib/usuario-logado'

export const dynamic = 'force-dynamic'

export default async function GestaoClientesPage() {
  const usuarioLogado = await getUsuarioLogado()
  if (!usuarioLogado || !temPermissao(usuarioLogado, PERMISSOES.GERENCIAR_EQUIPES)) redirect('/')

  const equipes = await prisma.equipe.findMany({
    where: { workspace_id: usuarioLogado.workspace_id! },
    orderBy: { nome: 'asc' },
    include: {
        _count: { select: { membros: true, planoContas: true } }
    }
  })

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen animate-in fade-in">
      <header className="mb-8 border-b border-border pb-6 flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-text-muted mt-2">Cada cliente tem seu próprio financeiro, isolado dos demais.</p>
        </div>

        <form action={criarEquipe} className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-border shadow-sm">
            <input
                name="nome"
                placeholder="Nome do novo cliente..."
                required
                className="bg-transparent border-none outline-none px-3 text-sm text-foreground placeholder:text-gray-500 w-48"
            />
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md text-sm font-bold transition-colors">
                + Criar
            </button>
        </form>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {equipes.map(equipe => (
            <Link
                key={equipe.id}
                href={`/configuracoes/equipes/${equipe.id}`}
                className="bg-surface border border-border rounded-xl p-5 hover:border-emerald-500/50 hover:shadow-md transition-all group flex flex-col"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-lg border border-emerald-500/20">
                            {equipe.nome.substring(0, 1).toUpperCase()}
                        </div>
                        <h3 className="font-bold text-foreground text-lg group-hover:text-emerald-500 transition-colors">
                            {equipe.nome}
                        </h3>
                    </div>
                    <Settings className="text-gray-400 group-hover:text-emerald-500 transition-colors" size={20} />
                </div>

                <div className="mt-auto flex items-center gap-4 text-sm text-gray-500 pt-4 border-t border-border/50">
                    <span className="flex items-center gap-1.5"><Users size={16} /> {equipe._count.membros} usuários</span>
                    <span className="flex items-center gap-1.5"><Wallet size={16} /> {equipe._count.planoContas} contas cadastradas</span>
                </div>
            </Link>
        ))}

        {equipes.length === 0 && (
            <div className="col-span-full p-12 text-center border-2 border-dashed border-border rounded-xl text-gray-400">
                Nenhum cliente cadastrado ainda.
            </div>
        )}
      </div>
    </div>
  )
}
