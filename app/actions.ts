'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth, signIn } from '@/auth'
import { AuthError } from 'next-auth'
import bcrypt from 'bcryptjs'
import { Recorrencia, CampoAlterado, Prisma } from '@prisma/client'
import { UTApi } from "uploadthing/server";
import type { ActionResult, RepositorioGithubOpcao, CommitGithubOpcao } from '@/types'
import { z } from 'zod'
import crypto from 'crypto'
import { listUserRepos, createWebhook, deleteWebhook, listRepoCommits, getAppUrl } from '@/lib/github'

// --- SCHEMAS DE VALIDAÇÃO ---

const schemaCriarTarefa = z.object({
  titulo: z.string().min(1, 'Título é obrigatório.').max(200, 'Título muito longo.'),
  projeto_id: z.string().min(1, 'Projeto é obrigatório.'),
  usuario_id: z.string().nullable().optional(),
  descricao: z.string().max(5000, 'Descrição muito longa.').optional().nullable(),
  prioridade_id: z.number().int().min(1).max(5),
  dificuldade_id: z.number().int().min(1).max(5),
})

const schemaCriarProjeto = z.object({
  nome: z.string().min(1, 'Nome é obrigatório.').max(200, 'Nome muito longo.'),
  descricao: z.string().max(2000, 'Descrição muito longa.').optional(),
})

const schemaCriarUsuario = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(100),
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
  cargo: z.string().max(100).optional(),
})

// Helper: calcula a próxima data de vencimento para tarefas recorrentes
function calcularProximaData(
  recorrencia: Recorrencia,
  dtVencimento: Date,
  diasRecorrencia?: string | null,
  diaMesRecorrencia?: number | null
): Date {
  const dias = diasRecorrencia
    ? diasRecorrencia.split(',').map(Number).filter(n => n >= 0 && n <= 6)
    : []

  if (recorrencia === 'MENSALMENTE') {
    const novaData = new Date(dtVencimento)
    novaData.setMonth(novaData.getMonth() + 1)
    if (diaMesRecorrencia) {
      const diasNoMes = new Date(novaData.getFullYear(), novaData.getMonth() + 1, 0).getDate()
      novaData.setDate(Math.min(diaMesRecorrencia, diasNoMes))
    }
    return novaData
  }

  if (recorrencia === 'SEMANALMENTE' && dias.length === 0) {
    const novaData = new Date(dtVencimento)
    novaData.setDate(novaData.getDate() + 7)
    return novaData
  }

  if (recorrencia === 'DIARIAMENTE' && dias.length === 0) {
    const novaData = new Date(dtVencimento)
    novaData.setDate(novaData.getDate() + 1)
    return novaData
  }

  // Com dias selecionados: avança pelo calendário encontrando o próximo dia da lista
  // Para SEMANALMENTE: começa buscando a partir de +7 dias
  // Para DIARIAMENTE: começa buscando a partir de amanhã
  const base = new Date(dtVencimento)
  base.setDate(base.getDate() + (recorrencia === 'SEMANALMENTE' ? 7 : 1))
  for (let i = 0; i < 7; i++) {
    if (dias.includes(base.getDay())) return base
    base.setDate(base.getDate() + 1)
  }
  return base
}

const utapi = new UTApi();

// --- AUTENTICAÇÃO ---
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

// --- NOVO: Alternar Status do Projeto (Arquivar/Desarquivar) ---
export async function toggleStatusProjeto(projetoId: string) {
  const session = await auth()
  if (!session?.user?.email) return

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado) return

  // Valida que o projeto pertence ao workspace do usuário antes de alterar
  const projeto = await prisma.projeto.findFirst({
    where: { id: projetoId, workspace_id: usuarioLogado.workspace_id }
  })
  if (!projeto) return

  await prisma.projeto.update({
    where: { id: projetoId },
    data: { ativo: !projeto.ativo }
  })

  revalidatePath('/')
  revalidatePath('/projetos')
  revalidatePath(`/projeto/${projetoId}`)
  revalidatePath('/minhas-tarefas')
  revalidatePath('/sprint')
}

// --- TAREFAS ---

interface CriarTarefaDTO {
  titulo: string
  descricao: string
  dt_vencimento: Date | null
  projeto_id: string
  coluna_id?: string
  usuario_id: string | null
  prioridade_id: number
  dificuldade_id: number
  recorrencia?: Recorrencia
  dias_recorrencia?: string | null
  dia_mes_recorrencia?: number | null
  github_commit_sha?: string | null
  concluida?: boolean
}

export async function criarTarefa(data: CriarTarefaDTO): Promise<ActionResult<{ id: string }>> {
  const validacao = schemaCriarTarefa.safeParse(data)
  if (!validacao.success) {
    return { success: false, error: validacao.error.issues[0].message }
  }

  try {
    let colunaId = data.coluna_id

    if (!colunaId) {
       const primeiraColuna = await prisma.projetoColuna.findFirst({
          where: { projeto_id: data.projeto_id },
          orderBy: { ordem: 'asc' }
       })
       if (primeiraColuna) colunaId = primeiraColuna.coluna_id
    }

    const concluidaPorCommit = !!data.github_commit_sha || !!data.concluida

    const novaTarefa = await prisma.tarefa.create({
      data: {
        titulo: data.titulo.toUpperCase(),
        descricao: data.descricao,
        prioridade_id: data.prioridade_id,
        dificuldade_id: data.dificuldade_id,
        concluida: concluidaPorCommit,
        dt_conclusao: concluidaPorCommit ? new Date() : null,
        coluna_id: colunaId || undefined,
        projeto_id: data.projeto_id,
        usuario_id: data.usuario_id || null,
        dt_vencimento: data.dt_vencimento,
        recorrencia: data.recorrencia || 'NAO',
        dias_recorrencia: data.dias_recorrencia ?? null,
        dia_mes_recorrencia: data.dia_mes_recorrencia ?? null,
        github_commit_sha: data.github_commit_sha || null,
      },
    })

    const session = await auth()
    if (session?.user?.email) {
        const userLog = await prisma.usuario.findUnique({ where: { email: session.user.email } })
        if (userLog) {
            await prisma.historicoTarefa.create({
                data: {
                    tarefa_id: novaTarefa.id,
                    usuario_id: userLog.id,
                    campo: 'CRIACAO',
                    valor_novo: novaTarefa.titulo
                }
            })
        }
    }

    revalidatePath(`/projeto/${data.projeto_id}`)
    revalidatePath(`/minhas-tarefas`)
    revalidatePath(`/sprint`)

    return { success: true, data: { id: novaTarefa.id } }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'Esse commit já está vinculado a outra tarefa deste projeto.' }
    }
    return { success: false, error: 'Erro ao criar tarefa. Tente novamente.' }
  }
}

interface AtualizarTarefaDTO {
  titulo: string
  descricao: string
  dt_vencimento: Date | null
  prioridade_id: number
  dificuldade_id: number
  usuario_id: string | null
  coluna_id?: string
  recorrencia?: Recorrencia
  dias_recorrencia?: string | null
  dia_mes_recorrencia?: number | null
}

export async function atualizarTarefa(
  tarefaId: string, 
  data: AtualizarTarefaDTO,
  projetoId: string
) {
  const session = await auth()
  if (!session?.user?.email) return

  const quemAlterou = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!quemAlterou) return

  const tarefaAntiga = await prisma.tarefa.findUnique({
      where: { id: tarefaId },
      include: { prioridade: true, dificuldade: true, usuario: true, coluna: true }
  })
  if (!tarefaAntiga) return

  await prisma.tarefa.update({
    where: { id: tarefaId },
    data: {
      titulo: data.titulo,
      descricao: data.descricao,
      prioridade_id: data.prioridade_id,
      dificuldade_id: data.dificuldade_id,
      usuario_id: data.usuario_id || null, 
      dt_vencimento: data.dt_vencimento,
      coluna_id: data.coluna_id,
      recorrencia: data.recorrencia,
      dias_recorrencia: data.dias_recorrencia ?? null,
      dia_mes_recorrencia: data.dia_mes_recorrencia ?? null,
    }
  })

  const logsParaCriar = []

  if (tarefaAntiga.titulo !== data.titulo) {
      logsParaCriar.push({ campo: CampoAlterado.TITULO, antigo: tarefaAntiga.titulo, novo: data.titulo })
  }
  if ((tarefaAntiga.descricao || '') !== (data.descricao || '')) {
      logsParaCriar.push({ campo: CampoAlterado.DESCRICAO, antigo: null, novo: 'Alterada' })
  }
  const dataAntigaISO = tarefaAntiga.dt_vencimento?.toISOString()
  const dataNovaISO = data.dt_vencimento?.toISOString()
  if (dataAntigaISO !== dataNovaISO) {
      logsParaCriar.push({ 
          campo: CampoAlterado.DT_VENCIMENTO, 
          antigo: tarefaAntiga.dt_vencimento ? tarefaAntiga.dt_vencimento.toLocaleDateString('pt-BR') : 'Sem data', 
          novo: data.dt_vencimento ? data.dt_vencimento.toLocaleDateString('pt-BR') : 'Sem data' 
      })
  }
  if (tarefaAntiga.prioridade_id !== data.prioridade_id) {
      logsParaCriar.push({ campo: CampoAlterado.PRIORIDADE, antigo: tarefaAntiga.prioridade.nome, novo: data.prioridade_id.toString() })
  }
  if (tarefaAntiga.usuario_id !== data.usuario_id) {
      logsParaCriar.push({ 
          campo: CampoAlterado.RESPONSAVEL, 
          antigo: tarefaAntiga.usuario?.nome || 'Sem dono', 
          novo: data.usuario_id ? 'Novo Responsável' : 'Sem dono' 
      })
  }
  if (tarefaAntiga.coluna_id !== data.coluna_id) {
     logsParaCriar.push({ 
         campo: CampoAlterado.COLUNA, 
         antigo: tarefaAntiga.coluna?.nome || 'N/A', 
         novo: 'Nova Etapa' 
     })
  }

  if (logsParaCriar.length > 0) {
      await prisma.historicoTarefa.createMany({
          data: logsParaCriar.map(log => ({
              tarefa_id: tarefaId,
              usuario_id: quemAlterou.id,
              campo: log.campo,
              valor_antigo: log.antigo,
              valor_novo: log.novo,
              dt_evento: new Date()
          }))
      })
  }

  revalidatePath(`/projeto/${projetoId}`)
  revalidatePath('/minhas-tarefas')
  revalidatePath('/')
}

export async function concluirTarefaComComentario(
  tarefaId: string,
  comentario: string,
  projetoId: string,
  usuarioId: string,
  commitSha?: string | null,
  commitMensagem?: string | null
): Promise<{ success: boolean; error?: string }> {
  const tarefaOriginal = await prisma.tarefa.findUnique({ where: { id: tarefaId } });

  try {
    await prisma.tarefa.update({
      where: { id: tarefaId },
      data: {
        concluida: true,
        dt_conclusao: new Date(),
        ...(commitSha ? { github_commit_sha: commitSha } : {}),
      }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'Esse commit já está vinculado a outra tarefa deste projeto.' }
    }
    return { success: false, error: 'Erro ao concluir a tarefa. Tente novamente.' }
  }

  if (commitSha) {
    await prisma.historicoTarefa.create({
      data: {
        tarefa_id: tarefaId,
        usuario_id: usuarioId,
        campo: 'CONCLUSAO',
        valor_novo: `Vinculada ao commit ${commitSha.slice(0, 7)}${commitMensagem ? ': ' + commitMensagem : ''}`,
      },
    })
  }

  await prisma.historicoTarefa.create({
      data: {
          tarefa_id: tarefaId,
          usuario_id: usuarioId,
          campo: 'CONCLUSAO',
          valor_novo: 'Comentário: ' + comentario
      }
  })

  if (comentario) {
    await prisma.comentario.create({
      data: { texto: `🏁 ENCERRAMENTO: ${comentario}`, tarefa_id: tarefaId, usuario_id: usuarioId }
    })
  }

  if (tarefaOriginal && tarefaOriginal.recorrencia !== 'NAO' && tarefaOriginal.dt_vencimento) {
      await prisma.tarefa.create({
          data: {
              titulo: tarefaOriginal.titulo,
              descricao: tarefaOriginal.descricao,
              projeto_id: tarefaOriginal.projeto_id,
              usuario_id: tarefaOriginal.usuario_id,
              prioridade_id: tarefaOriginal.prioridade_id,
              dificuldade_id: tarefaOriginal.dificuldade_id,
              coluna_id: tarefaOriginal.coluna_id,
              recorrencia: tarefaOriginal.recorrencia,
              dias_recorrencia: tarefaOriginal.dias_recorrencia,
              dia_mes_recorrencia: tarefaOriginal.dia_mes_recorrencia,
              dt_vencimento: calcularProximaData(tarefaOriginal.recorrencia, tarefaOriginal.dt_vencimento, tarefaOriginal.dias_recorrencia, tarefaOriginal.dia_mes_recorrencia),
              concluida: false
          }
      })
  }

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId }, select: { equipe_id: true } })
  if (projeto?.equipe_id) {
    revalidatePath(`/equipe/${projeto.equipe_id}/projeto/${projetoId}`)
    revalidatePath(`/equipe/${projeto.equipe_id}/minhas-tarefas`)
    revalidatePath(`/equipe/${projeto.equipe_id}/sprint`)
  }
  revalidatePath('/')
  return { success: true }
}

export async function adicionarComentario(tarefaId: string, texto: string, imagemUrl?: string | null) {
  const session = await auth()
  if (!session?.user?.email) return null
  
  const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!texto && !imagemUrl) return null // Impede comentário vazio
  if (!tarefaId || !usuario) return null

  const novoComentario = await prisma.comentario.create({
    data: { 
        texto: texto || "", // Garante string vazia se for só imagem
        tarefa_id: tarefaId, 
        usuario_id: usuario.id,
        imagemUrl: imagemUrl || null
    },
    include: { usuario: true }
  })
  
  revalidatePath('/')
  revalidatePath('/minhas-tarefas')
  revalidatePath('/sprint')
  
  return novoComentario
}

export async function excluirComentario(comentarioId: string, usuarioSolicitanteId: string) {
  'use server'

  const comentario = await prisma.comentario.findUnique({
    where: { id: comentarioId },
    include: { usuario: true }
  })

  if (!comentario) {
    throw new Error("Comentário não encontrado.")
  }

  const ehDono = comentario.usuario_id === usuarioSolicitanteId
  const ehAdmin = false 

  if (!ehDono && !ehAdmin) {
    throw new Error("Você não tem permissão para excluir este comentário.")
  }

  await prisma.comentario.delete({
    where: { id: comentarioId }
  })

  revalidatePath('/')
  return true
}

export async function editarComentario(comentarioId: string, novoTexto: string, usuarioSolicitanteId: string) {
  'use server'

  const comentario = await prisma.comentario.findUnique({
    where: { id: comentarioId }
  })

  if (!comentario) {
    throw new Error("Comentário não encontrado.")
  }

  if (comentario.usuario_id !== usuarioSolicitanteId) {
    throw new Error("Apenas o autor pode editar o comentário.")
  }

  await prisma.comentario.update({
    where: { id: comentarioId },
    data: { 
      texto: novoTexto,
      dt_update: new Date()
    }
  })

  revalidatePath('/')
  return true
}

export async function moverTarefaDeColuna(tarefaId: string, novaColunaId: string, projetoId: string) {
  const session = await auth()
  
  const tarefaAntiga = await prisma.tarefa.findUnique({ 
      where: { id: tarefaId },
      include: { coluna: true }
  })

  if (!tarefaAntiga) return

  if (tarefaAntiga.coluna_id !== novaColunaId) {
      
      await prisma.tarefa.update({
        where: { id: tarefaId },
        data: { coluna_id: novaColunaId }
      })

      if (session?.user?.email) {
          const quemMoveu = await prisma.usuario.findUnique({ where: { email: session.user.email } })
          if (quemMoveu) {
              const novaColunaNome = await prisma.coluna.findUnique({ where: { id: novaColunaId }})

              await prisma.historicoTarefa.create({
                  data: {
                      tarefa_id: tarefaId,
                      usuario_id: quemMoveu.id,
                      campo: 'COLUNA',
                      valor_antigo: tarefaAntiga.coluna?.nome || 'N/A',
                      valor_novo: novaColunaNome?.nome || 'Nova Coluna'
                  }
              })
          }
      }
  }

  revalidatePath(`/projeto/${projetoId}`)
}

export async function toggleConcluida(tarefaId: string, isConcluida: boolean, projetoId: string) {
  const session = await auth()

  const tarefaAtualizada = await prisma.tarefa.update({
    where: { id: tarefaId },
    data: { concluida: isConcluida, dt_conclusao: isConcluida ? new Date() : null }
  })

  if (session?.user?.email) {
      const quemFez = await prisma.usuario.findUnique({ where: { email: session.user.email } })
      if (quemFez) {
          await prisma.historicoTarefa.create({
              data: {
                  tarefa_id: tarefaId,
                  usuario_id: quemFez.id,
                  campo: isConcluida ? 'CONCLUSAO' : 'REABERTURA',
                  valor_novo: isConcluida ? 'Concluída via Checkbox' : 'Reaberta'
              }
          })
      }
  }

  if (isConcluida && tarefaAtualizada.recorrencia !== 'NAO' && tarefaAtualizada.dt_vencimento) {
      await prisma.tarefa.create({
          data: {
              titulo: tarefaAtualizada.titulo,
              descricao: tarefaAtualizada.descricao,
              projeto_id: tarefaAtualizada.projeto_id,
              usuario_id: tarefaAtualizada.usuario_id,
              prioridade_id: tarefaAtualizada.prioridade_id,
              dificuldade_id: tarefaAtualizada.dificuldade_id,
              coluna_id: tarefaAtualizada.coluna_id,
              recorrencia: tarefaAtualizada.recorrencia,
              dias_recorrencia: tarefaAtualizada.dias_recorrencia,
              dia_mes_recorrencia: tarefaAtualizada.dia_mes_recorrencia,
              dt_vencimento: calcularProximaData(tarefaAtualizada.recorrencia, tarefaAtualizada.dt_vencimento, tarefaAtualizada.dias_recorrencia, tarefaAtualizada.dia_mes_recorrencia),
              concluida: false
          }
      })
  }

  revalidatePath(`/projeto/${projetoId}`)
  revalidatePath(`/minhas-tarefas`)
  revalidatePath(`/sprint`)
}

export async function excluirTarefa(tarefaId: string, projetoId: string) {
  await prisma.comentario.deleteMany({ where: { tarefa_id: tarefaId } })
  await prisma.historicoTarefa.deleteMany({ where: { tarefa_id: tarefaId } })

  await prisma.tarefa.delete({ where: { id: tarefaId } })
  
  revalidatePath(`/projeto/${projetoId}`)
  revalidatePath(`/minhas-tarefas`)
  revalidatePath(`/sprint`)
  revalidatePath('/')
}

export async function atualizarDataTarefa(tarefaId: string, novaData: Date, projetoId: string) {
  const session = await auth()
  
  const tarefaAntiga = await prisma.tarefa.findUnique({ where: { id: tarefaId } })

  await prisma.tarefa.update({ where: { id: tarefaId }, data: { dt_vencimento: novaData } })

  if (session?.user?.email && tarefaAntiga) {
      const quemFez = await prisma.usuario.findUnique({ where: { email: session.user.email } })
      if (quemFez) {
          await prisma.historicoTarefa.create({
              data: {
                  tarefa_id: tarefaId,
                  usuario_id: quemFez.id,
                  campo: 'DT_VENCIMENTO',
                  valor_antigo: tarefaAntiga.dt_vencimento?.toLocaleDateString('pt-BR'),
                  valor_novo: novaData.toLocaleDateString('pt-BR')
              }
          })
      }
  }

  revalidatePath(`/projeto/${projetoId}`)
  revalidatePath(`/minhas-tarefas`)
  revalidatePath(`/sprint`)
}

// --- BUSCA COLUNAS DA EQUIPE ---
export async function getColunasDaEquipe(equipeId: string) {
  if (!equipeId) return []
  return await prisma.coluna.findMany({
    where: { equipe_id: equipeId },
    orderBy: { nome: 'asc' }
  })
}

// --- CRIA COLUNA VINCULADA À EQUIPE ---
export async function criarColuna(formData: FormData) {
  const session = await auth()
  if (!session?.user?.email) return

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado) return

  const nome = formData.get('nome') as string
  const equipeId = formData.get('equipeId') as string

  if (!nome || !equipeId) return

  // Valida que a equipe pertence ao workspace do usuário (nunca confiar no workspaceId do cliente)
  const equipe = await prisma.equipe.findFirst({
    where: { id: equipeId, workspace_id: usuarioLogado.workspace_id }
  })
  if (!equipe) return

  await prisma.coluna.create({
    data: {
      nome,
      workspace_id: usuarioLogado.workspace_id,
      equipe_id: equipeId
    }
  })
  revalidatePath(`/configuracoes/equipes/${equipeId}`)
  revalidatePath('/', 'layout')
}

export async function criarProjeto(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  const usuarioLogado = await prisma.usuario.findUnique({
      where: { email: session.user.email }
  })
  if (!usuarioLogado) return { success: false, error: 'Usuário não encontrado.' }

  const usuarioId = usuarioLogado.id
  const workspaceId = usuarioLogado.workspace_id
  // ---------------------------------------------------------

  const nome = formData.get('nome') as string
  const descricao = formData.get('descricao') as string
  const equipeId = formData.get('equipeId') as string
  const responsavelId = (formData.get('responsavelId') as string) || null

  // --- CAMPOS ONBLOX ---
  const isTemplateOnblox = formData.get('isTemplateOnblox') === 'true'
  
  // Inteligência do ERP (Se for Outro, pega o campo de texto)
  const erpSelect = formData.get('erpSelect') as string
  const erpPersonalizado = formData.get('erpPersonalizado') as string
  const erpFinal = erpSelect === 'Outro' ? erpPersonalizado : erpSelect

  const dadosAcesso = formData.get('dadosAcesso') as string
  const pacoteOnblox = formData.get('pacote_onblox') as string
  const tipoIntegracao = formData.get('tipo_integracao') as string
  
  // Status e Pausa
  const statusCliente = formData.get('status_cliente') as string || 'EM_ANDAMENTO'
  const motivoPausa = formData.get('motivo_pausa') as string
  const dataInicio = formData.get('data_inicio') as string
  const dataPrevistaEntrega = formData.get('data_prevista_entrega') as string

  // --- INTEGRAÇÃO GITHUB (opcional) ---
  const contaGithubId = (formData.get('contaGithubId') as string) || null
  const githubRepoId = formData.get('githubRepoId') ? Number(formData.get('githubRepoId')) : null
  const githubRepoFullName = (formData.get('githubRepoFullName') as string) || null

  const validacao = schemaCriarProjeto.safeParse({ nome, descricao })
  if (!validacao.success) {
    return { success: false, error: validacao.error.issues[0].message }
  }

  try {
  // 1. Cria o Projeto
  const projeto = await prisma.projeto.create({
      data: {
          nome,
          descricao,
          workspace_id: workspaceId,
          usuario_id: responsavelId || usuarioId,
          equipe_id: equipeId || null,
          data_inicio: dataInicio ? new Date(dataInicio) : null,
          data_prevista_entrega: dataPrevistaEntrega ? new Date(dataPrevistaEntrega) : null,
          ...(isTemplateOnblox && {
              fase_macro: 'MODELAGEM', 
              erp: erpFinal,
              dados_acesso: dadosAcesso,
              pacote_onblox: pacoteOnblox,
              tipo_integracao: tipoIntegracao,
              status_cliente: statusCliente,
              motivo_pausa: statusCliente === 'PAUSADO' ? motivoPausa : null
          })
      }
  })

  // 2. Vincula colunas selecionadas (projetos não-Onblox)
  if (!isTemplateOnblox) {
    const colunasIds = formData.getAll('colunas') as string[]
    if (colunasIds.length > 0) {
      await prisma.projetoColuna.createMany({
        data: colunasIds.map((colunaId, index) => ({
          projeto_id: projeto.id,
          coluna_id: colunaId,
          ordem: index + 1,
        }))
      })
    }
  }

  // 3. Se for uma Implantação Onblox, injeta as Colunas Padrão automaticamente!
  if (isTemplateOnblox && equipeId) {
      const colunasPadrao = [
          { nome: 'MODELAGEM', cor: '#3b82f6' }, // Azul
          { nome: 'CADASTROS BASICOS', cor: '#8b5cf6' }, // Roxo
          { nome: 'GO LIVE DE PROCESSOS', cor: '#10b981' }, // Verde
          { nome: 'ATIVIDADES DIA A DIA', cor: '#f59e0b' } // Laranja
      ]

      let ordem = 1;
      for (const col of colunasPadrao) {
          // A. Verifica se essa coluna já existe na biblioteca desta equipe
          let colunaDb = await prisma.coluna.findFirst({
              where: { nome: col.nome, equipe_id: equipeId, workspace_id: workspaceId }
          })

          // B. Se não existir, cadastra na biblioteca da equipe
          if (!colunaDb) {
              colunaDb = await prisma.coluna.create({
                  data: {
                      nome: col.nome,
                      cor: col.cor,
                      workspace_id: workspaceId,
                      equipe_id: equipeId
                  }
              })
          }

          // C. Vincula a coluna ao Projeto Novo na ordem correta
          await prisma.projetoColuna.create({
              data: {
                  projeto_id: projeto.id,
                  coluna_id: colunaDb.id,
                  ordem: ordem
              }
          })
          ordem++;
      }
  }

  // 4. Vincula o repositório GitHub selecionado (best-effort — não derruba a criação do projeto)
  if (contaGithubId && githubRepoId && githubRepoFullName) {
      try {
          await vincularRepositorioAoProjeto(projeto.id, contaGithubId, githubRepoId, githubRepoFullName)
      } catch {
          // Projeto já foi criado; falha ao registrar o webhook pode ser corrigida depois em "Editar Projeto".
      }
  }

  // Atualiza as telas
  if (equipeId) {
      revalidatePath(`/equipe/${equipeId}`)
  } else {
      revalidatePath('/')
  }
  return { success: true, data: { id: projeto.id } }
  } catch {
    return { success: false, error: 'Erro ao criar projeto. Tente novamente.' }
  }
}

export async function excluirColuna(formData: FormData) {
  const id = formData.get('id') as string
  await prisma.coluna.delete({ where: { id } })
  revalidatePath('/configuracoes/colunas')
}

export async function vincularMultiplasColunas(formData: FormData) {
    const projetoId = formData.get('projetoId') as string
    const colunasIds = formData.getAll('colunasIds') as string[]
    if (!projetoId || colunasIds.length === 0) return

    // Busca em 2 queries paralelas (em vez do loop N+1 anterior)
    const [ultimaColuna, jaVinculadas] = await Promise.all([
        prisma.projetoColuna.findFirst({
            where: { projeto_id: projetoId },
            orderBy: { ordem: 'desc' },
        }),
        prisma.projetoColuna.findMany({
            where: { projeto_id: projetoId, coluna_id: { in: colunasIds } },
            select: { coluna_id: true },
        }),
    ])

    const vinculadasSet = new Set(jaVinculadas.map(v => v.coluna_id))
    const novasIds = colunasIds.filter(id => !vinculadasSet.has(id))

    if (novasIds.length > 0) {
        let proximaOrdem = (ultimaColuna?.ordem ?? 0) + 1
        await prisma.projetoColuna.createMany({
            data: novasIds.map(colId => ({
                projeto_id: projetoId,
                coluna_id: colId,
                ordem: proximaOrdem++,
            })),
            skipDuplicates: true,
        })
    }

    revalidatePath(`/projeto/${projetoId}`)
}

export async function desvincularColunaDoProjeto(formData: FormData) {
    const projetoId = formData.get('projetoId') as string
    const colunaId = formData.get('colunaId') as string
    await prisma.projetoColuna.deleteMany({
      where: { projeto_id: projetoId, coluna_id: colunaId }
    })
    revalidatePath(`/projeto/${projetoId}`)
}

export async function getProjetosRecentesSidebar(equipeId: string) {
    if (!equipeId) return []
    
    return await prisma.projeto.findMany({
      where: { 
          equipe_id: equipeId,
          ativo: true 
      },
      orderBy: { dt_acesso: 'desc' },
      take: 9
    })
}

export async function getUsuariosDoWorkspace() {
  const session = await auth()
  if (!session?.user?.email) return []

  const solicitante = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  
  if (solicitante?.role !== 'OWNER') return []

  return await prisma.usuario.findMany({
    where: { workspace_id: solicitante.workspace_id },
    orderBy: { nome: 'asc' }
  })
}

export async function criarNovoUsuario(formData: FormData) {
  const session = await auth()
  if (!session?.user?.email) return { erro: 'Sem permissão' }

  const solicitante = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  
  if (solicitante?.role !== 'OWNER') {
    return { erro: 'Apenas administradores podem criar usuários.' }
  }

  const nome = formData.get('nome') as string
  const email = formData.get('email') as string
  const senha = formData.get('senha') as string
  const cargo = formData.get('cargo') as string
  let role = formData.get('role') as string
  if (role !== 'MANAGER') role = 'MEMBER'

  const validacao = schemaCriarUsuario.safeParse({ nome, email, senha, cargo })
  if (!validacao.success) {
    return { erro: validacao.error.issues[0].message }
  }

  const existe = await prisma.usuario.findUnique({ where: { email } })
  if (existe) return { erro: 'E-mail já cadastrado.' }

  const senhaHash = await bcrypt.hash(senha, 10)

  await prisma.usuario.create({
    data: {
      nome,
      email,
      senha: senhaHash,
      cargo: cargo || 'Colaborador',
      role: role, 
      ativo: true,
      workspace_id: solicitante.workspace_id!
    }
  })

  revalidatePath('/configuracoes/usuarios')
  return { sucesso: true }
}

export async function toggleStatusUsuario(usuarioAlvoId: string) {
  const session = await auth()
  if (!session?.user?.email) return

  const solicitante = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (solicitante?.role !== 'OWNER') return

  const alvo = await prisma.usuario.findUnique({ where: { id: usuarioAlvoId } })
  if (!alvo) return

  if (alvo.id === solicitante.id) return 

  await prisma.usuario.update({
    where: { id: usuarioAlvoId },
    data: { ativo: !alvo.ativo }
  })

  revalidatePath('/configuracoes/usuarios')
}

// --- NOVA FUNÇÃO: ALTERAR SENHA (OWNER) ---
export async function alterarSenhaUsuario(usuarioId: string, novaSenha: string) {
  const session = await auth()
  
  // 1. Verificação de Segurança
  const solicitante = await prisma.usuario.findUnique({ where: { email: session?.user?.email || '' } })
  if (solicitante?.role !== 'OWNER') {
      throw new Error("Apenas o OWNER pode alterar senhas.")
  }

  // 2. Validação
  if (!novaSenha || novaSenha.trim() === '') {
      throw new Error("A senha não pode ser vazia.")
  }

  // 3. Hash
  const hashedPassword = await bcrypt.hash(novaSenha, 10)

  // 4. Update
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { senha: hashedPassword }
  })

  revalidatePath('/configuracoes/usuarios')
  return { success: true }
}

export async function atualizarPermissoesSidebar(usuarioId: string, permissoes: string[] | null) {
  const session = await auth()
  const solicitante = await prisma.usuario.findUnique({ where: { email: session?.user?.email || '' } })
  if (solicitante?.role !== 'OWNER') throw new Error('Apenas o OWNER pode gerenciar permissões.')

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { permissoes_sidebar: permissoes ? JSON.stringify(permissoes) : null }
  })

  revalidatePath('/configuracoes/usuarios')
  return { success: true }
}

export async function reordenarColunas(projetoId: string, colunasIds: string[]) {
  try {
    await prisma.$transaction(
      colunasIds.map((colunaId, index) => 
        prisma.projetoColuna.update({
          where: {
            projeto_id_coluna_id: {
              projeto_id: projetoId,
              coluna_id: colunaId
            }
          },
          data: { ordem: index + 1 }
        })
      )
    )
    revalidatePath(`/projeto/${projetoId}`)
  } catch {
    // ignore
  }
}

export async function salvarAnexoNoBanco(dados: {
    nome: string,
    url: string,
    key: string,
    tamanho: number,
    tarefaId: string
}) {
    'use server'
    
    const novoAnexo = await prisma.anexo.create({
        data: {
            nome: dados.nome,
            url: dados.url,
            key: dados.key,
            tamanho: dados.tamanho,
            tarefa_id: dados.tarefaId
        }
    })

    revalidatePath('/') 
    return novoAnexo
}

export async function excluirAnexo(anexoId: string) {
    'use server'

    const session = await auth() 

    const anexo = await prisma.anexo.findUnique({
        where: { id: anexoId },
        include: { tarefa: true } 
    })

    if (!anexo) return

    try {
        await utapi.deleteFiles(anexo.key)
    } catch {
        // Falha silenciosa: o arquivo pode não existir no storage, mas o registro é removido do banco
    }

    await prisma.anexo.delete({ where: { id: anexoId } })

    if (session?.user?.email) {
        const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
        
        if (usuario) {
            await prisma.historicoTarefa.create({
                data: {
                    tarefa_id: anexo.tarefa_id,
                    usuario_id: usuario.id,
                    campo: 'ANEXO_REMOVIDO',
                    valor_antigo: anexo.nome,
                    valor_novo: 'Excluído'
                }
            })
        }
    }
    
    revalidatePath('/')
}

export async function atualizarImagemProjeto(projetoId: string, novaUrlImagem: string) {
    'use server'
    
    const projetoAntigo = await prisma.projeto.findUnique({
        where: { id: projetoId },
        select: { imagem: true }
    })

    if (projetoAntigo?.imagem) {
        try {
            const keyAntiga = projetoAntigo.imagem.split('/f/')[1]

            if (keyAntiga) {
                await utapi.deleteFiles(keyAntiga)
            }
        } catch {
            // Falha silenciosa: imagem antiga pode não existir no storage
        }
    }

    await prisma.projeto.update({
        where: { id: projetoId },
        data: { imagem: novaUrlImagem }
    })
    
    revalidatePath('/projetos')
    revalidatePath('/')
    revalidatePath(`/projeto/${projetoId}`)
}


export async function criarEquipe(formData: FormData) {
  const session = await auth()
  if (!session?.user?.email) return // Retorno vazio (void) para satisfazer o TS

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (usuarioLogado?.role !== 'OWNER') return // Retorno vazio (void)

  const nome = formData.get('nome') as string
  if (!nome) return // Retorno vazio (void)

  // Cria a equipe
  const novaEquipe = await prisma.equipe.create({
      data: {
          nome,
          workspace_id: usuarioLogado.workspace_id!
      }
  })

  // Já vincula o criador (OWNER) como LIDER desta nova equipe
  await prisma.equipeUsuario.create({
      data: {
          equipe_id: novaEquipe.id,
          usuario_id: usuarioLogado.id,
          role: 'LIDER'
      }
  })

  revalidatePath('/configuracoes/equipes')
  revalidatePath('/', 'layout') // Atualiza a Topbar globalmente
}

// --- GESTÃO DE DETALHES DA EQUIPE ---

export async function atualizarNomeEquipe(equipeId: string, novoNome: string) {
  if (!equipeId || !novoNome) return
  await prisma.equipe.update({
      where: { id: equipeId },
      data: { nome: novoNome }
  })
  revalidatePath('/configuracoes/equipes')
  revalidatePath('/', 'layout')
}

export async function adicionarMembroEquipe(formData: FormData) {
  const session = await auth()
  if (!session?.user?.email) return

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado || !['OWNER', 'MANAGER'].includes(usuarioLogado.role)) return

  const equipeId = formData.get('equipeId') as string
  const usuarioId = formData.get('usuarioId') as string

  if (!equipeId || !usuarioId) return

  // Valida que a equipe pertence ao workspace do usuário
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
  const session = await auth()
  if (!session?.user?.email) return

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado || !['OWNER', 'MANAGER'].includes(usuarioLogado.role)) return

  const equipeId = formData.get('equipeId') as string
  const usuarioId = formData.get('usuarioId') as string

  if (!equipeId || !usuarioId) return

  await prisma.equipeUsuario.deleteMany({
      where: { equipe_id: equipeId, usuario_id: usuarioId }
  })
  revalidatePath(`/configuracoes/equipes/${equipeId}`)
}

// --- INTEGRAÇÃO GITHUB ---

export async function desvincularContaGithub(contaId: string) {
  const session = await auth()
  if (!session?.user?.email) return { erro: 'Sem permissão' }

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado || usuarioLogado.role !== 'OWNER') return { erro: 'Apenas administradores podem gerenciar integrações.' }

  const conta = await prisma.contaGithub.findFirst({
    where: { id: contaId, equipe: { workspace_id: usuarioLogado.workspace_id } },
    include: { projetos: true },
  })
  if (!conta) return { erro: 'Conta não encontrada.' }

  // Best-effort: remove os webhooks dos projetos vinculados antes de desvincular a conta.
  for (const projeto of conta.projetos) {
    if (projeto.github_repo_full_name && projeto.github_webhook_id) {
      await deleteWebhook(conta.access_token, projeto.github_repo_full_name, projeto.github_webhook_id)
    }
  }

  await prisma.contaGithub.delete({ where: { id: contaId } })
  revalidatePath(`/configuracoes/equipes/${conta.equipe_id}`)
  return { sucesso: true }
}

export async function getRepositoriosGithub(equipeId: string, projetoIdAtual?: string): Promise<RepositorioGithubOpcao[]> {
  if (!equipeId) return []

  const contas = await prisma.contaGithub.findMany({ where: { equipe_id: equipeId } })
  if (contas.length === 0) return []

  const projetosVinculados = await prisma.projeto.findMany({
    where: {
      conta_github_id: { in: contas.map(c => c.id) },
      github_repo_id: { not: null },
      ...(projetoIdAtual && { id: { not: projetoIdAtual } }),
    },
    select: { github_repo_id: true },
  })
  const repoIdsOcupados = new Set(projetosVinculados.map(p => p.github_repo_id))

  const listasPorConta = await Promise.all(
    contas.map(async conta => {
      try {
        const repos = await listUserRepos(conta.access_token)
        return repos
          .filter(r => !repoIdsOcupados.has(r.id))
          .map<RepositorioGithubOpcao>(r => ({
            contaId: conta.id,
            contaLogin: conta.github_login,
            repoId: r.id,
            fullName: r.full_name,
          }))
      } catch {
        return []
      }
    })
  )

  return listasPorConta.flat()
}

async function vincularRepositorioAoProjeto(
  projetoId: string,
  contaGithubId: string,
  repoId: number,
  repoFullName: string
): Promise<{ webhookError?: string }> {
  const conta = await prisma.contaGithub.findUnique({ where: { id: contaGithubId } })
  if (!conta) return { webhookError: 'Conta do GitHub não encontrada.' }

  // Persiste o vínculo do repositório primeiro. Assim, mesmo que a criação
  // do webhook falhe logo abaixo, o repositório continua vinculado ao
  // projeto (e os commits dele continuam selecionáveis nas tarefas) em vez
  // de o vínculo sumir silenciosamente.
  await prisma.projeto.update({
    where: { id: projetoId },
    data: {
      conta_github_id: contaGithubId,
      github_repo_id: repoId,
      github_repo_full_name: repoFullName,
      github_webhook_id: null,
      github_webhook_secret: null,
    },
  })

  // O GitHub recusa webhooks apontando para uma URL que não seja pública —
  // ou seja, não dá pra criar o webhook enquanto o app roda em localhost.
  // Não vale a pena nem tentar (e nem avisar como se fosse um erro a corrigir).
  let hostnameAppUrl = ''
  try {
    hostnameAppUrl = new URL(getAppUrl()).hostname
  } catch {
    // APP_URL ausente/mal formada — segue e deixa createWebhook reportar o problema.
  }
  if (hostnameAppUrl === 'localhost' || hostnameAppUrl === '127.0.0.1') {
    return {
      webhookError: 'Repositório vinculado. A criação automática de tarefas a partir de push só funciona quando o app estiver publicado numa URL pública (o GitHub não aceita webhooks para localhost) — por enquanto, vincule os commits manualmente nas tarefas.',
    }
  }

  try {
    const secret = crypto.randomBytes(32).toString('hex')
    const webhookId = await createWebhook(conta.access_token, repoFullName, secret)
    await prisma.projeto.update({
      where: { id: projetoId },
      data: { github_webhook_id: webhookId, github_webhook_secret: secret },
    })
    return {}
  } catch (error) {
    console.error('Falha ao criar webhook do GitHub:', error)
    return {
      webhookError: 'Repositório vinculado, mas não foi possível criar o webhook automático (pushes não vão gerar tarefas sozinhos). Tente desvincular e vincular novamente.',
    }
  }
}

export async function getCommitsDoProjeto(projetoId: string, tarefaIdAtual?: string): Promise<CommitGithubOpcao[]> {
  if (!projetoId) return []

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId } })
  if (!projeto?.conta_github_id || !projeto.github_repo_full_name) return []

  const conta = await prisma.contaGithub.findUnique({ where: { id: projeto.conta_github_id } })
  if (!conta) return []

  const commitsUsados = await prisma.tarefa.findMany({
    where: {
      projeto_id: projetoId,
      github_commit_sha: { not: null },
      ...(tarefaIdAtual && { id: { not: tarefaIdAtual } }),
    },
    select: { github_commit_sha: true },
  })
  const shasOcupados = new Set(commitsUsados.map(t => t.github_commit_sha))

  try {
    const commits = await listRepoCommits(conta.access_token, projeto.github_repo_full_name)
    return commits.filter(c => !shasOcupados.has(c.sha))
  } catch {
    return []
  }
}

export async function vincularCommitATarefa(
  tarefaId: string,
  projetoId: string,
  commitSha: string | null,
  commitMensagem?: string | null
): Promise<{ success: boolean; error?: string }> {
  const session = await auth()
  const quemFez = session?.user?.email
    ? await prisma.usuario.findUnique({ where: { email: session.user.email } })
    : null

  let tarefaAtualizada
  try {
    tarefaAtualizada = await prisma.tarefa.update({
      where: { id: tarefaId },
      data: {
        github_commit_sha: commitSha,
        concluida: !!commitSha,
        dt_conclusao: commitSha ? new Date() : null,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'Esse commit já está vinculado a outra tarefa deste projeto.' }
    }
    return { success: false, error: 'Erro ao vincular commit. Tente novamente.' }
  }

  // Confirmação honesta: relê a linha para garantir que a escrita realmente persistiu
  // antes de reportar sucesso ao usuário (evita o toast "salvo" mentir sobre o estado real).
  if (tarefaAtualizada.github_commit_sha !== commitSha) {
    return { success: false, error: 'A tarefa não confirmou o vínculo do commit. Tente novamente.' }
  }

  if (quemFez) {
    await prisma.historicoTarefa.create({
      data: {
        tarefa_id: tarefaId,
        usuario_id: quemFez.id,
        campo: commitSha ? 'CONCLUSAO' : 'REABERTURA',
        valor_novo: commitSha
          ? `Vinculada ao commit ${commitSha.slice(0, 7)}${commitMensagem ? ': ' + commitMensagem : ''}`
          : 'Commit desvinculado',
      },
    })
  }

  const projeto = await prisma.projeto.findUnique({ where: { id: projetoId }, select: { equipe_id: true } })
  if (projeto?.equipe_id) {
    // Rotas reais (a app usa /equipe/[equipeId]/... — não existe rota sem o prefixo /equipe/[equipeId]).
    // A "Visão Geral (Admin)" que o OWNER cai por padrão é justamente /equipe/[equipeId]/minhas-tarefas.
    revalidatePath(`/equipe/${projeto.equipe_id}/projeto/${projetoId}`)
    revalidatePath(`/equipe/${projeto.equipe_id}/minhas-tarefas`)
    revalidatePath(`/equipe/${projeto.equipe_id}/sprint`)
  }
  revalidatePath('/')
  return { success: true }
}

// --- GESTÃO DE PROJETOS (EDITAR / EXCLUIR) ---

export async function editarProjeto(formData: FormData): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado) return { success: false, error: 'Usuário não encontrado.' }

  const id = formData.get('id') as string
  const nome = formData.get('nome') as string
  const descricao = formData.get('descricao') as string
  const equipeId = formData.get('equipeId') as string

  const erp = formData.get('erp') as string
  const dadosAcesso = formData.get('dadosAcesso') as string
  const pacoteOnblox = formData.get('pacote_onblox') as string
  const tipoIntegracao = formData.get('tipo_integracao') as string
  const statusCliente = formData.get('status_cliente') as string
  const motivoPausa = formData.get('motivo_pausa') as string
  const responsavelId = formData.get('responsavelId') as string | null
  const dataInicio = formData.get('data_inicio') as string
  const dataPrevistaEntrega = formData.get('data_prevista_entrega') as string

  // --- INTEGRAÇÃO GITHUB (opcional) ---
  const contaGithubId = (formData.get('contaGithubId') as string) || null
  const githubRepoId = formData.get('githubRepoId') ? Number(formData.get('githubRepoId')) : null
  const githubRepoFullName = (formData.get('githubRepoFullName') as string) || null

  if (!id || !nome) return { success: false, error: 'Dados obrigatórios ausentes.' }

  // Valida que o projeto pertence ao workspace do usuário
  const projeto = await prisma.projeto.findFirst({
    where: { id, workspace_id: usuarioLogado.workspace_id }
  })
  if (!projeto) return { success: false, error: 'Projeto não encontrado.' }

  try {
    await prisma.projeto.update({
        where: { id },
        data: {
            nome,
            descricao,
            erp,
            dados_acesso: dadosAcesso,
            pacote_onblox: pacoteOnblox,
            tipo_integracao: tipoIntegracao,
            status_cliente: statusCliente,
            motivo_pausa: statusCliente === 'PAUSADO' ? motivoPausa : null,
            data_inicio: dataInicio ? new Date(dataInicio) : null,
            data_prevista_entrega: dataPrevistaEntrega ? new Date(dataPrevistaEntrega) : null,
            ...(responsavelId && { usuario_id: responsavelId })
        }
    })

    // Repositório GitHub mudou: selecionou outro, vinculou pela primeira vez, ou desvinculou ("Nenhum")
    let avisoGithub: string | undefined
    if (githubRepoId !== projeto.github_repo_id) {
        // Remove o webhook do repositório antigo (se houver) antes de trocar ou desvincular.
        if (projeto.github_repo_full_name && projeto.github_webhook_id && projeto.conta_github_id) {
            const contaAntiga = await prisma.contaGithub.findUnique({ where: { id: projeto.conta_github_id } })
            if (contaAntiga) {
                await deleteWebhook(contaAntiga.access_token, projeto.github_repo_full_name, projeto.github_webhook_id)
            }
        }

        if (contaGithubId && githubRepoId && githubRepoFullName) {
            try {
                const resultadoVinculo = await vincularRepositorioAoProjeto(id, contaGithubId, githubRepoId, githubRepoFullName)
                avisoGithub = resultadoVinculo.webhookError
            } catch (error) {
                console.error('Falha ao vincular repositório do GitHub ao projeto:', error)
                avisoGithub = 'Não foi possível vincular o repositório do GitHub. Tente novamente.'
            }
        } else {
            // Usuário selecionou "Nenhum" — desvincula o repositório do projeto.
            await prisma.projeto.update({
                where: { id },
                data: {
                    conta_github_id: null,
                    github_repo_id: null,
                    github_repo_full_name: null,
                    github_webhook_id: null,
                    github_webhook_secret: null,
                },
            })
        }
    }

    if (equipeId) {
        revalidatePath(`/equipe/${equipeId}/projeto/${id}`)
        revalidatePath(`/equipe/${equipeId}/portfolio`)
    }
    return { success: true, data: undefined, warning: avisoGithub }
  } catch {
    return { success: false, error: 'Erro ao salvar projeto. Tente novamente.' }
  }
}

export async function excluirProjetoCompleto(projetoId: string) {
  // 1. Busca todas as tarefas do projeto para limpar as dependências
  const tarefas = await prisma.tarefa.findMany({ 
      where: { projeto_id: projetoId }, 
      select: { id: true } 
  })
  const tarefaIds = tarefas.map(t => t.id)

  // 2. Limpa tudo em cascata para não dar erro no banco
  if (tarefaIds.length > 0) {
      await prisma.comentario.deleteMany({ where: { tarefa_id: { in: tarefaIds } } })
      await prisma.historicoTarefa.deleteMany({ where: { tarefa_id: { in: tarefaIds } } })
      await prisma.anexo.deleteMany({ where: { tarefa_id: { in: tarefaIds } } })
      await prisma.tarefa.deleteMany({ where: { projeto_id: projetoId } })
  }

  // 3. Limpa as colunas vinculadas e finalmente o projeto
  await prisma.projetoColuna.deleteMany({ where: { projeto_id: projetoId } })
  await prisma.projeto.delete({ where: { id: projetoId } })

  revalidatePath('/', 'layout')
  return { success: true }
}

// --- EXCLUSÃO DE EQUIPA (ZONA DE PERIGO) ---

export async function excluirEquipe(equipeId: string) {
  const session = await auth()
  if (!session?.user?.email) return { erro: 'Sem permissão' }

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (usuarioLogado?.role !== 'OWNER') return { erro: 'Apenas admins podem excluir equipas' }

  // 1. Procura todos os projetos desta equipa
  const projetos = await prisma.projeto.findMany({ 
      where: { equipe_id: equipeId }, 
      select: { id: true } 
  })
  const projetosIds = projetos.map(p => p.id)

  // 2. Se houver projetos, limpa tudo o que está dentro deles
  if (projetosIds.length > 0) {
      const tarefas = await prisma.tarefa.findMany({ 
          where: { projeto_id: { in: projetosIds } }, 
          select: { id: true } 
      })
      const tarefasIds = tarefas.map(t => t.id)

      if (tarefasIds.length > 0) {
          await prisma.comentario.deleteMany({ where: { tarefa_id: { in: tarefasIds } } })
          await prisma.historicoTarefa.deleteMany({ where: { tarefa_id: { in: tarefasIds } } })
          await prisma.anexo.deleteMany({ where: { tarefa_id: { in: tarefasIds } } })
          await prisma.tarefa.deleteMany({ where: { projeto_id: { in: projetosIds } } })
      }

      await prisma.projetoColuna.deleteMany({ where: { projeto_id: { in: projetosIds } } })
      await prisma.projeto.deleteMany({ where: { equipe_id: equipeId } })
  }

  // 3. Apaga as colunas (etapas) exclusivas da equipa
  await prisma.coluna.deleteMany({ where: { equipe_id: equipeId } })

  // 4. Remove os utilizadores da equipa
  await prisma.equipeUsuario.deleteMany({ where: { equipe_id: equipeId } })

  // 5. Finalmente, apaga a equipa
  await prisma.equipe.delete({ where: { id: equipeId } })

  revalidatePath('/configuracoes/equipes')
  revalidatePath('/', 'layout')
  
  return { sucesso: true }
}

// ==========================================
// MOTOR DE TEMPLATES (PACOTES DE TAREFAS)
// ==========================================

export async function criarPacoteTemplate(formData: FormData) {
  const equipe_id = formData.get('equipeId') as string
  const nome = formData.get('nome') as string
  const descricao = formData.get('descricao') as string

  if (!equipe_id || !nome) return

  await prisma.pacoteTemplate.create({
      data: { equipe_id, nome, descricao }
  })
  revalidatePath(`/configuracoes/equipes/${equipe_id}`)
}

export async function excluirPacoteTemplate(formData: FormData) {
  const pacote_id = formData.get('pacoteId') as string
  const equipe_id = formData.get('equipeId') as string

  if (!pacote_id) return

  // Como colocamos onDelete: Cascade no schema, apagar o pacote já apaga as tarefas dele!
  await prisma.pacoteTemplate.delete({
      where: { id: pacote_id }
  })
  revalidatePath(`/configuracoes/equipes/${equipe_id}`)
}

export async function adicionarTarefaTemplate(formData: FormData) {
  const pacote_id = formData.get('pacoteId') as string
  const equipe_id = formData.get('equipeId') as string
  const titulo = formData.get('titulo') as string
  const descricao = formData.get('descricao') as string

  if (!pacote_id || !titulo) return

  await prisma.tarefaTemplate.create({
      data: { pacote_id, titulo, descricao }
  })
  revalidatePath(`/configuracoes/equipes/${equipe_id}`)
}

export async function removerTarefaTemplate(formData: FormData) {
  const tarefa_id = formData.get('tarefaId') as string
  const equipe_id = formData.get('equipeId') as string

  if (!tarefa_id) return

  await prisma.tarefaTemplate.delete({
      where: { id: tarefa_id }
  })
  revalidatePath(`/configuracoes/equipes/${equipe_id}`)
}

// ==========================================
// INJEÇÃO DE PACOTES (O BOTÃO MÁGICO)
// ==========================================

export async function importarPacoteTarefas(formData: FormData): Promise<ActionResult<{ count: number }>> {
  const pacoteId = formData.get('pacoteId') as string
  const projetoId = formData.get('projetoId') as string
  const colunaId = formData.get('colunaId') as string
  const equipeId = formData.get('equipeId') as string

  const usuarioId = formData.get('usuarioId') as string
  const dtVencimento = formData.get('dtVencimento') as string
  const prioridadeId = formData.get('prioridadeId') as string
  const dificuldadeId = formData.get('dificuldadeId') as string

  if (!pacoteId || !projetoId || !colunaId) {
    return { success: false, error: 'Dados obrigatórios ausentes.' }
  }

  try {
    const tarefasTemplate = await prisma.tarefaTemplate.findMany({
        where: { pacote_id: pacoteId },
        orderBy: { ordem: 'asc' }
    })

    if (tarefasTemplate.length === 0) {
      return { success: false, error: 'O pacote não possui tarefas.' }
    }

    let dataIso = null
    if (dtVencimento) {
        const [ano, mes, dia] = dtVencimento.split('-').map(Number)
        dataIso = new Date(ano, mes - 1, dia, 12, 0, 0)
    }

    const novasTarefas = tarefasTemplate.map((t, index) => ({
        titulo: t.titulo,
        descricao: t.descricao,
        projeto_id: projetoId,
        coluna_id: colunaId,
        usuario_id: usuarioId ? usuarioId : null,
        dt_vencimento: dataIso,
        prioridade_id: prioridadeId ? parseInt(prioridadeId) : t.prioridade_id,
        dificuldade_id: dificuldadeId ? parseInt(dificuldadeId) : t.dificuldade_id,
        ordem: t.ordem ?? (index + 1)
    }))

    const resultado = await prisma.tarefa.createMany({ data: novasTarefas })

    revalidatePath(`/equipe/${equipeId}/projeto/${projetoId}`)
    return { success: true, data: { count: resultado.count } }
  } catch {
    return { success: false, error: 'Erro ao importar pacote. Tente novamente.' }
  }
}

export async function editarTarefaTemplate(formData: FormData) {
  const tarefa_id = formData.get('tarefaId') as string
  const equipe_id = formData.get('equipeId') as string
  const titulo = formData.get('titulo') as string
  const descricao = formData.get('descricao') as string

  if (!tarefa_id || !titulo) return

  await prisma.tarefaTemplate.update({
      where: { id: tarefa_id },
      data: { titulo, descricao }
  })
  revalidatePath(`/configuracoes/equipes/${equipe_id}`)
}


export async function atualizarFaseMacro(formData: FormData) {
  const projetoId = formData.get('projetoId') as string
  const novaFase = formData.get('novaFase') as string
  const equipeId = formData.get('equipeId') as string

  if (!projetoId || !novaFase) return

  await prisma.projeto.update({
      where: { id: projetoId },
      data: { fase_macro: novaFase }
  })
  
  revalidatePath(`/equipe/${equipeId}/portfolio`)
}

export async function atualizarOrdemTarefasPadrao(tarefas: { id: string, ordem: number }[], equipeId: string) {
  if (!tarefas || tarefas.length === 0) return

  // Usamos uma transação para garantir que todas atualizem juntas
  await prisma.$transaction(
    tarefas.map((t) => 
      prisma.tarefaTemplate.update({ // Ajuste o nome do model se o seu for diferente
        where: { id: t.id },
        data: { ordem: t.ordem }
      })
    )
  )
  
  // Revalida a página de configurações
  revalidatePath(`/equipe/${equipeId}/configuracoes`)
}

// 2. Reordena as tarefas reais dentro da coluna do Kanban
export async function atualizarOrdemTarefas(tarefas: { id: string, ordem: number }[], projetoId: string, equipeId: string) {
  if (!tarefas || tarefas.length === 0) return

  await prisma.$transaction(
    tarefas.map((t) => 
      prisma.tarefa.update({
        where: { id: t.id },
        data: { ordem: t.ordem }
      })
    )
  )
  
  revalidatePath(`/equipe/${equipeId}/projeto/${projetoId}`)
}

// Adicione isso no final do seu app/actions.ts

export async function reordenarTarefasTemplate(
  tarefasAtualizadas: { id: string, ordem: number, pacote_id: string }[], 
  equipeId: string
) {
  if (!tarefasAtualizadas || tarefasAtualizadas.length === 0) return

  // Atualiza a ordem e o pacote_id (caso tenha mudado de pacote) de todas as tarefas afetadas
  await prisma.$transaction(
      tarefasAtualizadas.map((t) => 
          prisma.tarefaTemplate.update({
              where: { id: t.id },
              data: { ordem: t.ordem, pacote_id: t.pacote_id }
          })
      )
  )
  
  revalidatePath(`/configuracoes/equipes/${equipeId}`)
}
// ==========================================
// DATAS DE ETAPAS DO PROJETO
// ==========================================

export async function atualizarDatasEtapa(
  projetoId: string,
  colunaId: string,
  dataInicio: string | null,
  dataFim: string | null,
  equipeId: string
) {
  await prisma.projetoColuna.update({
    where: { projeto_id_coluna_id: { projeto_id: projetoId, coluna_id: colunaId } },
    data: {
      data_inicio: dataInicio ? new Date(dataInicio) : null,
      data_fim: dataFim ? new Date(dataFim) : null
    }
  })
  revalidatePath(`/equipe/${equipeId}/projeto/${projetoId}`)
  revalidatePath(`/equipe/${equipeId}/relatorio`)
}

// ==========================================
// RECURSOS DA EQUIPE (LINKS / DOCUMENTAÇÃO)
// ==========================================

export async function criarRecurso(formData: FormData): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  const equipeId = formData.get('equipeId') as string
  const titulo = formData.get('titulo') as string
  const url = formData.get('url') as string
  const descricao = formData.get('descricao') as string
  const categoria = formData.get('categoria') as string
  const tipo = (formData.get('tipo') as string) || 'LINK'
  const arquivoNome = formData.get('arquivo_nome') as string

  if (!titulo || !url) return { success: false, error: 'Título e URL são obrigatórios.' }

  try {
    const count = await prisma.recursoEquipe.count({ where: { equipe_id: equipeId } })
    await prisma.recursoEquipe.create({
      data: { equipe_id: equipeId, titulo, url, descricao: descricao || null, categoria: categoria || null, icone: null, tipo, arquivo_nome: arquivoNome || null, ordem: count }
    })
    revalidatePath(`/equipe/${equipeId}/recursos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao criar recurso.' }
  }
}

export async function editarRecurso(formData: FormData): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  const id = formData.get('id') as string
  const equipeId = formData.get('equipeId') as string
  const titulo = formData.get('titulo') as string
  const url = formData.get('url') as string
  const descricao = formData.get('descricao') as string
  const categoria = formData.get('categoria') as string
  const tipo = (formData.get('tipo') as string) || 'LINK'
  const arquivoNome = formData.get('arquivo_nome') as string

  if (!id || !titulo || !url) return { success: false, error: 'Dados obrigatórios ausentes.' }

  try {
    await prisma.recursoEquipe.update({
      where: { id },
      data: { titulo, url, descricao: descricao || null, categoria: categoria || null, icone: null, tipo, arquivo_nome: arquivoNome || null }
    })
    revalidatePath(`/equipe/${equipeId}/recursos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao editar recurso.' }
  }
}

export async function excluirRecurso(id: string, equipeId: string): Promise<ActionResult> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    await prisma.recursoEquipe.delete({ where: { id } })
    revalidatePath(`/equipe/${equipeId}/recursos`)
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir recurso.' }
  }
}

export async function getRecursosDaEquipe(equipeId: string) {
  const session = await auth()
  if (!session?.user?.email) return []

  return prisma.recursoEquipe.findMany({
    where: { equipe_id: equipeId },
    orderBy: [{ categoria: 'asc' }, { ordem: 'asc' }]
  })
}

// =============================================================================
// MÓDULO FINANCEIRO
// =============================================================================

// --- PLANO DE CONTAS ---

export async function criarPlanoContas(formData: FormData): Promise<ActionResult<import('@prisma/client').PlanoContas>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const nome = formData.get('nome') as string
    const tipo = formData.get('tipo') as 'DESPESA' | 'RECEITA'

    if (!nome?.trim()) return { success: false, error: 'Nome é obrigatório.' }
    if (!['DESPESA', 'RECEITA'].includes(tipo)) return { success: false, error: 'Tipo inválido.' }

    const conta = await prisma.planoContas.create({
      data: { workspace_id: usuario.workspace_id, tipo, nome: nome.trim() }
    })

    revalidatePath('/financeiro/plano-contas')
    return { success: true, data: conta }
  } catch {
    return { success: false, error: 'Erro ao criar conta.' }
  }
}

export async function editarPlanoContas(formData: FormData): Promise<ActionResult<import('@prisma/client').PlanoContas>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const id = formData.get('id') as string
    const nome = formData.get('nome') as string
    const tipo = formData.get('tipo') as 'DESPESA' | 'RECEITA'

    if (!nome?.trim()) return { success: false, error: 'Nome é obrigatório.' }

    const conta = await prisma.planoContas.findFirst({ where: { id, workspace_id: usuario.workspace_id } })
    if (!conta) return { success: false, error: 'Conta não encontrada.' }

    const atualizada = await prisma.planoContas.update({
      where: { id },
      data: { nome: nome.trim(), tipo }
    })

    revalidatePath('/financeiro/plano-contas')
    return { success: true, data: atualizada }
  } catch {
    return { success: false, error: 'Erro ao editar conta.' }
  }
}

export async function excluirPlanoContas(id: string): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const conta = await prisma.planoContas.findFirst({ where: { id, workspace_id: usuario.workspace_id } })
    if (!conta) return { success: false, error: 'Conta não encontrada.' }

    const emUso = await prisma.lancamentoFinanceiro.count({ where: { plano_contas_id: id } })
    if (emUso > 0) return { success: false, error: 'Esta conta possui lançamentos vinculados e não pode ser excluída.' }

    await prisma.planoContas.delete({ where: { id } })

    revalidatePath('/financeiro/plano-contas')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir conta.' }
  }
}

export async function toggleAtivoPlanoContas(id: string): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const conta = await prisma.planoContas.findFirst({ where: { id, workspace_id: usuario.workspace_id } })
    if (!conta) return { success: false, error: 'Conta não encontrada.' }

    await prisma.planoContas.update({ where: { id }, data: { ativo: !conta.ativo } })

    revalidatePath('/financeiro/plano-contas')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao alterar status da conta.' }
  }
}

// --- LANÇAMENTOS FINANCEIROS ---

export async function criarLancamento(formData: FormData): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const tipo = formData.get('tipo') as 'DESPESA' | 'RECEITA'
    const descricao = (formData.get('descricao') as string)?.trim()
    const beneficiario = (formData.get('beneficiario') as string)?.trim() || null
    const valorStr = formData.get('valor') as string
    const valor = parseFloat(valorStr.replace(',', '.'))
    const dt_vencimento = new Date(formData.get('dt_vencimento') as string)
    const numero_documento = (formData.get('numero_documento') as string)?.trim() || null
    const plano_contas_id = formData.get('plano_contas_id') as string
    const recorrencia = (formData.get('recorrencia') as string || 'NAO') as import('@prisma/client').Recorrencia
    const numero_parcelas = parseInt(formData.get('numero_parcelas') as string) || 1

    if (!descricao) return { success: false, error: 'Descrição é obrigatória.' }
    if (isNaN(valor) || valor <= 0) return { success: false, error: 'Valor inválido.' }
    if (!plano_contas_id) return { success: false, error: 'Categoria é obrigatória.' }

    const conta = await prisma.planoContas.findFirst({ where: { id: plano_contas_id, workspace_id: usuario.workspace_id } })
    if (!conta) return { success: false, error: 'Categoria não encontrada.' }

    if (numero_parcelas > 1) {
      const grupoParcela = crypto.randomUUID()

      for (let i = 1; i <= numero_parcelas; i++) {
        const dtParcela = new Date(dt_vencimento)
        dtParcela.setMonth(dtParcela.getMonth() + (i - 1))
        await prisma.lancamentoFinanceiro.create({
          data: {
            workspace_id: usuario.workspace_id,
            tipo,
            descricao,
            beneficiario,
            valor,
            dt_vencimento: dtParcela,
            numero_documento,
            plano_contas_id,
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
          workspace_id: usuario.workspace_id,
          tipo,
          descricao,
          beneficiario,
          valor,
          dt_vencimento,
          numero_documento,
          plano_contas_id,
          recorrencia,
        }
      })
    }

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao criar lançamento.' }
  }
}

export async function editarLancamento(formData: FormData): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const id = formData.get('id') as string
    const descricao = (formData.get('descricao') as string)?.trim()
    const beneficiario = (formData.get('beneficiario') as string)?.trim() || null
    const valorStr = formData.get('valor') as string
    const valor = parseFloat(valorStr.replace(',', '.'))
    const dt_vencimento = new Date(formData.get('dt_vencimento') as string)
    const numero_documento = (formData.get('numero_documento') as string)?.trim() || null
    const plano_contas_id = formData.get('plano_contas_id') as string

    if (!descricao) return { success: false, error: 'Descrição é obrigatória.' }
    if (isNaN(valor) || valor <= 0) return { success: false, error: 'Valor inválido.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id, workspace_id: usuario.workspace_id } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.lancamentoFinanceiro.update({
      where: { id },
      data: { descricao, beneficiario, valor, dt_vencimento, numero_documento, plano_contas_id }
    })

    const aplicarATodos = formData.get('aplicar_a_todos') === 'true'
    if (aplicarATodos && lancamento.grupo_parcela_id) {
      await prisma.lancamentoFinanceiro.updateMany({
        where: { grupo_parcela_id: lancamento.grupo_parcela_id, id: { not: id } },
        data: { descricao, beneficiario, valor, numero_documento, plano_contas_id },
      })
    }

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao editar lançamento.' }
  }
}

export async function excluirGrupoParcelas(grupo_parcela_id: string): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const ids = await prisma.lancamentoFinanceiro.findMany({
      where: { grupo_parcela_id, workspace_id: usuario.workspace_id },
      select: { id: true },
    })
    const idsArr = ids.map(l => l.id)
    await prisma.anexoFinanceiro.deleteMany({ where: { lancamento_id: { in: idsArr } } })
    await prisma.lancamentoFinanceiro.deleteMany({ where: { id: { in: idsArr } } })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir grupo de parcelas.' }
  }
}

export async function excluirParcelasAPartirDesta(id: string): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findUnique({
      where: { id, workspace_id: usuario.workspace_id },
      select: { grupo_parcela_id: true, parcela_atual: true },
    })
    if (!lancamento?.grupo_parcela_id || lancamento.parcela_atual == null) {
      return { success: false, error: 'Parcela inválida.' }
    }

    const alvos = await prisma.lancamentoFinanceiro.findMany({
      where: {
        grupo_parcela_id: lancamento.grupo_parcela_id,
        workspace_id: usuario.workspace_id,
        parcela_atual: { gte: lancamento.parcela_atual },
        status: { not: 'PAGO' },
      },
      select: { id: true },
    })
    const idsArr = alvos.map(l => l.id)

    await prisma.anexoFinanceiro.deleteMany({ where: { lancamento_id: { in: idsArr } } })
    await prisma.lancamentoFinanceiro.deleteMany({ where: { id: { in: idsArr } } })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir parcelas.' }
  }
}

export async function pagarLancamento(id: string, dt_pagamento: string): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id, workspace_id: usuario.workspace_id } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.lancamentoFinanceiro.update({
      where: { id },
      data: { status: 'PAGO', dt_pagamento: new Date(dt_pagamento) }
    })

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
          workspace_id: lancamento.workspace_id,
          tipo: lancamento.tipo,
          descricao: lancamento.descricao,
          beneficiario: lancamento.beneficiario,
          valor: lancamento.valor,
          dt_vencimento: proxData,
          numero_documento: lancamento.numero_documento,
          plano_contas_id: lancamento.plano_contas_id,
          recorrencia: lancamento.recorrencia,
          status: 'PENDENTE',
          lancamento_pai_id: id,
        }
      })
    }

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao registrar pagamento.' }
  }
}

export async function excluirEAvancarRecorrencia(id: string): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id, workspace_id: usuario.workspace_id } })
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

    await prisma.anexoFinanceiro.deleteMany({ where: { lancamento_id: id } })
    await prisma.lancamentoFinanceiro.delete({ where: { id } })

    await prisma.lancamentoFinanceiro.create({
      data: {
        workspace_id: lancamento.workspace_id,
        tipo: lancamento.tipo,
        descricao: lancamento.descricao,
        beneficiario: lancamento.beneficiario,
        valor: lancamento.valor,
        dt_vencimento: proxData,
        numero_documento: lancamento.numero_documento,
        plano_contas_id: lancamento.plano_contas_id,
        recorrencia: lancamento.recorrencia,
        status: 'PENDENTE',
        lancamento_pai_id: id,
      }
    })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao processar lançamento.' }
  }
}

export async function cancelarLancamento(id: string): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id, workspace_id: usuario.workspace_id } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.lancamentoFinanceiro.update({ where: { id }, data: { status: 'CANCELADO' } })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao cancelar lançamento.' }
  }
}

export async function excluirLancamento(id: string): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({ where: { id, workspace_id: usuario.workspace_id } })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.anexoFinanceiro.deleteMany({ where: { lancamento_id: id } })
    await prisma.lancamentoFinanceiro.delete({ where: { id } })

    revalidatePath('/financeiro/contas-a-pagar')
    revalidatePath('/financeiro/contas-a-receber')
    revalidatePath('/financeiro/balancete')
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao excluir lançamento.' }
  }
}

export async function salvarAnexoFinanceiro(dados: {
  lancamento_id: string
  nome: string
  url: string
  key: string
  tamanho: number
}): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id: dados.lancamento_id, workspace_id: usuario.workspace_id }
    })
    if (!lancamento) return { success: false, error: 'Lançamento não encontrado.' }

    await prisma.anexoFinanceiro.create({ data: dados })
    return { success: true, data: undefined }
  } catch {
    return { success: false, error: 'Erro ao salvar anexo.' }
  }
}

export async function excluirAnexoFinanceiro(anexoId: string): Promise<ActionResult<undefined>> {
  const session = await auth()
  if (!session?.user?.email) return { success: false, error: 'Não autenticado.' }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
    if (!usuario) return { success: false, error: 'Usuário não encontrado.' }

    const anexo = await prisma.anexoFinanceiro.findUnique({ where: { id: anexoId } })
    if (!anexo) return { success: false, error: 'Anexo não encontrado.' }

    const lancamento = await prisma.lancamentoFinanceiro.findFirst({
      where: { id: anexo.lancamento_id, workspace_id: usuario.workspace_id }
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
  tipo: 'DESPESA' | 'RECEITA',
  filtros?: { dataInicio?: string; dataFim?: string; status?: string; plano_contas_id?: string }
) {
  const session = await auth()
  if (!session?.user?.email) return []
  const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuario) return []

  const where: import('@prisma/client').Prisma.LancamentoFinanceiroWhereInput = {
    workspace_id: usuario.workspace_id,
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

  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where,
    include: { plano_contas: true, anexos: true },
    orderBy: { dt_vencimento: 'asc' },
  })
  return lancamentos.map(l => ({ ...l, valor: Number(l.valor) }))
}

export async function getBalancete(dataInicio: string, dataFim: string) {
  const session = await auth()
  if (!session?.user?.email) return null

  const usuario = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuario) return null

  const inicio = new Date(dataInicio)
  const fim = new Date(dataFim)
  fim.setHours(23, 59, 59, 999)

  const workspaceId = usuario.workspace_id

  const noPeriodo = await prisma.lancamentoFinanceiro.findMany({
    where: {
      workspace_id: workspaceId,
      status: { not: 'CANCELADO' },
      dt_vencimento: { gte: inicio, lte: fim },
    },
    include: { plano_contas: true }
  })

  const todosPagos = await prisma.lancamentoFinanceiro.findMany({
    where: { workspace_id: workspaceId, status: 'PAGO' },
    select: { tipo: true, valor: true }
  })

  const toNumber = (v: unknown) => typeof v === 'object' && v !== null && 'toNumber' in v ? (v as { toNumber: () => number }).toNumber() : Number(v)

  const receitas = noPeriodo.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + toNumber(l.valor), 0)
  const despesas = noPeriodo.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + toNumber(l.valor), 0)
  const lucro = receitas - despesas

  const saldoReceitas = todosPagos.filter(l => l.tipo === 'RECEITA').reduce((s, l) => s + toNumber(l.valor), 0)
  const saldoDespesas = todosPagos.filter(l => l.tipo === 'DESPESA').reduce((s, l) => s + toNumber(l.valor), 0)
  const saldo = saldoReceitas - saldoDespesas

  const a_receber = noPeriodo.filter(l => l.tipo === 'RECEITA' && l.status === 'PENDENTE').reduce((s, l) => s + toNumber(l.valor), 0)
  const a_pagar = noPeriodo.filter(l => l.tipo === 'DESPESA' && l.status === 'PENDENTE').reduce((s, l) => s + toNumber(l.valor), 0)

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
      workspace_id: workspaceId,
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