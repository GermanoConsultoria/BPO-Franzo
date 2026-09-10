import { prisma } from '@/lib/prisma'
import BotaoNovoProjeto from '@/components/BotaoNovoProjeto'
import CardProjeto from '@/components/CardProjeto'

export const dynamic = 'force-dynamic'

export default async function TodosProjetosPage({ params }: { params: Promise<{ equipeId: string }> }) {
  // Pega o ID da equipe direto da URL
  const { equipeId } = await params

  const equipe = await prisma.equipe.findUnique({
    where: { id: equipeId }
  })

  if (!equipe) {
    return <div className="p-12 text-center text-gray-500">Equipe não encontrada.</div>
  }

  const projetos = await prisma.projeto.findMany({
    where: {
        equipe_id: equipeId // <--- A MÁGICA DO FILTRO ACONTECE AQUI
    },
    orderBy: [
        { ativo: 'desc' }, 
        { nome: 'asc' }
    ],
    include: {
      _count: { select: { tarefas: true } }
    }
  })

  return (
    <div className="p-4 lg:p-12 max-w-7xl mx-auto min-h-screen">
      <header className="mb-4 lg:mb-8 border-b border-border pb-3 lg:pb-6 flex flex-col md:flex-row md:items-center justify-between gap-2 lg:gap-4">
        <div>
          <h1 className="text-xl lg:text-3xl font-bold text-foreground">Projetos da Equipe {equipe.nome}</h1>
          <p className="text-xs lg:text-base text-gray-500 mt-1 lg:mt-2">Lista completa de {projetos.length} projetos.</p>
        </div>
        {/* Passamos o equipeId para o botão saber onde vai criar o projeto novo */}
        <BotaoNovoProjeto equipeId={equipeId} />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
        {projetos.map(projeto => (
            <CardProjeto key={projeto.id} projeto={projeto} />
        ))}
      </div>
    </div>
  )
}