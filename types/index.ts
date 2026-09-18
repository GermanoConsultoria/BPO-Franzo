// =============================================================================
// ENUMS
// Espelham exatamente os enums do schema Prisma
// =============================================================================

export type Recorrencia = 'NAO' | 'DIARIAMENTE' | 'SEMANALMENTE' | 'MENSALMENTE'

/** ADMIN opera o sistema e tem acesso total. PERSONALIZADO tem permissões
 * individuais (ver UsuarioPermissao / lib/permissoes.ts). CLIENTE só vê o
 * financeiro da própria equipe. */
export type RoleUsuario = 'ADMIN' | 'CLIENTE' | 'PERSONALIZADO'

// =============================================================================
// TIPOS BASE
// Espelham os campos das tabelas do banco, sem relações
// =============================================================================

export type Workspace = {
  id: string
  nome: string
  dt_insert: Date | string
}

export type Usuario = {
  id: string
  nome: string
  email: string
  ativo: boolean
  cnpj: string | null
  imagem: string | null
  role: RoleUsuario
  workspace_id: string
  dt_insert: Date | string
  dt_update: Date | string
  // senha nunca é incluída nos tipos de retorno
  // só presente quando a query faz include: { permissoes: true }
  permissoes?: UsuarioPermissao[]
}

/** Permissão individual de um usuário com role = PERSONALIZADO */
export type UsuarioPermissao = {
  usuario_id: string
  chave: string
  dt_insert: Date | string
}

/** Cada "equipe" é o financeiro isolado de um cliente */
export type Equipe = {
  id: string
  nome: string
  descricao: string | null
  whatsapp: string | null
  workspace_id: string
  dt_insert: Date | string
  dt_update: Date | string
}

export type EquipeUsuario = {
  equipe_id: string
  usuario_id: string
  role: string
  dt_insert: Date | string
}

// =============================================================================
// TIPOS COM RELAÇÕES
// Refletem o que o Prisma retorna com include — o que os componentes consomem
// =============================================================================

/** Versão mínima de Usuário para exibição em listas e selects */
export type UsuarioBasico = Pick<Usuario, 'id' | 'nome' | 'imagem' | 'cnpj'>

/** Membro de equipe com dados do usuário */
export type EquipeUsuarioComUsuario = EquipeUsuario & {
  usuario: Usuario
}

/** Equipe (cliente) com membros — página de configurações */
export type EquipeComMembros = Equipe & {
  membros: EquipeUsuarioComUsuario[]
}

// =============================================================================
// TIPOS DE PROPS — REUTILIZADOS ENTRE COMPONENTES
// =============================================================================

/** Props mínimas para o seletor de cliente (equipe) na topbar */
export type EquipeBasica = Pick<Equipe, 'id' | 'nome'>

// =============================================================================
// RETORNO PADRÃO DAS SERVER ACTIONS
// =============================================================================

export type ActionResult<T = undefined> =
  | { success: true; data: T; warning?: string }
  | { success: false; error: string }

// =============================================================================
// MÓDULO FINANCEIRO — cada registro pertence a uma "equipe" (cliente)
// =============================================================================

export type TipoLancamento = 'DESPESA' | 'RECEITA'

export type StatusLancamento = 'PENDENTE' | 'PAGO' | 'CANCELADO'

export type PlanoContas = {
  id: string
  equipe_id: string
  tipo: TipoLancamento
  nome: string
  ativo: boolean
  dt_insert: Date | string
  dt_update: Date | string
}

/** Conta bancária do cliente. Dimensão separada de receitas/despesas — usada
 * para identificar por qual banco um lançamento transita. */
export type Banco = {
  id: string
  equipe_id: string
  nome: string
  ativo: boolean
  dt_insert: Date | string
  dt_update: Date | string
}

export type LancamentoFinanceiro = {
  id: string
  equipe_id: string
  tipo: TipoLancamento
  descricao: string
  beneficiario: string | null
  valor: number
  dt_vencimento: Date | string
  dt_pagamento: Date | string | null
  numero_documento: string | null
  plano_contas_id: string
  banco_id: string | null
  status: StatusLancamento
  recorrencia: Recorrencia
  numero_parcelas: number | null
  parcela_atual: number | null
  grupo_parcela_id: string | null
  lancamento_pai_id: string | null
  dt_insert: Date | string
  dt_update: Date | string
}

export type AnexoFinanceiro = {
  id: string
  lancamento_id: string
  nome: string
  url: string
  key: string
  tamanho: number
  dt_upload: Date | string
}

export type PagamentoParcial = {
  id: string
  lancamento_id: string
  valor: number
  dt_pagamento: Date | string
  observacao: string | null
  dt_insert: Date | string
}

export type LancamentoComRelacoes = LancamentoFinanceiro & {
  plano_contas: PlanoContas
  banco: Banco | null
  anexos: AnexoFinanceiro[]
  parciais: PagamentoParcial[]
  parcelas?: LancamentoFinanceiro[]
}

export type ItemBalanceteConta = {
  plano_contas_id: string
  nome: string
  total: number
}

export type DadosMensaisBalancete = {
  mes: string
  receitas: number
  despesas: number
  lucro: number
}

export type ContratoEncerrando = {
  id: string
  descricao: string
  valor: number
  dt_ultima_parcela: string
  dias_restantes: number
  parcelas_restantes: number
  total_parcelas: number
}

export type Balancete = {
  receitas: number
  despesas: number
  lucro: number
  saldo: number
  a_receber: number
  a_pagar: number
  receitas_por_conta: ItemBalanceteConta[]
  despesas_por_conta: ItemBalanceteConta[]
  dados_mensais: DadosMensaisBalancete[]
  contratos_encerrando: ContratoEncerrando[]
  lancamentos_por_conta: Record<string, { descricao: string; valor: number; status: string; dt_vencimento: Date }[]>
}
