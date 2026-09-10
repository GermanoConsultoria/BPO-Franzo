import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { buildAuthorizeUrl } from '@/lib/github'

export const NONCE_COOKIE = 'github_oauth_nonce'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.redirect(new URL('/login', req.url))

  const usuarioLogado = await prisma.usuario.findUnique({ where: { email: session.user.email } })
  if (!usuarioLogado || usuarioLogado.role !== 'OWNER') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const { searchParams } = new URL(req.url)
  const equipeId = searchParams.get('equipeId')
  if (!equipeId) return NextResponse.redirect(new URL('/configuracoes/equipes', req.url))

  const equipe = await prisma.equipe.findFirst({
    where: { id: equipeId, workspace_id: usuarioLogado.workspace_id },
  })
  if (!equipe) return NextResponse.redirect(new URL('/configuracoes/equipes', req.url))

  const nonce = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return NextResponse.redirect(buildAuthorizeUrl(equipeId, nonce))
}
