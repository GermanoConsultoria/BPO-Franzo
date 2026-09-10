import { prisma } from '@/lib/prisma'
import DashboardTarefas from '@/components/DashboardTarefas'
import AvatarProjeto from '@/components/AvatarProjeto'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { hojeNoFusoBrasil } from '@/lib/date'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Home() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  // 1. Busca o usuário e TODAS as equipes que ele faz parte
  const usuario = await prisma.usuario.findUnique({
    where: { email: session.user.email },
    include: { equipes: { include: { equipe: true } } }
  })
  
  if (!usuario || usuario.equipes.length === 0) {
      return <div className="p-8">Você não tem acesso a nenhuma equipe.</div>
  }

  // Pegamos a primeira equipe APENAS para preencher o visual da Topbar.
  const equipeVisual = usuario.equipes[0].equipe

  // --- LÓGICA DE FUSO HORÁRIO ---
  const hojeBrasil = hojeNoFusoBrasil()

  const horaAtual = new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })
  const hora = Number(horaAtual)
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  // Converte "hoje às 00:00 local" para UTC para comparação com o banco (que armazena em UTC)
  const hojeUTC = new Date(Date.UTC(hojeBrasil.getFullYear(), hojeBrasil.getMonth(), hojeBrasil.getDate(), 3, 0, 0))

  // --- 2. BUSCA GLOBAL DE TAREFAS (BLINDADA PELO WORKSPACE) ---
  const atrasadas = await prisma.tarefa.findMany({
    where: { 
        usuario_id: usuario.id, 
        concluida: false, 
        dt_vencimento: { lt: hojeUTC }, 
        projeto: { 
            ativo: true,
            workspace_id: usuario.workspace_id // <--- O SEGREDO ESTÁ AQUI
        } 
    },
    take: 50, 
    orderBy: { dt_vencimento: 'asc' },
    include: { projeto: true, usuario: true, prioridade: true, dificuldade: true, comentarios: { include: { usuario: true }, orderBy: { dt_insert: 'asc' } } }
  })

  const futuras = await prisma.tarefa.findMany({
    where: { 
        usuario_id: usuario.id, 
        concluida: false, 
        dt_vencimento: { gte: hojeUTC }, 
        projeto: { 
            ativo: true,
            workspace_id: usuario.workspace_id // <--- O SEGREDO ESTÁ AQUI
        } 
    },
    take: 50, 
    orderBy: { dt_vencimento: 'asc' },
    include: { projeto: true, usuario: true, prioridade: true, dificuldade: true, comentarios: { include: { usuario: true }, orderBy: { dt_insert: 'asc' } } }
  })

  const minhasTarefas = [...atrasadas, ...futuras]

  // --- 3. BUSCA GLOBAL DE PROJETOS RECENTES (BLINDADA PELO WORKSPACE) ---
  const projetosRecentes = await prisma.projeto.findMany({
    where: { 
        ativo: true,
        workspace_id: usuario.workspace_id // <--- O SEGREDO ESTÁ AQUI
    },
    orderBy: { dt_acesso: 'desc' },
    take: 6,
    include: { _count: { select: { tarefas: true } } }
  })

  const todosProjetos = await prisma.projeto.findMany({
    where: { 
        ativo: true,
        workspace_id: usuario.workspace_id // <--- O SEGREDO ESTÁ AQUI
    },
    include: { colunas: { include: { coluna: true }, orderBy: { ordem: 'asc' } } }
  })

  const todosUsuarios = await prisma.usuario.findMany({
    where: { workspace_id: usuario.workspace_id },
    orderBy: { nome: 'asc' }
  })

  return (
    <AuthenticatedLayout
        usuario={usuario as unknown as import('@/types').Usuario}
        equipeAtual={equipeVisual}
        minhasEquipes={usuario.equipes.map(e => e.equipe)}
        projetosIniciais={projetosRecentes}
    >
        <div className="p-2 lg:p-8 max-w-full lg:max-w-7xl mx-auto min-h-screen">
          <header className="mb-4 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              {saudacao}, {usuario.nome.split(' ')[0]}!
            </h1>
            <p className="text-gray-500 text-xs lg:text-sm mt-1">
               Aqui está o resumo global do seu dia (Todas as Equipes). 
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-start">
            <DashboardTarefas
              tarefas={minhasTarefas as unknown as import('@/types').TarefaComRelacoes[]}
              usuarioNome={usuario.nome}
              usuarioId={usuario.id}
              projetosDisponiveis={todosProjetos as unknown as import('@/types').ProjetoComColunas[]}
              usuariosDisponiveis={todosUsuarios as unknown as import('@/types').UsuarioBasico[]}
              equipeAtualId={equipeVisual.id}
            />

            <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 lg:p-5 border-b border-gray-100 flex flex-col gap-3 lg:gap-4 bg-surface/50 min-h-[80px] lg:min-h-[105px] justify-center">
                    <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2 lg:gap-3">
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-sm lg:text-base">📂</div>
                            <h2 className="font-bold text-foreground text-sm lg:text-base">Projetos Recentes</h2>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 lg:p-4">
                     {projetosRecentes.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <span className="text-4xl mb-2">📭</span>
                            <p className="text-xs lg:text-sm">Nenhum projeto acessado.</p>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 lg:gap-3">
                            {projetosRecentes.map(projeto => (
                            <Link key={projeto.id} href={`/equipe/${projeto.equipe_id}/projeto/${projeto.id}`} className="flex flex-col justify-center p-3 lg:p-4 rounded-xl bg-surface border border-border shadow-sm hover:shadow-md hover:border-indigo-300 transition-all h-24 lg:h-28 group">
                                <div className="flex items-center gap-2 lg:mb-2">
                                    <AvatarProjeto projetoId={projeto.id} imagem={projeto.imagem} nome={projeto.nome} tamanho="w-8 h-8 lg:w-10 lg:h-10" readonly={true} />
                                    <h3 className="font-bold text-foreground text-xs lg:text-sm truncate w-full" title={projeto.nome}>{projeto.nome}</h3>
                                </div>
                                <div className="flex justify-end items-end mt-1">
                                    <span className="text-[9px] lg:text-[10px] bg-surface/50 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">{projeto._count.tarefas} tarefas</span>
                                </div>
                            </Link>
                            ))}
                        </div>
                     )}
                </div>
            </div>
          </div>
        </div>
    </AuthenticatedLayout>
  )
}