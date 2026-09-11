import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import { PERMISSOES, temPermissao } from '@/lib/permissoes'
import { getUsuarioLogado } from '@/lib/usuario-logado'

export default async function EquipeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ equipeId: string }>
}) {
  const { equipeId } = await params
  const usuario = await getUsuarioLogado()

  if (!usuario) redirect('/login')

  // ADMIN e PERSONALIZADO com a permissão "ver todos os clientes" enxergam
  // todas as equipes do workspace. CLIENTE só enxerga as equipes das quais é
  // membro (normalmente uma só).
  const veTodosOsClientes = usuario.role === 'ADMIN' || temPermissao(usuario, PERMISSOES.VER_TODOS_CLIENTES)

  const minhasEquipes = veTodosOsClientes
    ? await prisma.equipe.findMany({ where: { workspace_id: usuario.workspace_id }, orderBy: { nome: 'asc' } })
    : usuario.equipes.map(e => e.equipe)

  const equipeAtual = minhasEquipes.find(e => e.id === equipeId) ?? null

  if (!equipeAtual) redirect('/')

  return (
    <AuthenticatedLayout
       usuario={usuario as unknown as import('@/types').Usuario}
       equipeAtual={equipeAtual}
       minhasEquipes={minhasEquipes}
    >
      {children}
    </AuthenticatedLayout>
  )
}
