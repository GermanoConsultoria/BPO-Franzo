// prisma/reset-asana.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Iniciando limpeza dos dados do Asana...')

  // 1. Identificar Projetos Importados
  // O script anterior colocou "Importado do Asana" na descrição. Vamos usar isso.
  const projetosAsana = await prisma.projeto.findMany({
    where: {
      descricao: {
        contains: 'Importado do Asana'
      }
    }
  })

  if (projetosAsana.length === 0) {
    console.log('✅ Nenhum projeto do Asana encontrado para excluir.')
    return
  }

  const projetosIds = projetosAsana.map(p => p.id)
  console.log(`⚠️  Encontrados ${projetosIds.length} projetos para excluir.`)

  // 2. Excluir Tarefas vinculadas a esses projetos
  const tarefasDeletadas = await prisma.tarefa.deleteMany({
    where: {
      projeto_id: { in: projetosIds }
    }
  })
  console.log(`- ${tarefasDeletadas.count} tarefas excluídas.`)

  // 3. Excluir Vínculos de Colunas (Tabela Pivot)
  await prisma.projetoColuna.deleteMany({
    where: {
      projeto_id: { in: projetosIds }
    }
  })
  console.log(`- Vínculos de colunas removidos.`)

  // 4. Excluir os Projetos
  await prisma.projeto.deleteMany({
    where: {
      id: { in: projetosIds }
    }
  })
  console.log(`- ${projetosIds.length} projetos excluídos.`)

  // Opcional: Limpar a coluna "ASANA" se estiver vazia
  // (Deixei comentado caso você queira manter a coluna)
  /*
  const colunaAsana = await prisma.coluna.findFirst({ where: { nome: 'ASANA' } })
  if (colunaAsana) {
      const tarefasRestantes = await prisma.tarefa.count({ where: { coluna_id: colunaAsana.id } })
      if (tarefasRestantes === 0) {
          await prisma.coluna.delete({ where: { id: colunaAsana.id } })
          console.log('- Coluna "ASANA" removida pois estava vazia.')
      }
  }
  */

  console.log('\n✨ Limpeza concluída! Agora você pode criar os usuários e importar novamente.')
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())