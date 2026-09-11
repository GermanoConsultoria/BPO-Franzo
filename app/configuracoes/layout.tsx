import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import { PERMISSOES, temPermissao } from '@/lib/permissoes'
import { getUsuarioLogado } from '@/lib/usuario-logado'

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const usuario = await getUsuarioLogado()

  if (!usuario) redirect('/login')
  const acessaConfiguracoes = usuario.role === 'ADMIN'
    || temPermissao(usuario, PERMISSOES.GERENCIAR_USUARIOS)
    || temPermissao(usuario, PERMISSOES.GERENCIAR_EQUIPES)
  if (!acessaConfiguracoes) redirect('/')

  const minhasEquipes = (usuario.role === 'ADMIN')
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
