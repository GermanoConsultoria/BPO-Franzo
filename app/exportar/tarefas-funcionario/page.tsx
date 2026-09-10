import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import ExportarTarefasFuncionarioClient from '@/components/ExportarTarefasFuncionarioClient'

export const dynamic = 'force-dynamic'

export default async function ExportarTarefasFuncionarioPage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  return <ExportarTarefasFuncionarioClient />
}
