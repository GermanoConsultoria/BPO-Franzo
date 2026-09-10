import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Kanban, Users, Settings, Package, Plus, Trash2 } from 'lucide-react'
import ItemColuna from '@/components/ItemColuna'
import { 
    criarColuna, 
    atualizarNomeEquipe, 
    adicionarMembroEquipe, 
    removerMembroEquipe,
    criarPacoteTemplate,
    excluirPacoteTemplate,
    adicionarTarefaTemplate,
    removerTarefaTemplate
} from '@/app/actions'
import { revalidatePath } from 'next/cache'
import BotaoExcluirEquipe from '@/components/BotaoExcluirEquipe'
import ItemTarefaTemplate from '@/components/ItemTarefaTemplate'
import GerenciadorPacotes from '@/components/GerenciadorPacotes'
import GerenciadorGithub from '@/components/GerenciadorGithub'

export const dynamic = 'force-dynamic'

// --- ACTIONS LOCAIS PARA AS COLUNAS ---
async function atualizarNomeColuna(id: string, novoNome: string) {
  'use server'
  if (!id || !novoNome) return
  await prisma.coluna.update({ where: { id }, data: { nome: novoNome } })
  revalidatePath('/', 'layout')
}

async function excluirColuna(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  await prisma.coluna.delete({ where: { id } })
  revalidatePath('/', 'layout')
}

export default async function DetalhesEquipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (usuarioLogado?.role !== 'OWNER') redirect('/')

// 1. Busca a Equipe, suas Colunas, Membros e Pacotes (Templates)
  const equipe = await prisma.equipe.findUnique({
    where: { id },
    include: {
        colunas: { orderBy: { nome: 'asc' } },
        membros: { include: { usuario: true } },
        pacotes: {
            include: { tarefas: { orderBy: { dt_insert: 'asc' } } },
            orderBy: { nome: 'asc' }
        }, // TRÁS OS PACOTES E TAREFAS AQUI!
        contasGithub: {
            orderBy: { dt_insert: 'asc' },
            // access_token NUNCA deve ser selecionado aqui — este resultado é passado para um Client Component.
            select: { id: true, equipe_id: true, github_login: true, github_account_id: true, criado_por_id: true, dt_insert: true }
        }
    }
  })

  if (!equipe) return <div className="p-8 text-center text-gray-500">Equipe não encontrada.</div>

  // 2. Busca os usuários globais (para podermos adicionar na equipe)
  const todosUsuarios = await prisma.usuario.findMany({
      where: { workspace_id: usuarioLogado.workspace_id, ativo: true },
      orderBy: { nome: 'asc' }
  })

  // Filtra apenas os usuários que AINDA NÃO estão na equipe
  const idsMembrosAtuais = new Set(equipe.membros.map(m => m.usuario_id))
  const usuariosDisponiveis = todosUsuarios.filter(u => !idsMembrosAtuais.has(u.id))

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto min-h-screen animate-in fade-in">
      
      {/* HEADER DE NAVEGAÇÃO */}
      <Link href="/configuracoes/equipes" className="inline-flex items-center gap-2 text-sm text-indigo-500 hover:text-indigo-600 font-medium mb-6 transition-colors">
         <ArrowLeft size={16} /> Voltar para Equipes
      </Link>

      <header className="mb-8 border-b border-border pb-6 flex justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurar Equipe</h1>
          <p className="text-text-muted mt-2">Ajuste os membros, etapas e detalhes da <strong className="text-indigo-400">{equipe.nome}</strong>.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LADO ESQUERDO: ETAPAS E DETALHES (Ocupa 7 colunas) */}
          <div className="lg:col-span-7 space-y-8">
              
              {/* BLOCO 1: NOME DA EQUIPE */}
              <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-4">
                      <Settings size={16}/> Detalhes da Equipe
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

              {/* BLOCO 2: COLUNAS DO KANBAN */}
              <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                          <Kanban size={16}/> Etapas do Fluxo (Kanban)
                      </h2>
                      <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-bold">{equipe.colunas.length}</span>
                  </div>

                  {/* Criar Coluna */}
                  <form action={criarColuna} className="flex gap-3 mb-6">
                      <input type="hidden" name="equipeId" value={equipe.id} />
                      
                      <input 
                          name="nome" 
                          placeholder="Nova etapa (Ex: Em Teste)" 
                          className="flex-1 bg-background border border-border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-rose-500 text-foreground"
                          required
                      />
                      <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                          Adicionar
                      </button>
                  </form>

                  {/* Lista de Colunas (Reutilizando seu Componente) */}
                  {equipe.colunas.length === 0 ? (
                       <div className="p-6 text-center border-2 border-dashed border-border rounded-xl text-gray-400 text-sm">
                           Nenhuma etapa criada. O Kanban desta equipe está vazio.
                       </div>
                  ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar-thin pr-2">
                          {equipe.colunas.map(coluna => (
                              <ItemColuna 
                                  key={coluna.id}
                                  coluna={coluna}
                                  atualizarAction={atualizarNomeColuna}
                                  excluirAction={excluirColuna}
                              />
                          ))}
                      </div>
                  )}
              </div>
              {/* ========================================== */}
              {/* BLOCO 3: PACOTES DE TAREFAS (TEMPLATES)    */}
              {/* ========================================== */}
              <GerenciadorPacotes equipe={equipe as unknown as import('@/types').EquipeCompleta} />

              {/* ========================================== */}
              {/* BLOCO 4: INTEGRAÇÃO GITHUB                 */}
              {/* ========================================== */}
              <GerenciadorGithub equipe={equipe as unknown as import('@/types').EquipeCompleta} />
          </div>

          {/* LADO DIREITO: MEMBROS (Ocupa 5 colunas) */}
          <div className="lg:col-span-5 space-y-8">
              <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                          <Users size={16}/> Membros da Equipe
                      </h2>
                      <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-xs font-bold">{equipe.membros.length}</span>
                  </div>

                  {/* Adicionar Membro */}
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
                                  <option key={u.id} value={u.id}>{u.nome}</option>
                              ))}
                          </select>
                          <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg font-medium transition-colors text-sm">
                              Vincular
                          </button>
                      </form>
                  ) : (
                      <p className="text-xs text-green-500 bg-green-500/10 p-3 rounded-lg mb-6 border border-green-500/20">
                          Todos os usuários do Workspace já fazem parte desta equipe!
                      </p>
                  )}

                  {/* Lista de Membros Atuais */}
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
                                          {membro.role === 'LIDER' ? 'Líder (Admin)' : 'Colaborador'}
                                      </span>
                                  </div>
                              </div>
                              
                              {/* Botão de Remover Membro */}
                              <form action={removerMembroEquipe}>
                                  <input type="hidden" name="equipeId" value={equipe.id} />
                                  <input type="hidden" name="usuarioId" value={membro.usuario_id} />
                                  <button 
                                      className="text-gray-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded transition-colors"
                                      title="Remover da Equipe"
                                  >
                                      ✕
                                  </button>
                              </form>
                          </div>
                      ))}
                  </div>
                  <div className="mt-8">
                    <BotaoExcluirEquipe equipeId={equipe.id} nomeEquipe={equipe.nome} />
                  </div>
              </div>
          </div>

      </div>
    </div>
  )
}