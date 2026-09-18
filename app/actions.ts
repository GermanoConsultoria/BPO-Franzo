'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { signIn } from '@/auth'
import { getUsuarioLogado } from '@/lib/usuario-logado'
import { AuthError } from 'next-auth'
import bcrypt from 'bcryptjs'
import { UTApi } from "uploadthing/server"
import type { ActionResult } from '@/types'
import { z } from 'zod'
import crypto from 'crypto'
import { PERMISSOES, temPermissao } from '@/lib/permissoes'

const schemaCriarUsuario = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(100),
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
  cnpj: z.string().max(18).optional(),
})

const schemaEditarUsuario = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(100),
  email: z.string().email('E-mail inválido.'),
  cnpj: z.string().max(18).optional(),
})

// Papéis de acesso do BPO: ADMIN (nós, operamos o sistema, acesso total) >
// PERSONALIZADO (permissões individuais, ver lib/permissoes.ts) > CLIENTE
// (usuário final, só vê o financeiro da própria equipe/cliente).
type UsuarioAcesso = { id: string; role: string; workspace_id: string; permissoes: { chave: string }[] }

async function podeAcessarEquipe(usuario: UsuarioAcesso, equipeId: string): Promise<boolean> {
  if (usuario.role === 'ADMIN' || temPermissao(usuario, PERMISSOES.VER_TODOS_CLIENTES)) {
    const equipe = await prisma.equipe.findFirst({ where: { id: equipeId, workspace_id: usuario.workspace_id } })
    return !!equipe
  }
  const membro = await prisma.equipeUsuario.findFirst({ where: { equipe_id: equipeId, usuario_id: usuario.id } })
  return !!membro
}

/** CLIENTE mantém o comportamento atual (edita o financeiro da própria
 * equipe). PERSONALIZADO precisa da permissão explícita. */
function podeEditarLancamentos(usuario: UsuarioAcesso): boolean {
  return usuario.role !== 'PERSONALIZADO' || temPermissao(usuario, PERMISSOES.EDITAR_LANCAMENTOS)
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', {
        ...Object.fromEntries(formData),
        redirectTo: '/',
    })
  } catch (error) {
    if ((error as Error).message.includes('NEXT_REDIRECT')) {
        throw error;
    }
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin': return 'Credenciais inválidas. Verifique e-mail e senha.'
        case 'CallbackRouteError': return 'Erro ao tentar login. Usuário inativo?'
        default: return 'Algo deu errado. Tente novamente.'
      }
    }
    throw error
  }
}

// --- GESTÃO DE USUÁRIOS (ADMIN) ---

export async function getUsuariosDoWorkspace() {
  const solicitante = await getUsuarioLogado()

  if (!solicitante || !temPermissao(solicitante, PERMISSOES.GERENCIAR_USUARIOS)) return []

  return await prisma.usuario.findMany({
    where: { workspace_id: solicitante.workspace_id },
    orderBy: { nome: 'asc' },
    select: {
      id: true, nome: true, email: true, dt_insert: true, ativo: true,
      cnpj: true, dt_update: true, imagem: true, role: true, workspace_id: true,
      permissoes: true,
    }
  })
}

export async function criarNovoUsuario(formData: FormData) {
  const solicitante = await getUsuarioLogado()

  if (!solicitante || !temPermissao(solicitante, PERMISSOES.GERENCIAR_USUARIOS)) {
    return { erro: 'Você não tem permissão para criar usuários.' }
  }

  const nome = formData.get('nome') as string
  const email = formData.get('email') as string
  const senha = formData.get('senha') as string
  const cnpj = formData.get('cnpj') as string
  let role = formData.get('role') as string
  if (role !== 'PERSONALIZADO' && role !== 'ADMIN') role = 'CLIENTE'

  const chavesValidas = Object.values(PERMISSOES) as string[]
  const permissoesSelecionadas = role === 'PERSONALIZADO'
    ? formData.getAll('permissoes').filter((c): c is string => typeof c === 'string' && chavesValidas.includes(c))
    : []

  const validacao = schemaCriarUsuario.safeParse({ nome, email, senha, cnpj })
  if (!validacao.success) {
    return { erro: validacao.error.issues[0].message }
  }

  const existe = await prisma.usuario.findUnique({ where: { email } })
  if (existe) return { erro: 'E-mail já cadastrado.' }

  const senhaHash = await bcrypt.hash(senha, 10)

  const novoUsuario = await prisma.usuario.create({
    data: {
      nome,
      email,
      senha: senhaHash,
      cnpj: cnpj || undefined,
      role,
      ativo: true,
      workspace_id: solicitante.workspace_id!
    }
  })

  if (permissoesSelecionadas.length > 0) {
    await prisma.usuarioPermissao.createMany({
      data: permissoesSelecionadas.map(chave => ({ usuario_id: novoUsuario.id, chave }))
    })
  }

  revalidatePath('/configuracoes/usuarios')
  return { sucesso: true }
}

export async function atualizarUsuario(formData: FormData) {
  const solicitante = await getUsuarioLogado()
  if (!solicitante || !temPermissao(solicitante, PERMISSOES.GERENCIAR_USUARIOS)) {
    return { erro: 'Você não tem permissão para editar usuários.' }
  }

  const usuarioId = formData.get('usuarioId') as string
  const usuarioAlvo = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (!usuarioAlvo) return { erro: 'Usuário não encontrado.' }

  const nome = formData.get('nome') as string
  const email = formData.get('email') as string
  const cnpj = formData.get('cnpj') as string
  let role = formData.get('role') as string
  if (role !== 'PERSONALIZADO' && role !== 'ADMIN') role = 'CLIENTE'
  // Role ADMIN só pode ser mantido, nunca concedido por este formulário
  // (o modal só envia "ADMIN" quando o alvo já é admin).
  if (role === 'ADMIN' && usuarioAlvo.role !== 'ADMIN') role = 'CLIENTE'

  const validacao = schemaEditarUsuario.safeParse({ nome, email, cnpj })
  if (!validacao.success) {
    return { erro: validacao.error.issues[0].message }
  }

  if (email !== usuarioAlvo.email) {
    const existe = await prisma.usuario.findUnique({ where: { email } })
    if (existe) return { erro: 'E-mail já cadastrado.' }
  }

  const chavesValidas = Object.values(PERMISSOES) as string[]
  const permissoesSelecionadas = role === 'PERSONALIZADO'
    ? formData.getAll('permissoes').filter((c): c is string => typeof c === 'string' && chavesValidas.includes(c))
    : []

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: usuarioId },
      data: { nome, email, cnpj: cnpj || null, role },
    }),
    prisma.usuarioPermissao.deleteMany({ where: { usuario_id: usuarioId } }),
    ...(permissoesSelecionadas.length > 0
      ? [prisma.usuarioPermissao.createMany({ data: permissoesSelecionadas.map(chave => ({ usuario_id: usuarioId, chave })) })]
      : []),
  ])

  revalidatePath('/configuracoes/usuarios')
  return { sucesso: true }
}

export async function toggleStatusUsuario(usuarioAlvoId: string) {
  const solicitante = await getUsuarioLogado()
  if (!solicitante || !temPermissao(solicitante, PERMISSOES.GERENCIAR_USUARIOS)) return

  const alvo = await prisma.usuario.findUnique({ where: { id: usuarioAlvoId } })
  if (!alvo) return

  if (alvo.id === solicitante.id) return
  if (alvo.role === 'ADMIN') return

  await prisma.usuario.update({
    where: { id: usuarioAlvoId },
    data: { ativo: !alvo.ativo }
  })

  revalidatePath('/configuracoes/usuarios')
}

export async function alterarSenhaUsuario(usuarioId: string, novaSenha: string) {
  const solicitante = await getUsuarioLogado()
  if (!temPermissao(solicitante, PERMISSOES.GERENCIAR_USUARIOS)) {
      throw new Error("Você não tem permissão para alterar senhas.")
  }

  if (!novaSenha || novaSenha.trim() === '') {
      throw new Error("A senha não pode ser vazia.")
  }

  const hashedPassword = await bcrypt.hash(novaSenha, 10)

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { senha: hashedPassword }
  })

  revalidatePath('/configuracoes/usuarios')
  return { success: true }
}

export async function atualizarPermissoesUsuario(usuarioId: string, chaves: string[]): Promise<ActionResult<undefined>> {
  const solicitante = await getUsuarioLogado()
  if (!solicitante || !temPermissao(solicitante, PERMISSOES.GERENCIAR_USUARIOS)) {
    return { success: false, error: 'Você não tem permissão para gerenciar usuários.' }
  }

  const usuarioAlvo = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (!usuarioAlvo) return { success: false, error: 'Usuário não encontrado.' }
  if (usuarioAlvo.role !== 'PERSONALIZADO') {
    return { success: false, error: 'Só é possível ajustar permissões de usuários com papel Personalizado.' }
  }

  const chavesValidas = Object.values(PERMISSOES) as string[]
  const chavesFiltradas = chaves.filter(c => chavesValidas.includes(c))

  await prisma.$transaction([
    prisma.usuarioPermissao.deleteMany({ where: { usuario_id: usuarioId } }),
    prisma.usuarioPermissao.createMany({
      data: chavesFiltradas.map(chave => ({ usuario_id: usuarioId, chave }))
    })
  ])

  revalidatePath('/configuracoes/usuarios')
  return { success: true, data: undefined }
}

// --- GESTÃO DE CLIENTES (cadastro de "equipes", cada uma é o financeiro de um cliente) ---

export async function criarEquipe(formData: FormData) {
  const usuarioLogado = await getUsuarioLogado()
  if (!usuarioLogado || !temPermissao(usuarioLogado, PERMISSOES.GERENCIAR_EQUIPES)) return

  const nome = formData.get('nome') as string
  if (!nome) return

  const novaEquipe = await prisma.equipe.create({
      data: {
          nome,
          workspace_id: usuarioLogado.workspace_id!
      }
  })

  await prisma.equipeUsuario.create({
      data: {
          equipe_id: novaEquipe.id,
          usuario_id: usuarioLogado.id,
          role: 'LIDER'
      }
  })

  revalidatePath('/configuracoes/equipes')
  revalidatePath('/', 'layout')
}

export async function atualizarNomeEquipe(equipeId: string, novoNome: string) {
  const usuarioLogado = await getUsuarioLogado()
  if (!usuarioLogado || !temPermissao(usuarioLogado, PERMISSOES.GERENCIAR_EQUIPES)) return

  if (!equipeId || !novoNome) return
  await prisma.equipe.update({
      where: { id: equipeId },
      data: { nome: novoNome }
  })
  revalidatePath('/configuracoes/equipes')
  revalidatePath('/', 'layout')
}

export async function adicionarMembroEquipe(formData: FormData) {
  const usuarioLogado = await getUsuarioLogado()
  if (!usuarioLogado || !temPermissao(usuarioLogado, PERMISSOES.GERENCIAR_EQUIPES)) return

  const equipeId = formData.get('equipeId') as string
  const usuarioId = formData.get('usuarioId') as string

  if (!equipeId || !usuarioId) return

  const equipe = await prisma.equipe.findFirst({
    where: { id: equipeId, workspace_id: usuarioLogado.workspace_id }
  })
  if (!equipe) return

  const existe = await prisma.equipeUsuario.findFirst({
      where: { equipe_id: equipeId, usuario_id: usuarioId }
  })

  if (!existe) {
      await prisma.equipeUsuario.create({
          data: { equipe_id: equipeId, usuario_id: usuarioId, role: 'MEMBER' }
      })
  }
  revalidatePath(`/configuracoes/equipes/${equipeId}`)
}

export async function removerMembroEquipe(formData: FormData) {
  const usuarioLogado = await getUsuarioLogado()
  if (!usuarioLogado || !temPermissao(usuarioLogado, PERMISSOES.GERENCIAR_EQUIPES)) return

  const equipeId = formData.get('equipeId') as string
  const usuarioId = formData.get('usuarioId') as string

  if (!equipeId || !usuarioId) return

  await prisma.equipeUsuario.deleteMany({
      where: { equipe_id: equipeId, usuario_id: usuarioId }
  })
  revalidatePath(`/configuracoes/equipes/${equipeId}`)
}

export async function excluirEquipe(equipeId: string) {
  const usuarioLogado = await getUsuarioLogado()
  if (!usuarioLogado || !temPermissao(usuarioLogado, PERMISSOES.GERENCIAR_EQUIPES)) return { erro: 'Você não tem permissão para excluir clientes.' }

  const planos = await prisma.planoContas.findMany({ where: { equipe_id: equipeId }, select: { id: true } })
  const planosIds = planos.map(p => p.id)

  if (planosIds.length > 0) {
    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: { plano_contas_id: { in: planosIds } },
      select: { id: true }
    })
    const lancamentosIds = lancamentos.map(l => l.id)
    if (lancamentosIds.length > 0) {
      await prisma.anexoFinanceiro.deleteMany({ where: { lancamento_id: { in: lancamentosIds } } })
      await prisma.lancamentoFinanceiro.deleteMany({ where: { id: { in: lancamentosIds } } })
    }
    await prisma.planoContas.deleteMany({ where: { equipe_id: equipeId } })
  }

  await prisma.equipeUsuario.deleteMany({ where: { equipe_id: equipeId } })
  await prisma.equipe.delete({ where: { id: equipeId } })

  revalidatePath('/configuracoes/equipes')
  revalidatePath('/', 'layout')

  return { sucesso: true }
}

// =============================================================================
// MÓDULO FINANCEIRO — cada "equipe" é o financeiro isolado de um cliente
// =============================================================================

// --- PLANO DE CONTAS ---

export async function criarPlanoContas(formData: FormData): Promise<ActionResult<import('@prisma/client').PlanoContas>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const equipeId = formData.get('equipeId') as string
    if (!equipeId || !(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) {
      return { success: false, error: 'Sem acesso a este cliente.' }
    }

    const nome = formData.get('nome') as string
    const tipo = formData.get('tipo') as 'DESPESA' | 'RECEITA'

    if (!nome?.trim()) return { success: false, error: 'Nome é obrigatório.' }
    if (!['DESPESA', 'RECEITA'].includes(tipo)) return { success: false, error: 'Tipo inválido.' }

    const conta = await prisma.planoContas.create({
      data: { equipe_id: equipeId, tipo, nome: nome.trim() }
    })

    revalidatePath(`/equipe/${equipeId}/financeiro/plano-contas`)
    return { success: true, data: conta }
  } catch {
    return { success: false, error: 'Erro ao criar conta.' }
  }
}

export async function editarPlanoContas(formData: FormData): Promise<ActionResult<import('@prisma/client').PlanoContas>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const equipeId = formData.get('equipeId') as string
    if (!equipeId || !(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) {
      return { success: false, error: 'Sem acesso a este cliente.' }
    }

    const id = formData.get('id') as string
    const nome = formData.get('nome') as string
    const tipo = formData.get('tipo') as 'DESPESA' | 'RECEITA'

    if (!nome?.trim()) return { success: false, error: 'Nome é obrigatório.' }

    const conta = await prisma.planoContas.findFirst({ where: { id, equipe_id: equipeId } })
    if (!conta) return { success: false, error: 'Conta não encontrada.' }

    const atualizada = await prisma.planoContas.update({
      where: { id },
      data: { nome: nome.trim(), tipo }
    })

    revalidatePath(`/equipe/${equipeId}/financeiro/plano-contas`)
    return { success: true, data: atualizada }
  } catch {
    return { success: false, error: 'Erro ao editar conta.' }
  }
}

export async function excluirPlanoContas(id: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const conta = await prisma.planoContas.findFirst({ where: { id, equipe_id: equipeId } })
    if (!conta) return { success: false, error: 'Conta não encontrada.' }

    const emUso = await prisma.lancamentoFinanceiro.count({ where: { plano_contas_id: id } })
    if (emUso > 0) return { success: false, error: 'Esta conta possui lançamentos vinculados e não pode ser excluída.' }

    await prisma.planoContas.delete({ where: { id } })

    revalidatePath(`/equipe/${equipeId}/financeiro/plano-contas`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir conta.' }
  }
}

export async function toggleAtivoPlanoContas(id: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const conta = await prisma.planoContas.findFirst({ where: { id, equipe_id: equipeId } })
    if (!conta) return { success: false, error: 'Conta não encontrada.' }

    await prisma.planoContas.update({ where: { id }, data: { ativo: !conta.ativo } })

    revalidatePath(`/equipe/${equipeId}/financeiro/plano-contas`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao alterar status da conta.' }
  }
}

// --- BANCOS ---

type TxClient = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

/** Aplica um movimento de dinheiro real (pagamento/recebimento ou o estorno
 * dele) no saldo atual de um banco, dentro de uma transação. Retorna o saldo
 * antes e depois do movimento, para registrar como "saldo anterior/atual" no
 * lançamento que originou o movimento. */
async function movimentarSaldoBanco(
  tx: TxClient,
  bancoId: string,
  tipo: 'RECEITA' | 'DESPESA',
  valor: number,
  sentido: 1 | -1,
): Promise<{ saldoAnterior: number; saldoAtual: number }> {
  const banco = await tx.banco.findUniqueOrThrow({ where: { id: bancoId } })
  const saldoAnterior = Number(banco.saldo_atual)
  const delta = (tipo === 'RECEITA' ? 1 : -1) * sentido * valor
  const saldoAtual = Math.round((saldoAnterior + delta) * 100) / 100

  await tx.banco.update({ where: { id: bancoId }, data: { saldo_atual: saldoAtual } })
  return { saldoAnterior, saldoAtual }
}

/** Estorna do banco vinculado todo o dinheiro que este lançamento já
 * movimentou (valor cheio se PAGO, soma dos parciais caso contrário) — usado
 * antes de excluir um lançamento/parcela que já teve movimentação real, para
 * o saldo do banco não ficar desatualizado com um registro que deixou de
 * existir. */
async function reverterSaldoBancoDoLancamento(
  tx: TxClient,
  lancamento: { banco_id: string | null; tipo: 'RECEITA' | 'DESPESA'; valor: unknown; status: string; parciais: { valor: unknown }[] },
) {
  if (!lancamento.banco_id) return
  const jaMovimentado = lancamento.status === 'PAGO'
    ? Number(lancamento.valor)
    : lancamento.parciais.reduce((s, p) => s + Number(p.valor), 0)
  if (jaMovimentado > 0) {
    await movimentarSaldoBanco(tx, lancamento.banco_id, lancamento.tipo, jaMovimentado, -1)
  }
}

export async function criarBanco(formData: FormData): Promise<ActionResult<import('@/types').Banco>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const equipeId = formData.get('equipeId') as string
    if (!equipeId || !(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) {
      return { success: false, error: 'Sem acesso a este cliente.' }
    }

    const nome = formData.get('nome') as string
    if (!nome?.trim()) return { success: false, error: 'Nome é obrigatório.' }

    const saldoInicialStr = (formData.get('saldo_inicial') as string) || '0'
    const saldoInicial = parseFloat(saldoInicialStr.replace(',', '.'))
    if (isNaN(saldoInicial)) return { success: false, error: 'Saldo inicial inválido.' }

    const banco = await prisma.banco.create({
      data: { equipe_id: equipeId, nome: nome.trim(), saldo_inicial: saldoInicial, saldo_atual: saldoInicial }
    })

    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: { ...banco, saldo_inicial: Number(banco.saldo_inicial), saldo_atual: Number(banco.saldo_atual) } }
  } catch {
    return { success: false, error: 'Erro ao criar banco.' }
  }
}

/** Só permite renomear — saldo_inicial não é editável após a criação, pois
 * saldo_atual já pode ter se afastado dele por movimentações reais. */
export async function editarBanco(formData: FormData): Promise<ActionResult<import('@/types').Banco>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const equipeId = formData.get('equipeId') as string
    if (!equipeId || !(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) {
      return { success: false, error: 'Sem acesso a este cliente.' }
    }

    const id = formData.get('id') as string
    const nome = formData.get('nome') as string
    if (!nome?.trim()) return { success: false, error: 'Nome é obrigatório.' }

    const banco = await prisma.banco.findFirst({ where: { id, equipe_id: equipeId } })
    if (!banco) return { success: false, error: 'Banco não encontrado.' }

    const atualizado = await prisma.banco.update({
      where: { id },
      data: { nome: nome.trim() }
    })

    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: { ...atualizado, saldo_inicial: Number(atualizado.saldo_inicial), saldo_atual: Number(atualizado.saldo_atual) } }
  } catch {
    return { success: false, error: 'Erro ao editar banco.' }
  }
}

export async function excluirBanco(id: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const banco = await prisma.banco.findFirst({ where: { id, equipe_id: equipeId } })
    if (!banco) return { success: false, error: 'Banco não encontrado.' }

    const emUso = await prisma.lancamentoFinanceiro.count({ where: { banco_id: id } })
    if (emUso > 0) return { success: false, error: 'Este banco possui lançamentos vinculados e não pode ser excluído.' }

    await prisma.banco.delete({ where: { id } })

    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir banco.' }
  }
}

export async function toggleAtivoBanco(id: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const banco = await prisma.banco.findFirst({ where: { id, equipe_id: equipeId } })
    if (!banco) return { success: false, error: 'Banco não encontrado.' }

    await prisma.banco.update({ where: { id }, data: { ativo: !banco.ativo } })

    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao alterar status do banco.' }
  }
}

/** Extrato do banco: lançamentos que já movimentaram o saldo (saldo_atual
 * preenchido), em ordem cronológica pela data do movimento. */
export async function getExtratoBanco(
  bancoId: string,
  equipeId: string,
  filtros?: { dataInicio?: string; dataFim?: string },
) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return []
  if (!(await podeAcessarEquipe(usuario, equipeId))) return []

  const where: import('@prisma/client').Prisma.LancamentoFinanceiroWhereInput = {
    equipe_id: equipeId,
    banco_id: bancoId,
    saldo_atual: { not: null },
  }

  if (filtros?.dataInicio && filtros?.dataFim) {
    where.dt_pagamento = {
      gte: new Date(`${filtros.dataInicio}T00:00:00.000Z`),
      lte: new Date(`${filtros.dataFim}T23:59:59.999Z`),
    }
  }

  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where,
    orderBy: { dt_pagamento: 'asc' },
    select: {
      id: true, descricao: true, tipo: true, valor: true,
      dt_pagamento: true, saldo_anterior: true, saldo_atual: true,
    },
  })

  return lancamentos.map(l => ({
    ...l,
    valor: Number(l.valor),
    saldo_anterior: l.saldo_anterior !== null ? Number(l.saldo_anterior) : null,
    saldo_atual: l.saldo_atual !== null ? Number(l.saldo_atual) : null,
  }))
}

// --- LANÇAMENTOS FINANCEIROS ---

export async function criarLancamento(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const equipeId = formData.get('equipeId') as string
    if (!equipeId || !(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) {
      return { success: false, error: 'Sem acesso a este cliente.' }
    }

    const tipo = formData.get('tipo') as 'DESPESA' | 'RECEITA'
    const descricao = (formData.get('descricao') as string)?.trim()
    const beneficiario = (formData.get('beneficiario') as string)?.trim() || null
    const valorStr = formData.get('valor') as string
    const valor = parseFloat(valorStr.replace(',', '.'))
    const dt_vencimento = new Date(formData.get('dt_vencimento') as string)
    const numero_documento = (formData.get('numero_documento') as string)?.trim() || null
    const plano_contas_id = formData.get('plano_contas_id') as string
    const banco_id = (formData.get('banco_id') as string)?.trim() || null
    const recorrencia = (formData.get('recorrencia') as string || 'NAO') as import('@prisma/client').Recorrencia
    const numero_parcelas = parseInt(formData.get('numero_parcelas') as string) || 1

    if (!descricao) return { success: false, error: 'Descrição é obrigatória.' }
    if (isNaN(valor) || valor <= 0) return { success: false, error: 'Valor inválido.' }
    if (!plano_contas_id) return { success: false, error: 'Categoria é obrigatória.' }

    const conta = await prisma.planoContas.findFirst({ where: { id: plano_contas_id, equipe_id: equipeId } })
    if (!conta) return { success: false, error: 'Categoria não encontrada.' }

    if (banco_id) {
      const banco = await prisma.banco.findFirst({ where: { id: banco_id, equipe_id: equipeId } })
      if (!banco) return { success: false, error: 'Banco não encontrado.' }
    }

    if (numero_parcelas > 1) {
      const grupoParcela = crypto.randomUUID()

      for (let i = 1; i <= numero_parcelas; i++) {
        const dtParcela = new Date(dt_vencimento)
        dtParcela.setMonth(dtParcela.getMonth() + (i - 1))
        await prisma.lancamentoFinanceiro.create({
          data: {
            equipe_id: equipeId,
            tipo,
            descricao,
            beneficiario,
            valor,
            dt_vencimento: dtParcela,
            numero_documento,
            plano_contas_id,
            banco_id,
            recorrencia: 'NAO',
            numero_parcelas,
            parcela_atual: i,
            grupo_parcela_id: grupoParcela,
          }
        })
      }
    } else {
      await prisma.lancamentoFinanceiro.create({
        data: {
          equipe_id: equipeId,
          tipo,
          descricao,
          beneficiario,
          valor,
          dt_vencimento,
          numero_documento,
          plano_contas_id,
          banco_id,
          recorrencia,
        }
      })
    }

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/balancete`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao criar lançamento.' }
  }
}

export async function editarLancamento(formData: FormData): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const equipeId = formData.get('equipeId') as string
    if (!equipeId || !(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) {
      return { success: false, error: 'Sem acesso a este cliente.' }
    }

    const id = formData.get('id') as string
    const descricao = (formData.get('descricao') as string)?.trim()
    const beneficiario = (formData.get('beneficiario') as string)?.trim() || null
    const valorStr = formData.get('valor') as string
    const valor = parseFloat(valorStr.replace(',', '.'))
    const dt_vencimento = new Date(formData.get('dt_vencimento') as string)
    const numero_documento = (formData.get('numero_documento') as string)?.trim() || null
    const plano_contas_id = formData.get('plano_contas_id') as string
    const banco_id = (formData.get('banco_id') as string)?.trim() || null

    if (!descricao) return { success: false, error: 'Descrição é obrigatória.' }
    if (isNaN(valor) || valor <= 0) return { success: false, error: 'Valor inválido.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id, equipe_id: equipeId } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    if (banco_id) {
      const banco = await prisma.banco.findFirst({ where: { id: banco_id, equipe_id: equipeId } })
      if (!banco) return { success: false, error: 'Banco não encontrado.' }
    }

    // Valor e banco já movimentaram dinheiro real (pagamento ou parciais) —
    // não dá pra editá-los aqui sem reabrir a movimentação já feita. Ignora
    // só essas duas mudanças e mantém o resto da edição.
    const temMovimento = lancamento.status === 'PAGO'
      || (await prisma.pagamentoParcial.count({ where: { lancamento_id: id } })) > 0
    let valorFinal = valor
    let bancoIdFinal = banco_id
    let warning: string | undefined
    if (temMovimento && (valorFinal !== Number(lancamento.valor) || bancoIdFinal !== lancamento.banco_id)) {
      valorFinal = Number(lancamento.valor)
      bancoIdFinal = lancamento.banco_id
      warning = 'Valor e banco não podem ser alterados após pagamentos registrados — as demais alterações foram salvas.'
    }

    await prisma.lancamentoFinanceiro.update({
      where: { id },
      data: { descricao, beneficiario, valor: valorFinal, dt_vencimento, numero_documento, plano_contas_id, banco_id: bancoIdFinal }
    })

    const aplicarATodos = formData.get('aplicar_a_todos') === 'true'
    if (aplicarATodos && lancamento.grupo_parcela_id) {
      await prisma.lancamentoFinanceiro.updateMany({
        where: { grupo_parcela_id: lancamento.grupo_parcela_id, id: { not: id }, status: { not: 'PAGO' } },
        data: { descricao, beneficiario, valor: valorFinal, numero_documento, plano_contas_id, banco_id: bancoIdFinal },
      })
    }

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/balancete`)
    return { success: true, data: undefined, warning }
  } catch {
    return { success: false, error: 'Erro ao editar lançamento.' }
  }
}

export async function excluirGrupoParcelas(grupo_parcela_id: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const alvos = await prisma.lancamentoFinanceiro.findMany({
      where: { grupo_parcela_id, equipe_id: equipeId },
      include: { parciais: { select: { valor: true } } },
    })
    const idsArr = alvos.map(l => l.id)

    await prisma.$transaction(async (tx) => {
      for (const l of alvos) {
        await reverterSaldoBancoDoLancamento(tx, l)
      }
      await tx.anexoFinanceiro.deleteMany({ where: { lancamento_id: { in: idsArr } } })
      await tx.lancamentoFinanceiro.deleteMany({ where: { id: { in: idsArr } } })
    })

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/balancete`)
    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir grupo de parcelas.' }
  }
}

export async function excluirParcelasAPartirDesta(id: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id, equipe_id: equipeId },
      select: { grupo_parcela_id: true, parcela_atual: true },
    })
    if (!lancamento?.grupo_parcela_id || lancamento.parcela_atual == null) {
      return { success: false, error: 'Parcela inválida.' }
    }

    const alvos = await prisma.lancamentoFinanceiro.findMany({
      where: {
        grupo_parcela_id: lancamento.grupo_parcela_id,
        equipe_id: equipeId,
        parcela_atual: { gte: lancamento.parcela_atual },
        status: { not: 'PAGO' },
      },
      include: { parciais: { select: { valor: true } } },
    })
    const idsArr = alvos.map(l => l.id)

    await prisma.$transaction(async (tx) => {
      for (const l of alvos) {
        await reverterSaldoBancoDoLancamento(tx, l)
      }
      await tx.anexoFinanceiro.deleteMany({ where: { lancamento_id: { in: idsArr } } })
      await tx.lancamentoFinanceiro.deleteMany({ where: { id: { in: idsArr } } })
    })

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/balancete`)
    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir parcelas.' }
  }
}

export async function pagarLancamento(id: string, dt_pagamento: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id, equipe_id: equipeId },
      include: { parciais: { select: { valor: true } } },
    })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    const jaPago = lancamento.parciais.reduce((s, p) => s + Number(p.valor), 0)
    const restante = Math.round((Number(lancamento.valor) - jaPago) * 100) / 100

    if (lancamento.banco_id && restante > 0) {
      await prisma.$transaction(async (tx) => {
        const { saldoAnterior, saldoAtual } = await movimentarSaldoBanco(tx, lancamento.banco_id!, lancamento.tipo, restante, 1)
        await tx.lancamentoFinanceiro.update({
          where: { id },
          data: {
            status: 'PAGO',
            dt_pagamento: new Date(dt_pagamento),
            saldo_anterior: lancamento.saldo_anterior ?? saldoAnterior,
            saldo_atual: saldoAtual,
          }
        })
      })
    } else {
      await prisma.lancamentoFinanceiro.update({
        where: { id },
        data: { status: 'PAGO', dt_pagamento: new Date(dt_pagamento) }
      })
    }

    if (lancamento.recorrencia !== 'NAO') {
      const baseDate = new Date(lancamento.dt_vencimento)
      let proxData: Date

      if (lancamento.recorrencia === 'DIARIAMENTE') {
        proxData = new Date(baseDate)
        proxData.setDate(proxData.getDate() + 1)
      } else if (lancamento.recorrencia === 'SEMANALMENTE') {
        proxData = new Date(baseDate)
        proxData.setDate(proxData.getDate() + 7)
      } else {
        proxData = new Date(baseDate)
        proxData.setMonth(proxData.getMonth() + 1)
      }

      await prisma.lancamentoFinanceiro.create({
        data: {
          equipe_id: lancamento.equipe_id,
          tipo: lancamento.tipo,
          descricao: lancamento.descricao,
          beneficiario: lancamento.beneficiario,
          valor: lancamento.valor,
          dt_vencimento: proxData,
          numero_documento: lancamento.numero_documento,
          plano_contas_id: lancamento.plano_contas_id,
          banco_id: lancamento.banco_id,
          recorrencia: lancamento.recorrencia,
          status: 'PENDENTE',
          lancamento_pai_id: id,
        }
      })
    }

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/balancete`)
    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao registrar pagamento.' }
  }
}

/** Desfaz a quitação de um lançamento pago — volta para PENDENTE e estorna
 * do banco só o que essa quitação final moveu (parciais anteriores, se
 * houver, continuam registrados e valendo). Serve para corrigir um
 * pagamento/recebimento lançado errado. */
export async function estornarPagamento(id: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id, equipe_id: equipeId },
      include: { parciais: { select: { valor: true } } },
    })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }
    if (lancamento.status !== 'PAGO') return { success: false, error: 'Só é possível estornar um lançamento pago.' }

    const jaPago = lancamento.parciais.reduce((s, p) => s + Number(p.valor), 0)
    const restante = Math.round((Number(lancamento.valor) - jaPago) * 100) / 100

    if (lancamento.banco_id && restante > 0) {
      await prisma.$transaction(async (tx) => {
        const { saldoAtual } = await movimentarSaldoBanco(tx, lancamento.banco_id!, lancamento.tipo, restante, -1)
        await tx.lancamentoFinanceiro.update({
          where: { id },
          data: {
            status: 'PENDENTE',
            dt_pagamento: null,
            ...(jaPago > 0 ? { saldo_atual: saldoAtual } : { saldo_anterior: null, saldo_atual: null }),
          },
        })
      })
    } else {
      await prisma.lancamentoFinanceiro.update({
        where: { id },
        data: { status: 'PENDENTE', dt_pagamento: null },
      })
    }

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/balancete`)
    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao estornar pagamento.' }
  }
}

export async function registrarPagamentoParcial(
  lancamentoId: string,
  valor: number,
  dt_pagamento: string,
  observacao: string | null,
  equipeId: string,
): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) {
      return { success: false, error: 'Sem acesso a este cliente.' }
    }

    if (typeof valor !== 'number' || isNaN(valor) || valor <= 0) {
      return { success: false, error: 'Valor do parcial inválido.' }
    }
    if (!dt_pagamento) return { success: false, error: 'Data do parcial é obrigatória.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id: lancamentoId, equipe_id: equipeId },
      include: { parciais: true },
    })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }
    if (lancamento.status === 'CANCELADO') return { success: false, error: 'Lançamento cancelado não aceita parciais.' }
    if (lancamento.status === 'PAGO') return { success: false, error: 'Lançamento já está quitado.' }

    const total = Number(lancamento.valor)
    const jaPago = lancamento.parciais.reduce((s, p) => s + Number(p.valor), 0)
    const restante = Math.round((total - jaPago) * 100) / 100
    const valorParcial = Math.round(valor * 100) / 100

    if (valorParcial > restante) {
      return { success: false, error: `O parcial (R$ ${valorParcial.toFixed(2)}) ultrapassa o saldo restante (R$ ${restante.toFixed(2)}).` }
    }

    const novoTotal = Math.round((jaPago + valorParcial) * 100) / 100
    const quitaAgora = novoTotal >= total

    if (lancamento.banco_id) {
      await prisma.$transaction(async (tx) => {
        const { saldoAnterior, saldoAtual } = await movimentarSaldoBanco(tx, lancamento.banco_id!, lancamento.tipo, valorParcial, 1)
        await tx.pagamentoParcial.create({
          data: {
            lancamento_id: lancamentoId,
            valor: valorParcial,
            dt_pagamento: new Date(dt_pagamento),
            observacao: observacao?.trim() || null,
          },
        })
        await tx.lancamentoFinanceiro.update({
          where: { id: lancamentoId },
          data: {
            saldo_anterior: lancamento.saldo_anterior ?? saldoAnterior,
            saldo_atual: saldoAtual,
            ...(quitaAgora ? { status: 'PAGO', dt_pagamento: new Date(dt_pagamento) } : {}),
          },
        })
      })
    } else {
      await prisma.pagamentoParcial.create({
        data: {
          lancamento_id: lancamentoId,
          valor: valorParcial,
          dt_pagamento: new Date(dt_pagamento),
          observacao: observacao?.trim() || null,
        },
      })

      if (quitaAgora) {
        await prisma.lancamentoFinanceiro.update({
          where: { id: lancamentoId },
          data: { status: 'PAGO', dt_pagamento: new Date(dt_pagamento) },
        })
      }
    }

    if (quitaAgora) {
      if (lancamento.recorrencia !== 'NAO') {
        const baseDate = new Date(lancamento.dt_vencimento)
        let proxData: Date
        if (lancamento.recorrencia === 'DIARIAMENTE') { proxData = new Date(baseDate); proxData.setDate(proxData.getDate() + 1) }
        else if (lancamento.recorrencia === 'SEMANALMENTE') { proxData = new Date(baseDate); proxData.setDate(proxData.getDate() + 7) }
        else { proxData = new Date(baseDate); proxData.setMonth(proxData.getMonth() + 1) }

        await prisma.lancamentoFinanceiro.create({
          data: {
            equipe_id: lancamento.equipe_id,
            tipo: lancamento.tipo,
            descricao: lancamento.descricao,
            beneficiario: lancamento.beneficiario,
            valor: lancamento.valor,
            dt_vencimento: proxData,
            numero_documento: lancamento.numero_documento,
            plano_contas_id: lancamento.plano_contas_id,
            banco_id: lancamento.banco_id,
            recorrencia: lancamento.recorrencia,
            status: 'PENDENTE',
            lancamento_pai_id: lancamentoId,
          }
        })
      }
    }

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/balancete`)
    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao registrar parcial.' }
  }
}

export async function excluirPagamentoParcial(parcialId: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) {
      return { success: false, error: 'Sem acesso a este cliente.' }
    }

    const parcial = await prisma.pagamentoParcial.findUnique({
      where: { id: parcialId },
      include: { lancamento: true },
    })
    if (!parcial || parcial.lancamento.equipe_id !== equipeId) {
      return { success: false, error: 'Parcial não encontrado.' }
    }

    if (parcial.lancamento.status !== 'PENDENTE') {
      return { success: false, error: 'Lançamento já quitado ou cancelado — não é possível remover parciais.' }
    }

    if (parcial.lancamento.banco_id) {
      await prisma.$transaction(async (tx) => {
        const { saldoAtual } = await movimentarSaldoBanco(tx, parcial.lancamento.banco_id!, parcial.lancamento.tipo, Number(parcial.valor), -1)
        await tx.pagamentoParcial.delete({ where: { id: parcialId } })

        const parciaisRestantes = await tx.pagamentoParcial.count({ where: { lancamento_id: parcial.lancamento_id } })
        await tx.lancamentoFinanceiro.update({
          where: { id: parcial.lancamento_id },
          data: parciaisRestantes === 0
            ? { saldo_anterior: null, saldo_atual: null }
            : { saldo_atual: saldoAtual },
        })
      })
    } else {
      await prisma.pagamentoParcial.delete({ where: { id: parcialId } })
    }

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/balancete`)
    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao remover parcial.' }
  }
}

export async function excluirEAvancarRecorrencia(id: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id, equipe_id: equipeId },
      include: { parciais: { select: { valor: true } } },
    })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    const baseDate = new Date(lancamento.dt_vencimento)
    let proxData: Date

    if (lancamento.recorrencia === 'DIARIAMENTE') {
      proxData = new Date(baseDate); proxData.setDate(proxData.getDate() + 1)
    } else if (lancamento.recorrencia === 'SEMANALMENTE') {
      proxData = new Date(baseDate); proxData.setDate(proxData.getDate() + 7)
    } else {
      proxData = new Date(baseDate); proxData.setMonth(proxData.getMonth() + 1)
    }

    await prisma.$transaction(async (tx) => {
      await reverterSaldoBancoDoLancamento(tx, lancamento)
      await tx.anexoFinanceiro.deleteMany({ where: { lancamento_id: id } })
      await tx.lancamentoFinanceiro.delete({ where: { id } })

      await tx.lancamentoFinanceiro.create({
        data: {
          equipe_id: lancamento.equipe_id,
          tipo: lancamento.tipo,
          descricao: lancamento.descricao,
          beneficiario: lancamento.beneficiario,
          valor: lancamento.valor,
          dt_vencimento: proxData,
          numero_documento: lancamento.numero_documento,
          plano_contas_id: lancamento.plano_contas_id,
          banco_id: lancamento.banco_id,
          recorrencia: lancamento.recorrencia,
          status: 'PENDENTE',
          lancamento_pai_id: id,
        }
      })
    })

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao processar lançamento.' }
  }
}

export async function cancelarLancamento(id: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id, equipe_id: equipeId } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }
    if (lancamento.status === 'PAGO') return { success: false, error: 'Lançamento já pago não pode ser cancelado.' }

    await prisma.lancamentoFinanceiro.update({ where: { id }, data: { status: 'CANCELADO' } })

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/balancete`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao cancelar lançamento.' }
  }
}

export async function excluirLancamento(id: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id, equipe_id: equipeId },
      include: { parciais: { select: { valor: true } } },
    })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.$transaction(async (tx) => {
      await reverterSaldoBancoDoLancamento(tx, lancamento)
      await tx.anexoFinanceiro.deleteMany({ where: { lancamento_id: id } })
      await tx.lancamentoFinanceiro.delete({ where: { id } })
    })

    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-pagar`)
    revalidatePath(`/equipe/${equipeId}/financeiro/contas-a-receber`)
    revalidatePath(`/equipe/${equipeId}/financeiro/balancete`)
    revalidatePath(`/equipe/${equipeId}/financeiro/bancos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir lançamento.' }
  }
}

export async function salvarAnexoFinanceiro(dados: {
  lancamento_id: string
  equipeId: string
  nome: string
  url: string
  key: string
  tamanho: number
}): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, dados.equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id: dados.lancamento_id, equipe_id: dados.equipeId }
    })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.anexoFinanceiro.create({
      data: {
        lancamento_id: dados.lancamento_id,
        nome: dados.nome,
        url: dados.url,
        key: dados.key,
        tamanho: dados.tamanho,
      }
    })
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao salvar anexo.' }
  }
}

export async function excluirAnexoFinanceiro(anexoId: string, equipeId: string): Promise<ActionResult<undefined>> {
  try {
    const usuario = await getUsuarioLogado()
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }
    if (!(await podeAcessarEquipe(usuario, equipeId)) || !podeEditarLancamentos(usuario)) return { success: false, error: 'Sem acesso a este cliente.' }

    const anexo = await prisma.anexoFinanceiro.findUnique({ where: { id: anexoId } })
    if (!anexo) return { success: false, error: 'Anexo não encontrado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id: anexo.lancamento_id, equipe_id: equipeId }
    })
    if (!lancamento) return { success: false, error: 'Sem permissão.' }

    const utapi = new UTApi()
    await utapi.deleteFiles([anexo.key])
    await prisma.anexoFinanceiro.delete({ where: { id: anexoId } })
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir anexo.' }
  }
}

export async function getLancamentosFinanceiros(
  equipeId: string,
  tipo: 'DESPESA' | 'RECEITA',
  filtros?: { dataInicio?: string; dataFim?: string; status?: string; plano_contas_id?: string; banco_id?: string }
) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return []
  if (!(await podeAcessarEquipe(usuario, equipeId))) return []

  const where: import('@prisma/client').Prisma.LancamentoFinanceiroWhereInput = {
    equipe_id: equipeId,
    tipo,
  }

  if (filtros?.dataInicio && filtros?.dataFim) {
    where.dt_vencimento = {
      gte: new Date(`${filtros.dataInicio}T00:00:00.000Z`),
      lte: new Date(`${filtros.dataFim}T23:59:59.999Z`),
    }
  }

  if (filtros?.status && filtros.status !== 'TODOS') {
    where.status = filtros.status as import('@prisma/client').StatusLancamento
  }

  if (filtros?.plano_contas_id && filtros.plano_contas_id !== 'TODAS') {
    where.plano_contas_id = filtros.plano_contas_id
  }

  if (filtros?.banco_id && filtros.banco_id !== 'TODOS') {
    where.banco_id = filtros.banco_id === 'SEM_BANCO' ? null : filtros.banco_id
  }

  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where,
    include: { plano_contas: true, banco: true, anexos: true, parciais: { orderBy: { dt_pagamento: 'asc' } } },
    orderBy: { dt_vencimento: 'asc' },
  })
  return lancamentos.map(l => ({
    ...l,
    valor: Number(l.valor),
    saldo_anterior: l.saldo_anterior !== null ? Number(l.saldo_anterior) : null,
    saldo_atual: l.saldo_atual !== null ? Number(l.saldo_atual) : null,
    banco: l.banco ? { ...l.banco, saldo_inicial: Number(l.banco.saldo_inicial), saldo_atual: Number(l.banco.saldo_atual) } : null,
    parciais: l.parciais.map(p => ({ ...p, valor: Number(p.valor) })),
  }))
}

export async function getBalancete(equipeId: string, dataInicio: string, dataFim: string) {
  const usuario = await getUsuarioLogado()
  if (!usuario) return null
  if (!(await podeAcessarEquipe(usuario, equipeId))) return null

  const inicio = new Date(dataInicio)
  const fim = new Date(dataFim)
  fim.setHours(23, 59, 59, 999)

  const [noPeriodo, todosPagos, parciaisPendentes] = await Promise.all([
    prisma.lancamentoFinanceiro.findMany({
      where: {
        equipe_id: equipeId,
        status: { not: 'CANCELADO' },
        dt_vencimento: { gte: inicio, lte: fim },
      },
      include: { plano_contas: true, parciais: { select: { valor: true } } }
    }),
    prisma.lancamentoFinanceiro.findMany({
      where: { equipe_id: equipeId, status: 'PAGO' },
      select: { tipo: true, valor: true }
    }),
    prisma.pagamentoParcial.findMany({
      where: { lancamento: { equipe_id: equipeId, status: 'PENDENTE' } },
      select: { valor: true, lancamento: { select: { tipo: true } } }
    }),
  ])

  const toNumber = (v: unknown) => typeof v === 'object' && v !== null && 'toNumber' in v ? (v as { toNumber: () => number }).toNumber() : Number(v)
  const somaParciais = (l: { parciais?: { valor: unknown }[] }) => (l.parciais ?? []).reduce((s, p) => s + toNumber(p.valor), 0)

  const receitas = noPeriodo.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + toNumber(l.valor), 0)
  const despesas = noPeriodo.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + toNumber(l.valor), 0)
  const lucro = receitas - despesas

  const parciaisRealizadosReceita = parciaisPendentes.filter(p => p.lancamento.tipo === 'RECEITA').reduce((s, p) => s + toNumber(p.valor), 0)
  const parciaisRealizadosDespesa = parciaisPendentes.filter(p => p.lancamento.tipo === 'DESPESA').reduce((s, p) => s + toNumber(p.valor), 0)

  const saldoReceitas = todosPagos.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + toNumber(l.valor), 0) + parciaisRealizadosReceita
  const saldoDespesas = todosPagos.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + toNumber(l.valor), 0) + parciaisRealizadosDespesa
  const saldo = saldoReceitas - saldoDespesas

  const a_receber = noPeriodo
    .filter(l => l.tipo === 'RECEITA' && l.status === 'PENDENTE')
    .reduce((s, l) => s + Math.max(0, toNumber(l.valor) - somaParciais(l)), 0)
  const a_pagar = noPeriodo
    .filter(l => l.tipo === 'DESPESA' && l.status === 'PENDENTE')
    .reduce((s, l) => s + Math.max(0, toNumber(l.valor) - somaParciais(l)), 0)

  const receitasPorConta = new Map<string, { nome: string; total: number }>()
  const despesasPorConta = new Map<string, { nome: string; total: number }>()

  for (const l of noPeriodo) {
    const mapa = l.tipo === 'RECEITA' ? receitasPorConta : despesasPorConta
    const atual = mapa.get(l.plano_contas_id) ?? { nome: l.plano_contas.nome, total: 0 }
    mapa.set(l.plano_contas_id, { nome: l.plano_contas.nome, total: atual.total + toNumber(l.valor) })
  }

  const mesesMap = new Map<string, { receitas: number; despesas: number }>()
  for (const l of noPeriodo) {
    const dt = new Date(l.dt_vencimento)
    const chave = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
    const atual = mesesMap.get(chave) ?? { receitas: 0, despesas: 0 }
    if (l.tipo === 'RECEITA') atual.receitas += toNumber(l.valor)
    else atual.despesas += toNumber(l.valor)
    mesesMap.set(chave, atual)
  }

  const mesesPtBR: Record<string, string> = {
    '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
    '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
  }

  const dados_mensais = Array.from(mesesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, v]) => {
      const [ano, mes] = chave.split('-')
      return {
        mes: `${mesesPtBR[mes]}/${ano.slice(2)}`,
        receitas: v.receitas,
        despesas: v.despesas,
        lucro: Math.max(0, v.receitas - v.despesas),
      }
    })

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const em90dias = new Date(hoje)
  em90dias.setDate(hoje.getDate() + 90)

  const parcelasReceita = await prisma.lancamentoFinanceiro.findMany({
    where: {
      equipe_id: equipeId,
      tipo: 'RECEITA',
      status: { not: 'CANCELADO' },
      grupo_parcela_id: { not: null },
    },
    select: {
      id: true,
      descricao: true,
      valor: true,
      dt_vencimento: true,
      grupo_parcela_id: true,
      parcela_atual: true,
      status: true,
    },
    orderBy: { dt_vencimento: 'asc' },
  })

  const gruposMap = new Map<string, typeof parcelasReceita>()
  for (const p of parcelasReceita) {
    if (!p.grupo_parcela_id) continue
    const grupo = gruposMap.get(p.grupo_parcela_id) ?? []
    grupo.push(p)
    gruposMap.set(p.grupo_parcela_id, grupo)
  }

  const contratos_encerrando = []
  for (const [, parcelas] of gruposMap) {
    const ultima = parcelas[parcelas.length - 1]
    const dtUltima = new Date(ultima.dt_vencimento)
    dtUltima.setHours(0, 0, 0, 0)
    if (dtUltima > em90dias) continue

    const diasRestantes = Math.ceil((dtUltima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
    if (diasRestantes < 0) continue

    const parcelasRestantes = parcelas.filter(p => p.status === 'PENDENTE').length
    const totalParcelas = parcelas.length

    contratos_encerrando.push({
      id: parcelas[0].id,
      descricao: parcelas[0].descricao ?? '',
      valor: toNumber(parcelas[0].valor),
      dt_ultima_parcela: dtUltima.toISOString().split('T')[0],
      dias_restantes: diasRestantes,
      parcelas_restantes: parcelasRestantes,
      total_parcelas: totalParcelas,
    })
  }

  contratos_encerrando.sort((a, b) => a.dias_restantes - b.dias_restantes)

  const lancamentosPorConta = new Map<string, { descricao: string; valor: number; status: string; dt_vencimento: Date }[]>()
  for (const l of noPeriodo) {
    const lista = lancamentosPorConta.get(l.plano_contas_id) ?? []
    lista.push({
      descricao: l.descricao ?? '(sem descrição)',
      valor: toNumber(l.valor),
      status: l.status,
      dt_vencimento: l.dt_vencimento,
    })
    lancamentosPorConta.set(l.plano_contas_id, lista)
  }

  return {
    receitas,
    despesas,
    lucro,
    saldo,
    a_receber,
    a_pagar,
    receitas_por_conta: Array.from(receitasPorConta.entries()).map(([plano_contas_id, v]) => ({ plano_contas_id, nome: v.nome, total: v.total })),
    despesas_por_conta: Array.from(despesasPorConta.entries()).map(([plano_contas_id, v]) => ({ plano_contas_id, nome: v.nome, total: v.total })),
    lancamentos_por_conta: Object.fromEntries(lancamentosPorConta),
    dados_mensais,
    contratos_encerrando,
  }
}
