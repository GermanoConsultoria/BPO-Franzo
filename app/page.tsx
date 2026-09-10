import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import { PERMISSOES, temPermissao } from '@/lib/permissoes'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Home() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  const usuario = await prisma.usuario.findUnique({
    where: { email: session.user.email },
    include: { equipes: { include: { equipe: true } }, permissoes: true }
  })
  if (!usuario) redirect('/login')

  const veTodosOsClientes = usuario.role === 'ADMIN' || temPermissao(usuario, PERMISSOES.VER_TODOS_CLIENTES)

  const minhasEquipes = veTodosOsClientes
    ? await prisma.equipe.findMany({ where: { workspace_id: usuario.workspace_id }, orderBy: { nome: 'asc' } })
    : usuario.equipes.map(e => e.equipe)

  if (minhasEquipes.length === 0) {
    return (
      <AuthenticatedLayout
        usuario={usuario as unknown as import('@/types').Usuario}
        equipeAtual={null}
        minhasEquipes={[]}
      >
        <div className="p-8 max-w-xl mx-auto text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Nenhum cliente cadastrado</h1>
          <p className="text-gray-500 text-sm">
            {usuario.role === 'ADMIN'
              ? 'Cadastre um cliente em Configurações → Equipes para começar.'
              : 'Ainda não há nenhum financeiro liberado para o seu usuário.'}
          </p>
        </div>
      </AuthenticatedLayout>
    )
  }

  redirect(`/equipe/${minhasEquipes[0].id}/financeiro/balancete`)
}
