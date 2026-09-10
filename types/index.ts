// =============================================================================
// ENUMS
// Espelham exatamente os enums do schema Prisma
// =============================================================================

export type Recorrencia = 'NAO' | 'DIARIAMENTE' | 'SEMANALMENTE' | 'MENSALMENTE'

export type CampoAlterado =
  | 'CRIACAO'
  | 'TITULO'
  | 'DESCRICAO'
  | 'DT_VENCIMENTO'
  | 'PRIORIDADE'
  | 'DIFICULDADE'
  | 'COLUNA'
  | 'CONCLUSAO'
  | 'REABERTURA'
  | 'RESPONSAVEL'
  | 'ANEXO_REMOVIDO'

export type StatusProjeto = 'EM_ANDAMENTO' | 'PAUSADO' | 'CONCLUIDO' | 'AGUARDANDO_ONBLOX' | 'AGUARDANDO_CLIENTE' | 'RISCO_CHURN'

export type RoleUsuario = 'OWNER' | 'MANAGER' | 'MEMBER' | 'USER'

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
  cargo: string | null
  imagem: string | null
  role: RoleUsuario
  workspace_id: string
  dt_insert: Date | string
  dt_update: Date | string
  permissoes_sidebar: string | null
  // senha nunca é incluída nos tipos de retorno
}

export type Equipe = {
  id: string
  nome: string
  descricao: string | null
  workspace_id: string
  dt_insert: Date | string
  dt_update: Date | string
}

export type Coluna = {
  id: string
  nome: string
  cor: string | null
  workspace_id: string
  equipe_id: string | null
  dt_insert: Date | string
  dt_update: Date | string
}

export type Projeto = {
  id: string
  nome: string
  descricao: string | null
  workspace_id: string
  usuario_id: string
  equipe_id: string | null
  ativo: boolean
  imagem: string | null
  dt_insert: Date | string
  dt_update: Date | string
  dt_acesso: Date | string
  // Campos Onblox
  fase_macro: string | null
  erp: string | null
  dados_acesso: string | null
  status_cliente: StatusProjeto | null
  pacote_onblox: string | null
  tipo_integracao: string | null
  motivo_pausa: string | null
  // Integração GitHub
  conta_github_id: string | null
  github_repo_id: number | null
  github_repo_full_name: string | null
}

export type ContaGithub = {
  id: string
  equipe_id: string
  github_login: string
  github_account_id: number
  criado_por_id: string | null
  dt_insert: Date | string
  // access_token nunca é incluído nos tipos de retorno ao cliente
}

/** Repositório GitHub disponível para vincular a um projeto, já com a conta de origem */
export type RepositorioGithubOpcao = {
  contaId: string
  contaLogin: string
  repoId: number
  fullName: string
}

/** Commit do repositório do projeto, disponível para vincular a uma tarefa */
export type CommitGithubOpcao = {
  sha: string
  message: string
  author: string
  url: string
}

export type Tarefa = {
  id: string
  titulo: string
  descricao: string | null
  usuario_id: string | null
  coluna_id: string | null
  projeto_id: string
  concluida: boolean
  prioridade_id: number
  dificuldade_id: number
  recorrencia: Recorrencia
  dias_recorrencia: string | null
  dia_mes_recorrencia: number | null
  ordem: number
  dt_vencimento: Date | string | null
  dt_conclusao: Date | string | null
  dt_insert: Date | string
  dt_update: Date | string
  github_commit_sha: string | null
}

export type OpcaoPrioridade = {
  id: number
  nome: string
}

export type OpcaoDificuldade = {
  id: number
  nome: string
}

export type Comentario = {
  id: string
  texto: string
  tarefa_id: string
  usuario_id: string
  imagemUrl: string | null
  dt_insert: Date | string
  dt_update: Date | string
}

export type HistoricoTarefa = {
  id: string
  tarefa_id: string
  usuario_id: string | null
  campo: CampoAlterado
  valor_antigo: string | null
  valor_novo: string | null
  dt_evento: Date | string
}

export type Anexo = {
  id: string
  nome: string
  url: string
  key: string
  tamanho: number
  dt_upload: Date | string
  tarefa_id: string
}

export type EquipeUsuario = {
  equipe_id: string
  usuario_id: string
  role: string
  dt_insert: Date | string
}

export type PacoteTemplate = {
  id: string
  nome: string
  descricao: string | null
  equipe_id: string
  dt_insert: Date | string
  dt_update: Date | string
}

export type TarefaTemplate = {
  id: string
  titulo: string
  descricao: string | null
  dificuldade_id: number
  prioridade_id: number
  pacote_id: string
  ordem: number
  dt_insert: Date | string
}

// =============================================================================
// TIPOS COM RELAÇÕES
// Refletem o que o Prisma retorna com include — o que os componentes consomem
// =============================================================================

/** Versão mínima de Usuário para exibição em listas, avatares e selects */
export type UsuarioBasico = Pick<Usuario, 'id' | 'nome' | 'imagem' | 'cargo'>

/** Versão mínima de Projeto para referência em tarefas */
export type ProjetoBasico = Pick<Projeto, 'id' | 'nome' | 'equipe_id'>

/** Versão mínima de Coluna para referência em tarefas e selects */
export type ColunaBasica = Pick<Coluna, 'id' | 'nome' | 'cor'> & {
  data_inicio?: Date | string | null
  data_fim?: Date | string | null
}

/** Comentário com o usuário que o criou */
export type ComentarioComUsuario = Comentario & {
  usuario: UsuarioBasico
}

/** Histórico com o usuário que fez a ação */
export type HistoricoComUsuario = HistoricoTarefa & {
  usuario: UsuarioBasico | null
}

/** Tarefa completa com todas as relações — usada no Kanban, Modal, Calendário */
export type TarefaComRelacoes = Tarefa & {
  usuario: UsuarioBasico | null
  coluna: ColunaBasica | null
  projeto: ProjetoBasico
  prioridade: OpcaoPrioridade
  dificuldade: OpcaoDificuldade
  comentarios: ComentarioComUsuario[]
  anexos: Anexo[]
  historico?: HistoricoComUsuario[]
}

/** Relação Projeto↔Coluna com ordem, como vem do banco */
export type ProjetoColunaComColuna = {
  projeto_id: string
  coluna_id: string
  ordem: number
  coluna: ColunaBasica
}

/** Projeto com suas colunas incluídas — usado no Kanban e Modal de config */
export type ProjetoComColunas = Projeto & {
  colunas: ProjetoColunaComColuna[]
}

/** Projeto com colunas e tarefas — página do Kanban */
export type ProjetoCompleto = ProjetoComColunas & {
  tarefas: TarefaComRelacoes[]
}

/** Membro de equipe com dados do usuário */
export type EquipeUsuarioComUsuario = EquipeUsuario & {
  usuario: Usuario
}

/** Equipe com membros */
export type EquipeComMembros = Equipe & {
  membros: EquipeUsuarioComUsuario[]
}

/** Template com suas tarefas */
export type PacoteComTarefas = PacoteTemplate & {
  tarefas: TarefaTemplate[]
}

/** Equipe com membros e pacotes — página de configurações */
export type EquipeCompleta = EquipeComMembros & {
  pacotes: PacoteComTarefas[]
  contasGithub: ContaGithub[]
}

// =============================================================================
// TIPOS DE PROPS — REUTILIZADOS ENTRE COMPONENTES
// =============================================================================

/** Props mínimas para o seletor de equipe na topbar */
export type EquipeBasica = Pick<Equipe, 'id' | 'nome'>

/** Props mínimas para projetos recentes na sidebar */
export type ProjetoRecente = Pick<Projeto, 'id' | 'nome' | 'imagem'>

// =============================================================================
// RETORNO PADRÃO DAS SERVER ACTIONS
// =============================================================================

export type ActionResult<T = undefined> =
  | { success: true; data: T; warning?: string }
  | { success: false; error: string }

// =============================================================================
// MÓDULO FINANCEIRO
// =============================================================================

export type TipoLancamento = 'DESPESA' | 'RECEITA'

export type StatusLancamento = 'PENDENTE' | 'PAGO' | 'CANCELADO'

export type PlanoContas = {
  id: string
  workspace_id: string
  tipo: TipoLancamento
  nome: string
  ativo: boolean
  dt_insert: Date | string
  dt_update: Date | string
}

export type LancamentoFinanceiro = {
  id: string
  workspace_id: string
  tipo: TipoLancamento
  descricao: string
  beneficiario: string | null
  valor: number
  dt_vencimento: Date | string
  dt_pagamento: Date | string | null
  numero_documento: string | null
  plano_contas_id: string
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

export type LancamentoComRelacoes = LancamentoFinanceiro & {
  plano_contas: PlanoContas
  anexos: AnexoFinanceiro[]
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
  lancamentos_por_conta: Record<string, { descricao: string; valor: number; status: string; dt_vencimento: Date }[]>  // ← adicionar esta linha
}
