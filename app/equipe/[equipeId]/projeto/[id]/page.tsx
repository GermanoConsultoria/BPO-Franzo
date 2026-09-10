import { prisma } from '@/lib/prisma'
import MinhasTarefasView from '@/components/MinhasTarefasView'
import ModalConfigProjeto from '@/components/ModalConfigProjeto'
import ModalCriarTarefa from '@/components/ModalCriarTarefa'
import BotaoStatusProjeto from '@/components/BotaoStatusProjeto'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import ModalEditarProjeto from '@/components/ModalEditarProjeto'
import ModalImportarPacote from '@/components/ModalImportarPacote'
import ModalGantt from '@/components/ModalGantt'
import { formatarDataBR, hojeNoFusoBrasil, parseDateLocal } from '@/lib/date'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProjetoPage({ params }: { params: Promise<{ id: string, equipeId: string }> }) {
  const { id, equipeId } = await params
  
  // --- BUSCAR USUÁRIO LOGADO ---
  const session = await auth()
  
  if (!session?.user?.email) {
      redirect('/login')
  }

  const usuarioLogado = await prisma.usuario.findUnique({
      where: { email: session.user.email }
  })

  if (!usuarioLogado) {
      redirect('/login')
  }

  // Touch (Atualiza data de acesso)
  await prisma.projeto.update({
    where: { id },
    data: { dt_acesso: new Date() }
  })

  // 1. Busca Projeto e Colunas
  const projeto = await prisma.projeto.findUnique({
    where: { id },
    include: {
      colunas: { include: { coluna: true }, orderBy: { ordem: 'asc' } },
      equipe: { include: { pacotes: { include: { tarefas: true } } } },
    }
  })

  if (!projeto) return <div>Projeto não encontrado</div>

  // 2. Busca Tarefas
  const tarefas = await prisma.tarefa.findMany({
    where: { projeto_id: id },
    include: { 
      usuario: true,
      coluna: true,
      prioridade: true,   
      dificuldade: true,
      anexos: true,
      comentarios: { include: { usuario: true }, orderBy: { dt_insert: 'asc' } } 
    },
    orderBy: [
      { ordem: 'asc' },
      { prioridade_id: 'desc' }
    ]
  })

  // 3. Busca Usuários (Para o dropdown de criar tarefa)
  const usuarios = await prisma.usuario.findMany()

  // 4. Biblioteca Geral
  const bibliotecaColunas = await prisma.coluna.findMany({
    where: { equipe_id: equipeId },
    orderBy: { nome: 'asc' } 
  })

  // 5. Colunas do Kanban (inclui datas da etapa)
  const colunasDoKanban = projeto.colunas.map(pc => ({
    ...pc.coluna,
    data_inicio: pc.data_inicio ?? null,
    data_fim: pc.data_fim ?? null,
  }));

  return (
    <div className="flex flex-col h-full bg-background">
      
      {/* HEADER */}
      <header className="px-8 py-6 bg-surface border-b border-border flex justify-between items-center sticky top-0 z-20">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center">
                <h1 className={`text-2xl font-bold ${projeto.ativo ? 'text-foreground' : 'text-gray-400 line-through'}`}>
                    {projeto.nome}
                </h1>
                {/* O NOVO MODAL ENTRA AQUI, COLADO NO TÍTULO */}
                {projeto.ativo && <ModalEditarProjeto projeto={projeto} />}
            </div>
            <BotaoStatusProjeto projetoId={projeto.id} ativo={projeto.ativo} />
          </div>
          <p className="text-text-muted text-sm mt-1">{projeto.descricao || 'Sem descrição'}</p>
          {(projeto.data_inicio || projeto.data_prevista_entrega) && (
            <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
              {projeto.data_inicio && (
                <span>📅 Início: <span className="font-bold text-foreground">{formatarDataBR(projeto.data_inicio)}</span></span>
              )}
              {projeto.data_prevista_entrega && (() => {
                const atrasado = parseDateLocal(projeto.data_prevista_entrega)! < hojeNoFusoBrasil()
                return (
                  <span>🏁 Previsão: <span className={`font-bold ${atrasado ? 'text-red-500' : 'text-indigo-500'}`}>{formatarDataBR(projeto.data_prevista_entrega)}</span></span>
                )
              })()}
            </div>
          )}
          {!projeto.ativo && (
             <span className="text-xs text-red-400 font-bold mt-1 block">⚠️ Projeto Inativo: As tarefas não aparecem na Sprint/Dashboard.</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {projeto.ativo && (
            <>
                <ModalGantt
                    nomeProjeto={projeto.nome}
                    etapas={colunasDoKanban.map(c => ({ nome: c.nome, data_inicio: c.data_inicio, data_fim: c.data_fim, cor: c.cor }))}
                    dataInicioProjeto={projeto.data_inicio ?? null}
                    dataPrevistaEntrega={projeto.data_prevista_entrega ?? null}
                />

                {/* --- O BOTÃO DE IMPORTAR PACOTES ENTRA AQUI --- */}
                {projeto.equipe && (
                    <ModalImportarPacote
                        projetoId={projeto.id}
                        equipeId={projeto.equipe.id}
                        pacotes={projeto.equipe.pacotes}
                        colunas={colunasDoKanban}
                        usuarios={usuarios} // <--- SÓ ADICIONAR ESTA LINHA AQUI
                    />
                )}
                
                <ModalConfigProjeto 
                    projeto={projeto} 
                    colunasDisponiveis={bibliotecaColunas} 
                    colunasDoProjeto={projeto.colunas}     
                />
                <ModalCriarTarefa 
                    projetoId={projeto.id}
                    colunas={colunasDoKanban} 
                    usuarios={usuarios}
                />
            </>
          )}
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO */}
      <div className="flex-1 overflow-hidden p-8">
        
        {colunasDoKanban.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-xl bg-surface/50">
            <h3 className="text-lg font-medium text-foreground">Projeto Vazio</h3>
            <p className="text-text-muted mb-4">Este projeto ainda não tem etapas definidas.</p>
            <p className="text-sm text-indigo-400">Clique na engrenagem ⚙️ acima para adicionar colunas.</p>
          </div>
        ) : (
          <MinhasTarefasView
            tarefasIniciais={tarefas as unknown as import('@/types').TarefaComRelacoes[]}
            listaProjetos={[projeto] as unknown as import('@/types').ProjetoComColunas[]} 
            usuarios={usuarios}
            colunas={colunasDoKanban} 
            agrupamento="COLUNA"
            esconderFiltroProjeto={true}
            enableCalendarNavigation={true}
            usuarioLogadoId={usuarioLogado.id}
            defaultStatusFilter="PENDENTE"
          />
        )}

      </div>
    </div>
  )
}