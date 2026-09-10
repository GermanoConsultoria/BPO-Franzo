import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import DashboardUI from '@/components/DashboardUI'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type StatusTarefa = 'concluidas' | 'atrasadas' | 'pendentes'

type TarefaLinha = {
  titulo: string
  projeto: string
  etapa: string
  status: StatusTarefa
  vencimento: string | null
}

type DadosTarefasUsuario = {
  nome: string
  total: number
  concluidas: number
  atrasadas: number
  pendentes: number
  tarefas: TarefaLinha[]
}

type EtapaPendente = {
  nome: string
  pendentes: number
  atrasadas: number
  concluidas: number
  tarefas: { titulo: string; status: StatusTarefa; vencimento: string | null }[]
}

type DadosProjetoEtapas = {
  nome: string
  totalRestante: number
  etapas: EtapaPendente[]
}

type Props = {
  params: Promise<{ equipeId: string }>
  searchParams: Promise<{ [key: string]: string | undefined }>
}

export default async function DashboardsPage(props: Props) {
  const { equipeId } = await props.params
  const searchParams = await props.searchParams
  
  const session = await auth()
  if (!session?.user?.email) redirect('/login')
  
  const hoje = new Date()

  // --- 1. LÓGICA DE FILTROS ---
  const urlInicio = searchParams?.inicio
  const urlFim = searchParams?.fim
  const filtroProjetoId = searchParams?.projetoId
  const filtroUsuarioId = searchParams?.usuarioId

  let dataInicio: Date, dataFim: Date;

  if (urlInicio) {
      const [ano, mes, dia] = urlInicio.split('-').map(Number)
      dataInicio = new Date(ano, mes - 1, dia, 0, 0, 0)
  } else {
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0)
  }

  if (urlFim) {
      const [ano, mes, dia] = urlFim.split('-').map(Number)
      dataFim = new Date(ano, mes - 1, dia, 23, 59, 59, 999)
  } else {
      dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999)
  }

  // --- 2. LISTAS PARA SELECT (Filtradas pela Equipe) ---
  const listaProjetos = await prisma.projeto.findMany({
      where: { equipe_id: equipeId, ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true }
  })

  const listaUsuarios = await prisma.usuario.findMany({
      where: { 
          equipes: { some: { equipe_id: equipeId } },
          ativo: true 
      },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true }
  })

  // --- 3. TAREFAS (Filtradas pela Equipe) ---
  const whereClause: Prisma.TarefaWhereInput = {
      projeto: { equipe_id: equipeId, ativo: true },
      OR: [
        { dt_vencimento: { gte: dataInicio, lte: dataFim } },
        { dt_conclusao: { gte: dataInicio, lte: dataFim } }
      ],
      ...(filtroProjetoId && { projeto_id: filtroProjetoId }),
      ...(filtroUsuarioId && { usuario_id: filtroUsuarioId }),
  }

  const tarefas = await prisma.tarefa.findMany({
    where: whereClause,
    include: { projeto: true, usuario: true, coluna: true }
  })

  // --- 4. HISTÓRICO (Filtrado pela Equipe) ---
  const historicoDeDatas = await prisma.historicoTarefa.findMany({
      where: {
          campo: 'DT_VENCIMENTO',
          tarefa: { 
              projeto: { equipe_id: equipeId },
              ...(filtroProjetoId ? { projeto_id: filtroProjetoId } : {}),
              ...(filtroUsuarioId ? { usuario_id: filtroUsuarioId } : {}) 
          }
      },
      include: { tarefa: { include: { projeto: true } } }
  })

  const historicoFiltrado = historicoDeDatas.filter(h => {
      if (!h.valor_antigo || h.valor_antigo === 'Sem data') return false;
      const partes = h.valor_antigo.split('/'); 
      if (partes.length !== 3) return false;
      const dataOriginal = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
      return dataOriginal >= dataInicio && dataOriginal <= dataFim;
  })

  // --- 5. PROCESSAMENTO DE DADOS (Mantido Intacto) ---
  const agora = new Date()

  // Filtro de status vindo dos cards de KPI clicáveis (?status=concluidas|atrasadas|pendentes)
  // Ausente = "Total" (mostra tudo). Afeta apenas os gráficos; os números dos cards continuam totais.
  const filtroStatus = searchParams?.status

  const statusDaTarefa = (t: (typeof tarefas)[number]): 'concluidas' | 'atrasadas' | 'pendentes' => {
      if (t.concluida) return 'concluidas'
      if (t.dt_vencimento && new Date(t.dt_vencimento) < agora) return 'atrasadas'
      return 'pendentes'
  }

  const tarefasFiltradas =
      filtroStatus === 'concluidas' || filtroStatus === 'atrasadas' || filtroStatus === 'pendentes'
          ? tarefas.filter(t => statusDaTarefa(t) === filtroStatus)
          : tarefas

  const resumoGeral = {
      total: tarefas.length,
      concluidas: tarefas.filter(t => t.concluida).length,
      atrasadas: tarefas.filter(t => !t.concluida && t.dt_vencimento && new Date(t.dt_vencimento) < agora).length,
      pendentes: tarefas.filter(t => !t.concluida && t.dt_vencimento && new Date(t.dt_vencimento) > agora).length,
      taxaPendente: 0, taxaAtraso: 0, taxaConclusao: 0
  }
  resumoGeral.taxaConclusao = resumoGeral.total > 0 ? Math.round((resumoGeral.concluidas / resumoGeral.total) * 100) : 0
  resumoGeral.taxaAtraso = resumoGeral.total > 0 ? Math.round((resumoGeral.atrasadas / resumoGeral.total) * 100) : 0
  resumoGeral.taxaPendente = resumoGeral.total > 0 ? Math.round((resumoGeral.pendentes / resumoGeral.total) * 100) : 0

  const mapaProjetos = new Map()
  const mapaUsuarios = new Map()
  const mapaEtapas = new Map()

  tarefasFiltradas.forEach(t => {
      let isConcluida = false, isAtrasada = false, isPendente = false
      if (t.concluida) {
          isConcluida = true
      } else if (t.dt_vencimento && new Date(t.dt_vencimento) < agora) {
          isAtrasada = true
      } else {
          isPendente = true
      }

      const pNome = t.projeto.nome
      if (!mapaProjetos.has(pNome)) mapaProjetos.set(pNome, { nome: pNome, total: 0, concluidas: 0, pendentes: 0, atrasadas: 0 })
      const p = mapaProjetos.get(pNome)
      p.total++
      if (isConcluida) p.concluidas++; else if (isAtrasada) p.atrasadas++; else if (isPendente) p.pendentes++; 

      const uNome = t.usuario?.nome || 'Sem Dono'
      if (!mapaUsuarios.has(uNome)) mapaUsuarios.set(uNome, { nome: uNome, concluidas: 0, atrasadas: 0, pendentes: 0, total: 0 })
      const u = mapaUsuarios.get(uNome)
      u.total++
      if (isConcluida) u.concluidas++; else if (isAtrasada) u.atrasadas++; else if (isPendente) u.pendentes++;

      // Sem filtro: "Volume por Etapa" mostra só o trabalho restante (não concluído).
      // Com filtro de status ativo, respeita o filtro (inclusive concluídas).
      if (filtroStatus || !isConcluida) {
          const eNome = t.coluna?.nome || 'Não Classificado'
          if (!mapaEtapas.has(eNome)) mapaEtapas.set(eNome, { name: eNome, qtd: 0 })
          mapaEtapas.get(eNome).qtd++
      }
  })

  // --- 5b. DETALHAMENTO PARA AS TABELAS (abaixo do gráfico) ---
  const chaveStatus = (t: (typeof tarefas)[number]): StatusTarefa => {
      if (t.concluida) return 'concluidas'
      if (t.dt_vencimento && new Date(t.dt_vencimento) < agora) return 'atrasadas'
      return 'pendentes'
  }
  const formatarVenc = (d: Date | null) =>
      d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : null

  const mapaTarefasUsuario = new Map<string, DadosTarefasUsuario>()
  const mapaProjetoEtapas = new Map<string, Map<string, EtapaPendente>>()

  tarefasFiltradas.forEach(t => {
      const st = chaveStatus(t)
      const venc = formatarVenc(t.dt_vencimento)
      const etapaNome = t.coluna?.nome || 'Não Classificado'

      const uNome = t.usuario?.nome || 'Sem Dono'
      if (!mapaTarefasUsuario.has(uNome)) {
          mapaTarefasUsuario.set(uNome, { nome: uNome, total: 0, concluidas: 0, atrasadas: 0, pendentes: 0, tarefas: [] })
      }
      const u = mapaTarefasUsuario.get(uNome)!
      u.total++
      u[st]++
      u.tarefas.push({ titulo: t.titulo, projeto: t.projeto.nome, etapa: etapaNome, status: st, vencimento: venc })

      // Sem filtro: tabela lista só etapas com trabalho em aberto (pendente/atrasado).
      // Com filtro de status ativo, respeita o filtro (inclusive concluídas).
      if (filtroStatus || st !== 'concluidas') {
          const pNome = t.projeto.nome
          if (!mapaProjetoEtapas.has(pNome)) mapaProjetoEtapas.set(pNome, new Map())
          const etapas = mapaProjetoEtapas.get(pNome)!
          if (!etapas.has(etapaNome)) etapas.set(etapaNome, { nome: etapaNome, pendentes: 0, atrasadas: 0, concluidas: 0, tarefas: [] })
          const e = etapas.get(etapaNome)!
          e[st]++
          e.tarefas.push({ titulo: t.titulo, status: st, vencimento: venc })
      }
  })

  const dadosTarefasUsuario = Array.from(mapaTarefasUsuario.values()).sort((a, b) => b.total - a.total)
  const dadosProjetoEtapas: DadosProjetoEtapas[] = Array.from(mapaProjetoEtapas.entries())
      .map(([nome, etapas]) => {
          const peso = (e: EtapaPendente) => e.pendentes + e.atrasadas + e.concluidas
          const lista = Array.from(etapas.values()).sort((a, b) => peso(b) - peso(a))
          return { nome, totalRestante: lista.reduce((acc, e) => acc + peso(e), 0), etapas: lista }
      })
      .sort((a, b) => b.totalRestante - a.totalRestante)

  const mapaHistoricoProj = new Map()
  historicoFiltrado.forEach(h => {
      const pNome = h.tarefa.projeto.nome
      if (!mapaHistoricoProj.has(pNome)) mapaHistoricoProj.set(pNome, { projeto: pNome, qtd: 0 })
      mapaHistoricoProj.get(pNome).qtd++
  })

  return (
    <div className="p-8 h-full overflow-y-auto bg-background">
      <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboards da Equipe</h1>
      </header>
      
      <DashboardUI 
          dadosProjetos={Array.from(mapaProjetos.values())}
          dadosUsuarios={Array.from(mapaUsuarios.values())}
          dadosEtapas={Array.from(mapaEtapas.values())}
          dadosHistorico={Array.from(mapaHistoricoProj.values())}
          dadosTarefasUsuario={dadosTarefasUsuario}
          dadosProjetoEtapas={dadosProjetoEtapas}
          resumoGeral={resumoGeral}
          listaProjetos={listaProjetos}
          listaUsuarios={listaUsuarios}
          statusAtivo={
              filtroStatus === 'concluidas' || filtroStatus === 'atrasadas' || filtroStatus === 'pendentes'
                  ? filtroStatus
                  : ''
          }
      />
    </div>
  )
}