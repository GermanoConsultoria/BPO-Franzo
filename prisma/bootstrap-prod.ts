import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const workspace = await prisma.workspace.create({
    data: { nome: 'BPO' },
  })

  const senhaHash = await bcrypt.hash('123456', 10)

  await prisma.usuario.create({
    data: {
      nome: 'Admin',
      email: 'admin@bpo.com',
      senha: senhaHash,
      role: 'ADMIN',
      ativo: true,
      workspace_id: workspace.id,
    },
  })

  console.log('Bootstrap OK')
  console.log('  Login: admin@bpo.com')
  console.log('  Senha: 123456')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
