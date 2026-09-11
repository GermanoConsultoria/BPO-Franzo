import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Settings, Users } from 'lucide-react'
import {
    atualizarNomeEquipe,
    adicionarMembroEquipe,
    removerMembroEquipe,
} from '@/app/actions'
import BotaoExcluirEquipe from '@/components/BotaoExcluirEquipe'
import { PERMISSOES, temPermissao } from '@/lib/permissoes'
import { getUsuarioLogado } from '@/lib/usuario-logado'

export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  PERSONALIZADO: 'Personalizado',
  CLIENTE: 'Cliente',
}

export default async function DetalhesClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const usuarioLogado = await getUsuarioLogado()
  if (!usuarioLogado || !temPermissao(usuarioLogado, PERMISSOES.GERENCIAR_EQUIPES)) redirect('/')

  const equipe = await prisma.equipe.findUnique({
    where: { id },
    include: {
        membros: { include: { usuario: true } },
    }
  })

  if (!equipe) return <div className="p-8 text-center text-gray-500">Cliente não encontrado.</div>

  const todosUsuarios = await prisma.usuario.findMany({
      where: { workspace_id: usuarioLogado.workspace_id, ativo: true },
      orderBy: { nome: 'asc' }
  })

  const idsMembrosAtuais = new Set(equipe.membros.map(m => m.usuario_id))
  const usuariosDisponiveis = todosUsuarios.filter(u => !idsMembrosAtuais.has(u.id))

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto min-h-screen animate-in fade-in">

      <Link href="/configuracoes/equipes" className="inline-flex items-center gap-2 text-sm text-indigo-500 hover:text-indigo-600 font-medium mb-6 transition-colors">
         <ArrowLeft size={16} /> Voltar para Clientes
      </Link>

      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-bold text-foreground">Configurar Cliente</h1>
        <p className="text-text-muted mt-2">Ajuste o nome e quem tem acesso ao financeiro de <strong className="text-indigo-400">{equipe.nome}</strong>.</p>
      </header>

      <div className="space-y-8">

          <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-4">
                  <Settings size={16}/> Detalhes do Cliente
              </h2>
              <form action={async (formData) => {
                  'use server'
                  await atualizarNomeEquipe(equipe.id, formData.get('nome') as string)
              }} className="flex gap-3">
                  <input
                      name="nome"
                      defaultValue={equipe.nome}
                      className="flex-1 bg-background border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 text-foreground font-medium"
                      required
                  />
                  <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                      Salvar
                  </button>
              </form>
          </div>

          <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                      <Users size={16}/> Usuários com acesso
                  </h2>
                  <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-xs font-bold">{equipe.membros.length}</span>
              </div>

              {usuariosDisponiveis.length > 0 ? (
                  <form action={adicionarMembroEquipe} className="flex gap-2 mb-6">
                      <input type="hidden" name="equipeId" value={equipe.id} />
                      <select
                          name="usuarioId"
                          required
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-foreground"
                      >
                          <option value="">Selecione um usuário...</option>
                          {usuariosDisponiveis.map(u => (
                              <option key={u.id} value={u.id}>{u.nome} ({ROLE_LABEL[u.role] ?? u.role})</option>
                          ))}
                      </select>
                      <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm">
                          Vincular
                      </button>
                  </form>
              ) : (
                  <p className="text-xs text-green-500 bg-green-500/10 p-3 rounded-lg mb-6 border border-green-500/20">
                      Todos os usuários ativos já têm acesso a este cliente.
                  </p>
              )}

              <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar-thin pr-1">
                  {equipe.membros.map(membro => (
                      <div key={membro.usuario_id} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:border-emerald-500/30 transition-colors">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs border border-emerald-500/20">
                                  {membro.usuario.nome.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                  <span className="text-sm font-bold text-foreground leading-tight">
                                      {membro.usuario.nome}
                                  </span>
                                  <span className="text-[10px] text-text-muted font-medium">
                                      {ROLE_LABEL[membro.usuario.role] ?? membro.usuario.role}
                                  </span>
                              </div>
                          </div>

                          <form action={removerMembroEquipe}>
                              <input type="hidden" name="equipeId" value={equipe.id} />
                              <input type="hidden" name="usuarioId" value={membro.usuario_id} />
                              <button
                                  className="text-gray-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-colors"
                                  title="Remover acesso"
                              >
                                  ✕
                              </button>
                          </form>
                      </div>
                  ))}
              </div>
          </div>

          <BotaoExcluirEquipe equipeId={equipe.id} nomeEquipe={equipe.nome} />
      </div>
    </div>
  )
}
