export const PERMISSOES = {
  VER_TODOS_CLIENTES: 'ver_todos_clientes',
  GERENCIAR_USUARIOS: 'gerenciar_usuarios',
  GERENCIAR_EQUIPES: 'gerenciar_equipes',
  EDITAR_LANCAMENTOS: 'editar_lancamentos',
} as const

export type PermissaoChave = typeof PERMISSOES[keyof typeof PERMISSOES]

export const PERMISSOES_LABEL: Record<PermissaoChave, string> = {
  ver_todos_clientes: 'Ver todos os clientes',
  gerenciar_usuarios: 'Gerenciar usuários',
  gerenciar_equipes: 'Gerenciar equipes/clientes',
  editar_lancamentos: 'Editar lançamentos financeiros',
}

type UsuarioComPermissoes = { role: string; permissoes?: { chave: string }[] } | null | undefined

/** ADMIN sempre passa. CLIENTE nunca tem permissão elevada. PERSONALIZADO
 * depende da tabela usuario_permissao (é preciso ter buscado o usuário com
 * `include: { permissoes: true }` antes de chamar esta função). */
export function temPermissao(usuario: UsuarioComPermissoes, chave: PermissaoChave): boolean {
  if (!usuario) return false
  if (usuario.role === 'ADMIN') return true
  if (usuario.role !== 'PERSONALIZADO') return false
  return (usuario.permissoes ?? []).some(p => p.chave === chave)
}
