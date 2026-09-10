import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { decodeState, exchangeCodeForToken, fetchGithubUser } from '@/lib/github'
import { NONCE_COOKIE } from '../authorize/route'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.redirect(new URL('/login', req.url))

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) return NextResponse.redirect(new URL('/configuracoes/equipes', req.url))

  let equipeId: string
  let nonce: string
  try {
    ({ equipeId, nonce } = decodeState(state))
  } catch {
    return NextResponse.redirect(new URL('/configuracoes/equipes', req.url))
  }

  const cookieStore = await cookies()
  const nonceCookie = cookieStore.get(NONCE_COOKIE)?.value
  cookieStore.delete(NONCE_COOKIE)
  if (!nonceCookie || nonceCookie !== nonce) {
    return NextResponse.redirect(new URL(`/configuracoes/equipes/${equipeId}?github_erro=state_invalido`, req.url))
  }

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado || usuarioLogado.role !== 'OWNER') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const equipe = await prisma.equipe.findFirst({
    where: { id: equipeId, workspace_id: usuarioLogado.workspace_id },
  })
  if (!equipe) return NextResponse.redirect(new URL('/configuracoes/equipes', req.url))

  try {
    const accessToken = await exchangeCodeForToken(code)
    const githubUser = await fetchGithubUser(accessToken)

    await prisma.contaGithub.upsert({
      where: { equipe_id_github_account_id: { equipe_id: equipeId, github_account_id: githubUser.id } },
      update: { github_login: githubUser.login, access_token: accessToken },
      create: {
        equipe_id: equipeId,
        github_login: githubUser.login,
        github_account_id: githubUser.id,
        access_token: accessToken,
        criado_por_id: usuarioLogado.id,
      },
    })
  } catch {
    return NextResponse.redirect(new URL(`/configuracoes/equipes/${equipeId}?github_erro=falha_vinculo`, req.url))
  }

  return NextResponse.redirect(new URL(`/configuracoes/equipes/${equipeId}?github_ok=1`, req.url))
}
