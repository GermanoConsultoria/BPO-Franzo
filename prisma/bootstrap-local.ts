import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const workspace = await prisma.workspace.create({
    data: { nome: 'BPO' },
  })

  const senhaHash = await bcrypt.hash('123456', 10)

  const admin = await prisma.usuario.create({
    data: {
      nome: 'Admin',
      email: 'admin@local.test',
      senha: senhaHash,
      cargo: 'Administrador',
      role: 'ADMIN',
      ativo: true,
      workspace_id: workspace.id,
    },
  })

  const equipe = await prisma.equipe.create({
    data: {
      nome: 'Cliente Exemplo',
      descricao: 'Financeiro criado no bootstrap local',
      workspace_id: workspace.id,
    },
  })

  await prisma.equipeUsuario.create({
    data: { equipe_id: equipe.id, usuario_id: admin.id, role: 'LIDER' },
  })

  await prisma.planoContas.createMany({
    data: [
      { equipe_id: equipe.id, tipo: 'RECEITA', nome: 'Mensalidade' },
      { equipe_id: equipe.id, tipo: 'DESPESA', nome: 'Despesas Gerais' },
    ],
  })

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
