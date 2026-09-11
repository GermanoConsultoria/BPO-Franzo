import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import AuthenticatedLayout from '@/components/AuthenticatedLayout'
import { PERMISSOES, temPermissao } from '@/lib/permissoes'
import { getUsuarioLogado } from '@/lib/usuario-logado'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Home() {
  const usuario = await getUsuarioLogado()
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
