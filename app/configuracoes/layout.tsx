import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import { PERMISSOES, temPermissao } from '@/lib/permissoes'

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuario = await prisma.usuario.findUnique({
    where: { email: session.user.email },
    include: { equipes: { include: { equipe: true } }, permissoes: true }
  })

  if (!usuario) redirect('/login')
  const acessaConfiguracoes = usuario.role === 'ADMIN'
    || temPermissao(usuario, PERMISSOES.GERENCIAR_USUARIOS)
    || temPermissao(usuario, PERMISSOES.GERENCIAR_EQUIPES)
  if (!acessaConfiguracoes) redirect('/')

  const minhasEquipes = (usuario.role === 'ADMIN' || temPermissao(usuario, PERMISSOES.VER_TODOS_CLIENTES))
    ? await prisma.equipe.findMany({ where: { workspace_id: usuario.workspace_id }, orderBy: { nome: 'asc' } })
    : usuario.equipes.map(e => e.equipe)

  return (
    <AuthenticatedLayout
       usuario={usuario as unknown as import('@/types').Usuario}
       equipeAtual={minhasEquipes[0] ?? null}
       minhasEquipes={minhasEquipes}
    >
      {children}
    </AuthenticatedLayout>
  )
}
