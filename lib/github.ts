import crypto from 'crypto'

const GITHUB_API = 'https://api.github.com'

export function getAppUrl(): string {
  const url = process.env.APP_URL
  if (!url) throw new Error('APP_URL não configurada no .env')
  return url.replace(/\/$/, '')
}

export function buildAuthorizeUrl(equipeId: string, nonce: string): string {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  if (!clientId) throw new Error('GITHUB_OAUTH_CLIENT_ID não configurada no .env')

  const state = Buffer.from(JSON.stringify({ equipeId, nonce })).toString('base64url')
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'repo',
    state,
    redirect_uri: `${getAppUrl()}/api/integracoes/github/callback`,
  })
  return `https://github.com/login/oauth/authorize?${params.toString()}`
}

export function decodeState(state: string): { equipeId: string; nonce: string } {
  return JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Credenciais do OAuth App do GitHub não configuradas.')

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${getAppUrl()}/api/integracoes/github/callback`,
    }),
  })

  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || 'Falha ao trocar o código do GitHub pelo token de acesso.')
  }
  return data.access_token as string
}

export async function fetchGithubUser(token: string): Promise<{ id: number; login: string }> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error('Falha ao buscar o usuário autenticado no GitHub.')
  const data = await res.json()
  return { id: data.id, login: data.login }
}

export async function listUserRepos(token: string): Promise<{ id: number; full_name: string }[]> {
  const repos: { id: number; full_name: string }[] = []
  let page = 1

  while (true) {
    const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&sort=updated&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error('Falha ao listar repositórios do GitHub.')
    const data: { id: number; full_name: string }[] = await res.json()
    repos.push(...data.map(r => ({ id: r.id, full_name: r.full_name })))
    if (data.length < 100) break
    page++
  }

  return repos
}

export async function listRepoCommits(
  token: string,
  fullName: string,
  perPage = 30
): Promise<{ sha: string; message: string; author: string; url: string }[]> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/commits?per_page=${perPage}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error('Falha ao listar commits do repositório.')

  const data = await res.json()
  return data.map((c: { sha: string; commit: { message: string; author?: { name: string } }; author?: { login: string }; html_url: string }) => ({
    sha: c.sha,
    message: c.commit.message.split('\n')[0],
    author: c.commit.author?.name || c.author?.login || 'Desconhecido',
    url: c.html_url,
  }))
}

export async function createWebhook(token: string, fullName: string, secret: string): Promise<number> {
  const res = await fetch(`${GITHUB_API}/repos/${fullName}/hooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'web',
      active: true,
      events: ['push'],
      config: {
        url: `${getAppUrl()}/api/webhooks/github`,
        content_type: 'json',
        secret,
      },
    }),
  })
  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`Falha ao criar o webhook no repositório ${fullName}: ${erro}`)
  }
  const data = await res.json()
  return data.id as number
}

export async function deleteWebhook(token: string, fullName: string, hookId: number): Promise<void> {
  // Best-effort: se o repositório/hook já não existir mais, apenas ignora o erro.
  try {
    await fetch(`${GITHUB_API}/repos/${fullName}/hooks/${hookId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })
  } catch {
    // ignora — remoção é best-effort
  }
}

export function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false

  const esperado = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(esperado)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
