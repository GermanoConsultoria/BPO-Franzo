import { getUsuariosDoWorkspace } from '@/app/actions' // Removi o import não usado do toggle
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import BotaoCriarUsuario from '@/components/ModalCriarUsuario'
// REMOVA: import BotaoStatusUsuario ...
import AcoesUsuario from '@/components/AcoesUsuario' // <--- IMPORTE O NOVO

export default async function GestaoUsuariosPage() {
  const session = await auth()
  
  // Melhoria de segurança: Validar se session existe antes
  if (!session?.user?.email) redirect('/')

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })

  if (usuarioLogado?.role !== 'OWNER') {
    redirect('/')
  }

  const usuarios = await getUsuariosDoWorkspace()

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen">
      <header className="mb-8 border-b border-border pb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Usuários</h1>
          <p className="text-text-muted mt-2">Gerencie quem tem acesso ao workspace.</p>
        </div>
        <BotaoCriarUsuario />
      </header>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-highlight border-b border-border">
            <tr>
              <th className="px-6 py-4 font-semibold text-text-muted">Nome</th>
              <th className="px-6 py-4 font-semibold text-text-muted">Cargo</th>
              <th className="px-6 py-4 font-semibold text-text-muted">Status</th>
              <th className="px-6 py-4 font-semibold text-text-muted text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-surface-highlight/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                      {u.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-foreground">{u.nome}</p>
                        <p className="text-xs text-text-muted">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-text-muted">{u.cargo || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    u.ativo 
                      ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                  }`}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                   {/* Aqui entra a lógica nova: 
                      Se NÃO for OWNER, mostra os botões. 
                      (Ou seja, o Owner pode editar todo mundo, menos outros Owners se existissem, 
                      ou a si mesmo se quiser travar essa lógica)
                   */}
                   {u.role !== 'OWNER' && (
                      <AcoesUsuario usuario={u} /> 
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}