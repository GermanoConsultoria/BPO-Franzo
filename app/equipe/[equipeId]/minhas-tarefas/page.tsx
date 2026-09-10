import { prisma } from '@/lib/prisma'
import MinhasTarefasView from '@/components/MinhasTarefasView'
import ModalCriarTarefaGeral from '@/components/ModalCriarTarefaGeral'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { hojeNoFusoBrasil, extrairDataYMD } from '@/lib/date'

// OBRIGATÓRIO: Força a página a ser dinâmica
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Lendo o parâmetro dinâmico da equipe
export default async function MinhasTarefasPage({ params }: { params: Promise<{ equipeId: string }> }) {
  const { equipeId } = await params
  const session = await auth()
  
  if (!session?.user?.email) redirect('/login')

  const usuario = await prisma.usuario.findUnique({
      where: { email: session.user.email }
  })

  if (!usuario) return <div>Usuário não encontrado.</div>

  const dataBrasil = hojeNoFusoBrasil()
  const filtroTarefas = usuario.role === 'OWNER' ? {} : { usuario_id: usuario.id }

  // 1. BUSCA DE TAREFAS (Filtro em cascata pela Equipe)
  const tarefas = await prisma.tarefa.findMany({
    where: {
      ...filtroTarefas,
      projeto: {
         ativo: true,
         equipe_id: equipeId // <--- A MÁGICA AQUI: Só tarefas de projetos desta equipe
      }
    },
    orderBy: { dt_vencimento: 'asc' },
    include: {
      projeto: true, coluna: true, usuario: true, anexos: true,
      comentarios: { include: { usuario: true }, orderBy: { dt_insert: 'asc' } },
      prioridade: true, dificuldade: true
    }
  })

  // 2. BUSCA DE PROJETOS (Apenas desta equipe)
  const projetos = await prisma.projeto.findMany({
    where: { 
      equipe_id: equipeId, // <--- FILTRO DA EQUIPE AQUI
      ativo: true
    },
    orderBy: { nome: 'asc' },
    include: {
      colunas: {
        include: { coluna: true },
        orderBy: { ordem: 'asc' }
      }
    }
  })

  // 3. BUSCA DE USUÁRIOS (Apenas os que pertencem a esta equipe)
  const usuariosDaEquipe = await prisma.usuario.findMany({ 
    where: { 
       equipes: {
          some: { equipe_id: equipeId } // Verifica na tabela N:N
       }
    },
    orderBy: { nome: 'asc' }
  })

  return (
    <div className="flex flex-col h-full bg-background p-0">
      
      <header className="mb-2 flex-shrink-0 flex justify-between items-end px-1">
        <div>
            <h1 className="text-lg lg:text-2xl font-bold text-foreground">
                {usuario.role === 'OWNER' ? 'Visão Geral (Admin)' : 'Minhas Tarefas'}
            </h1>
            <p className="text-[10px] lg:text-sm text-text-muted leading-tight">
                {usuario.role === 'OWNER' ? 'Gerencie todas as tarefas desta equipe.' : 'Suas pendências nesta equipe.'}
            </p>
        </div>
        <ModalCriarTarefaGeral listaProjetos={projetos as unknown as import('@/types').ProjetoComColunas[]} usuarios={usuariosDaEquipe} />
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        <MinhasTarefasView
            tarefasIniciais={tarefas as unknown as import('@/types').TarefaComRelacoes[]}
            listaProjetos={projetos as unknown as import('@/types').ProjetoComColunas[]}
            usuarios={usuariosDaEquipe}
            colunas={[]}
            agrupamento="PROJETO"
            initialCalendarDate={extrairDataYMD(dataBrasil) ?? undefined}
            usuarioLogadoId={usuario.id}
        />
      </div>
    </div>
  )
}