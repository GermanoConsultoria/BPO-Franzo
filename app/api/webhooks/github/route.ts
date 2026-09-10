import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySignature } from '@/lib/github'

const PRIORIDADE_DIFICULDADE_PADRAO = 3 // "Média"

interface GithubCommit {
  id: string
  message: string
  url: string
  author: { name: string }
}

interface GithubPushPayload {
  ref: string
  pusher: { name: string }
  repository: { id: number; full_name: string }
  commits: GithubCommit[]
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const evento = req.headers.get('x-github-event')
  const assinatura = req.headers.get('x-hub-signature-256')

  if (evento === 'ping') {
    return NextResponse.json({ ok: true })
  }

  let payload: GithubPushPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: 'payload inválido' }, { status: 400 })
  }

  if (!payload.repository?.id) {
    return NextResponse.json({ ok: false, error: 'payload sem repositório' }, { status: 400 })
  }

  const projeto = await prisma.projeto.findUnique({
    where: { github_repo_id: payload.repository.id },
  })

  if (!projeto || !projeto.github_webhook_secret) {
    // Repositório não mapeado a nenhum projeto — ignora sem erro para não gerar retries.
    return NextResponse.json({ ok: true, ignorado: true })
  }

  if (!verifySignature(rawBody, assinatura, projeto.github_webhook_secret)) {
    return NextResponse.json({ ok: false, error: 'assinatura inválida' }, { status: 401 })
  }

  if (evento !== 'push') {
    return NextResponse.json({ ok: true, ignorado: true })
  }

  if (!payload.commits || payload.commits.length === 0) {
    return NextResponse.json({ ok: true, ignorado: true })
  }

  const branch = payload.ref.replace('refs/heads/', '')

  const shasDoPush = payload.commits.map(c => c.id)
  const existentes = await prisma.tarefa.findMany({
    where: { projeto_id: projeto.id, github_commit_sha: { in: shasDoPush } },
    select: { github_commit_sha: true },
  })
  const jaCriados = new Set(existentes.map(t => t.github_commit_sha))

  const primeiraColuna = await prisma.projetoColuna.findFirst({
    where: { projeto_id: projeto.id },
    orderBy: { ordem: 'asc' },
  })

  const tarefasCriadas: string[] = []

  for (const commit of payload.commits) {
    if (jaCriados.has(commit.id)) continue // reentrega do webhook — evita duplicar

    const primeiraLinha = commit.message.split('\n')[0]
    const titulo = primeiraLinha.slice(0, 200).toUpperCase()
    const descricao = [
      commit.message,
      '',
      `Autor: ${commit.author.name}`,
      `Branch: ${branch}`,
      commit.url,
    ].join('\n')

    const tarefa = await prisma.tarefa.create({
      data: {
        titulo,
        descricao,
        projeto_id: projeto.id,
        coluna_id: primeiraColuna?.coluna_id,
        usuario_id: null,
        prioridade_id: PRIORIDADE_DIFICULDADE_PADRAO,
        dificuldade_id: PRIORIDADE_DIFICULDADE_PADRAO,
        concluida: false,
        github_commit_sha: commit.id,
      },
    })

    await prisma.historicoTarefa.create({
      data: {
        tarefa_id: tarefa.id,
        usuario_id: null,
        campo: 'CRIACAO',
        valor_novo: tarefa.titulo,
      },
    })

    tarefasCriadas.push(tarefa.id)
  }

  return NextResponse.json({ ok: true, tarefasCriadas })
}
