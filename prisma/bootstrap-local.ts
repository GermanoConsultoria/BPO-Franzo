import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const prioridades = ['Muito Baixa', 'Baixa', 'Média', 'Alta', 'Urgente']
  const dificuldades = ['Muito Fácil', 'Fácil', 'Média', 'Difícil', 'Muito Difícil']

  for (let i = 0; i < 5; i++) {
    await prisma.opcaoPrioridade.upsert({
      where: { id: i + 1 },
      update: { nome: prioridades[i] },
      create: { id: i + 1, nome: prioridades[i] },
    })
    await prisma.opcaoDificuldade.upsert({
      where: { id: i + 1 },
      update: { nome: dificuldades[i] },
      create: { id: i + 1, nome: dificuldades[i] },
    })
  }

  const workspace = await prisma.workspace.create({
    data: { nome: 'Germano Consultoria' },
  })

  const senhaHash = await bcrypt.hash('123456', 10)
  const usuario = await prisma.usuario.create({
    data: {
      nome: 'Admin Germano',
      email: 'admin@local.test',
      senha: senhaHash,
      cargo: 'Administrador',
      role: 'OWNER',
      ativo: true,
      workspace_id: workspace.id,
    },
  })

  const equipe = await prisma.equipe.create({
    data: {
      nome: 'Equipe Principal',
      descricao: 'Equipe criada no bootstrap local',
      workspace_id: workspace.id,
    },
  })

  await prisma.equipeUsuario.create({
    data: { equipe_id: equipe.id, usuario_id: usuario.id, role: 'OWNER' },
  })

  // Colunas padrao do Kanban
  const coresColunas = [
    { nome: 'A Fazer', cor: '#6366f1' },
    { nome: 'Em Andamento', cor: '#f59e0b' },
    { nome: 'Concluído', cor: '#10b981' },
  ]
  for (const c of coresColunas) {
    await prisma.coluna.create({
      data: { nome: c.nome, cor: c.cor, workspace_id: workspace.id, equipe_id: equipe.id },
    })
  }

  console.log('Bootstrap OK')
  console.log('  Login: admin@local.test')
  console.log('  Senha: 123456')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
