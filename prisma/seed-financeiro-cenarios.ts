// prisma/seed-financeiro-cenarios.ts
// Popula Contas a Pagar/Receber de uma equipe com CENÁRIOS de teste, pra observar
// o comportamento do módulo financeiro:
//   - vencidos (PENDENTE com dt_vencimento no passado) em vários graus de atraso
//   - pagos no prazo / adiantado / com atraso (dt_pagamento vs dt_vencimento)
//   - cancelados
//   - parcelamentos (grupo_parcela_id) com parcelas paga / vencida / futura
//   - recorrências MENSAL e SEMANAL
//   - vencendo hoje
//   - lançamentos sem beneficiário / sem nº de documento / valor alto / centavos
//   - pagamentos parciais: em aberto (restante > 0) e quitado via parciais
//
// Uso:
//   npx tsx prisma/seed-financeiro-cenarios.ts
//   EQUIPE_ID=<id> npx tsx prisma/seed-financeiro-cenarios.ts   (equipe específica)
//
// Idempotente: se já houver lançamentos com numero_documento começando em "CEN-"
// nessa equipe, não roda de novo. Pra forçar (cria duplicado):
//   FORCE=true npx tsx prisma/seed-financeiro-cenarios.ts
//
// Pra limpar só os cenários deste script:
//   LIMPAR=true npx tsx prisma/seed-financeiro-cenarios.ts
import { PrismaClient, TipoLancamento, StatusLancamento, Recorrencia } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

function addDias(base: Date, dias: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + dias)
  return d
}

async function catId(equipeId: string, tipo: TipoLancamento, nome: string) {
  let c = await prisma.planoContas.findFirst({ where: { equipe_id: equipeId, tipo, nome } })
  if (!c) c = await prisma.planoContas.create({ data: { equipe_id: equipeId, tipo, nome } })
  return c.id
}

type Linha = {
  tipo: TipoLancamento
  descricao: string
  beneficiario?: string | null
  valor: number
  categoria: string
  /** dias em relação a hoje (negativo = passado) */
  venceEm: number
  status: StatusLancamento
  /** dias em relação a hoje em que foi pago; só usado quando status = PAGO */
  pagoEm?: number
  doc?: string | null
  recorrencia?: Recorrencia
  grupo?: string
  numeroParcelas?: number
  parcelaAtual?: number
  /** pagamentos parciais: fração do valor total + dias em relação a hoje */
  parciais?: { fracao: number; em: number; obs?: string }[]
}

async function main() {
  const equipeId = process.env.EQUIPE_ID || (await prisma.equipe.findFirst())?.id
  if (!equipeId) throw new Error('Nenhuma equipe encontrada. Rode "npx tsx prisma/bootstrap-local.ts" primeiro.')
  const equipe = await prisma.equipe.findUnique({ where: { id: equipeId } })
  if (!equipe) throw new Error(`Equipe ${equipeId} não encontrada.`)

  if (process.env.LIMPAR === 'true') {
    const r = await prisma.lancamentoFinanceiro.deleteMany({
      where: { equipe_id: equipeId, numero_documento: { startsWith: 'CEN-' } },
    })
    console.log(`🧹 ${r.count} lançamento(s) de cenário removidos da equipe "${equipe.nome}".`)
    return
  }

  const jaTem = await prisma.lancamentoFinanceiro.count({
    where: { equipe_id: equipeId, numero_documento: { startsWith: 'CEN-' } },
  })
  if (jaTem > 0 && process.env.FORCE !== 'true') {
    console.log(`ℹ️  Já existem ${jaTem} lançamento(s) de cenário (CEN-*) na equipe "${equipe.nome}". Nada a fazer.`)
    console.log('   Forçar: FORCE=true npx tsx prisma/seed-financeiro-cenarios.ts')
    console.log('   Limpar: LIMPAR=true npx tsx prisma/seed-financeiro-cenarios.ts')
    return
  }

  const cat = {
    aluguel: await catId(equipeId, 'DESPESA', 'Aluguel'),
    fornecedores: await catId(equipeId, 'DESPESA', 'Fornecedores'),
    impostos: await catId(equipeId, 'DESPESA', 'Impostos'),
    marketing: await catId(equipeId, 'DESPESA', 'Marketing'),
    salarios: await catId(equipeId, 'DESPESA', 'Salários'),
    mensalidades: await catId(equipeId, 'RECEITA', 'Mensalidades'),
    servicos: await catId(equipeId, 'RECEITA', 'Serviços'),
    vendas: await catId(equipeId, 'RECEITA', 'Vendas'),
  } as Record<string, string>

  const grpNotebooks = randomUUID()
  const grpWms = randomUUID()

  const linhas: Linha[] = [
    // ---------- DESPESAS: vencidas em graus crescentes de atraso ----------
    { tipo: 'DESPESA', descricao: 'Conta de energia elétrica', beneficiario: 'CPFL Energia', valor: 842.17, categoria: 'fornecedores', venceEm: -2, status: 'PENDENTE', doc: 'CEN-D01' },
    { tipo: 'DESPESA', descricao: 'Internet link dedicado', beneficiario: 'Vivo Empresas', valor: 399.90, categoria: 'fornecedores', venceEm: -11, status: 'PENDENTE', doc: 'CEN-D02' },
    { tipo: 'DESPESA', descricao: 'Honorários contábeis', beneficiario: 'Contabilidade Prisma', valor: 1200, categoria: 'fornecedores', venceEm: -45, status: 'PENDENTE', doc: 'CEN-D03' },
    { tipo: 'DESPESA', descricao: 'Multa contratual (fornecedor antigo)', beneficiario: 'XPTO Serviços', valor: 5780, categoria: 'fornecedores', venceEm: -128, status: 'PENDENTE', doc: 'CEN-D04' },

    // ---------- DESPESAS: pagas — no prazo / adiantado / com atraso ----------
    { tipo: 'DESPESA', descricao: 'IPTU 2026', beneficiario: 'Prefeitura Municipal', valor: 2340.55, categoria: 'impostos', venceEm: -30, status: 'PAGO', pagoEm: -19, doc: 'CEN-D05' }, // pago 11 dias atrasado
    { tipo: 'DESPESA', descricao: 'Seguro empresarial anual', beneficiario: 'Porto Seguro', valor: 3600, categoria: 'fornecedores', venceEm: -3, status: 'PAGO', pagoEm: -9, doc: 'CEN-D06' }, // pago 6 dias adiantado
    { tipo: 'DESPESA', descricao: 'Folha de pagamento (agosto)', beneficiario: 'RH Interno', valor: 18750, categoria: 'salarios', venceEm: -1, status: 'PAGO', pagoEm: -1, doc: 'CEN-D07' }, // pago no dia

    // ---------- DESPESAS: vencendo hoje / em breve ----------
    { tipo: 'DESPESA', descricao: 'Vale-transporte da equipe', beneficiario: 'RH Interno', valor: 1080, categoria: 'salarios', venceEm: 0, status: 'PENDENTE', doc: 'CEN-D08' },
    { tipo: 'DESPESA', descricao: 'Assinaturas de software (Figma, Slack)', beneficiario: null, valor: 227.40, categoria: 'fornecedores', venceEm: 3, status: 'PENDENTE', doc: 'CEN-D09' },

    // ---------- DESPESA: cancelada ----------
    { tipo: 'DESPESA', descricao: 'Evento corporativo (cancelado)', beneficiario: 'Buffet Central', valor: 8500, categoria: 'marketing', venceEm: -7, status: 'CANCELADO', doc: 'CEN-D10' },

    // ---------- DESPESAS: recorrentes (modelo PENDENTE que gera o próximo ao pagar) ----------
    { tipo: 'DESPESA', descricao: 'Colocation / data center', beneficiario: 'HostDC', valor: 950, categoria: 'fornecedores', venceEm: 5, status: 'PENDENTE', doc: 'CEN-D11', recorrencia: 'MENSALMENTE' },
    { tipo: 'DESPESA', descricao: 'Serviço de limpeza semanal', beneficiario: 'Limpa Tudo ME', valor: 320, categoria: 'fornecedores', venceEm: 2, status: 'PENDENTE', doc: 'CEN-D12', recorrencia: 'SEMANALMENTE' },

    // ---------- DESPESA: valor alto, futuro ----------
    { tipo: 'DESPESA', descricao: 'Aquisição de servidores', beneficiario: 'Dell Brasil', valor: 87450, categoria: 'fornecedores', venceEm: 20, status: 'PENDENTE', doc: 'CEN-D13' },

    // ---------- DESPESA: parcelamento 4x (paga / paga / vence hoje / futura) ----------
    { tipo: 'DESPESA', descricao: 'Notebooks para a equipe (4x)', beneficiario: 'Dell Brasil', valor: 2750, categoria: 'fornecedores', venceEm: -60, status: 'PAGO', pagoEm: -60, doc: 'CEN-D14', grupo: grpNotebooks, numeroParcelas: 4, parcelaAtual: 1 },
    { tipo: 'DESPESA', descricao: 'Notebooks para a equipe (4x)', beneficiario: 'Dell Brasil', valor: 2750, categoria: 'fornecedores', venceEm: -30, status: 'PAGO', pagoEm: -28, doc: 'CEN-D14', grupo: grpNotebooks, numeroParcelas: 4, parcelaAtual: 2 },
    { tipo: 'DESPESA', descricao: 'Notebooks para a equipe (4x)', beneficiario: 'Dell Brasil', valor: 2750, categoria: 'fornecedores', venceEm: 0, status: 'PENDENTE', doc: 'CEN-D14', grupo: grpNotebooks, numeroParcelas: 4, parcelaAtual: 3 },
    { tipo: 'DESPESA', descricao: 'Notebooks para a equipe (4x)', beneficiario: 'Dell Brasil', valor: 2750, categoria: 'fornecedores', venceEm: 30, status: 'PENDENTE', doc: 'CEN-D14', grupo: grpNotebooks, numeroParcelas: 4, parcelaAtual: 4 },

    // ---------- DESPESA: pagamento parcial em aberto (pagou metade, falta metade) ----------
    { tipo: 'DESPESA', descricao: 'Reforma da sala de reuniões', beneficiario: 'Construtora Alvorada', valor: 6400, categoria: 'fornecedores', venceEm: 10, status: 'PENDENTE', doc: 'CEN-D15',
      parciais: [{ fracao: 0.5, em: -5, obs: 'Sinal de 50%' }] },

    // ---------- DESPESA: quase quitada via parciais (2 parciais, falta pouco) ----------
    { tipo: 'DESPESA', descricao: 'Compra de mobiliário novo', beneficiario: 'Móveis Corporativos SA', valor: 4200, categoria: 'fornecedores', venceEm: 5, status: 'PENDENTE', doc: 'CEN-D16',
      parciais: [{ fracao: 0.4, em: -10, obs: 'Entrada' }, { fracao: 0.35, em: -3, obs: '2ª parcela negociada' }] },

    // ---------- RECEITAS: vencidas (inadimplência) ----------
    { tipo: 'RECEITA', descricao: 'Mensalidade Onblox — Atacado Norte', valor: 2900, categoria: 'mensalidades', venceEm: -4, status: 'PENDENTE', doc: 'CEN-R01' },
    { tipo: 'RECEITA', descricao: 'Projeto BI — Cliente Delta', valor: 14500, categoria: 'servicos', venceEm: -22, status: 'PENDENTE', doc: 'CEN-R02' },
    { tipo: 'RECEITA', descricao: 'Treinamento in company — Cliente Ômega', valor: 4200, categoria: 'servicos', venceEm: -80, status: 'PENDENTE', doc: 'CEN-R03' },

    // ---------- RECEITAS: recebidas — com atraso / no dia ----------
    { tipo: 'RECEITA', descricao: 'Licença anual — Cliente Sigma', valor: 9800, categoria: 'vendas', venceEm: -40, status: 'PAGO', pagoEm: -25, doc: 'CEN-R04' }, // recebido 15 dias atrasado
    { tipo: 'RECEITA', descricao: 'Consultoria avulsa — Cliente Kappa', valor: 3500, categoria: 'servicos', venceEm: -1, status: 'PAGO', pagoEm: 0, doc: 'CEN-R05' }, // recebido hoje

    // ---------- RECEITAS: vencendo hoje / sem nº doc ----------
    { tipo: 'RECEITA', descricao: 'Mensalidade Onblox — Varejo Oeste', valor: 3100, categoria: 'mensalidades', venceEm: 0, status: 'PENDENTE', doc: 'CEN-R06' },
    { tipo: 'RECEITA', descricao: 'Reembolso de despesas de evento', valor: 512.33, categoria: 'vendas', venceEm: -2, status: 'PENDENTE', doc: 'CEN-R07' },

    // ---------- RECEITA: cancelada ----------
    { tipo: 'RECEITA', descricao: 'Setup inicial — cliente que desistiu', valor: 7000, categoria: 'servicos', venceEm: -12, status: 'CANCELADO', doc: 'CEN-R08' },

    // ---------- RECEITA: recorrente mensal ----------
    { tipo: 'RECEITA', descricao: 'Assinatura SaaS — Cliente Gamma', valor: 690, categoria: 'mensalidades', venceEm: 7, status: 'PENDENTE', doc: 'CEN-R09', recorrencia: 'MENSALMENTE' },

    // ---------- RECEITA: contrato grande, futuro ----------
    { tipo: 'RECEITA', descricao: 'Contrato anual — Cliente Zeta (sinal)', valor: 30000, categoria: 'servicos', venceEm: 60, status: 'PENDENTE', doc: 'CEN-R10' },

    // ---------- RECEITA: parcelamento 3x (recebida / vencida / futura) ----------
    { tipo: 'RECEITA', descricao: 'Implantação WMS — Cliente Beta (3x)', valor: 10000, categoria: 'servicos', venceEm: -35, status: 'PAGO', pagoEm: -33, doc: 'CEN-R11', grupo: grpWms, numeroParcelas: 3, parcelaAtual: 1 },
    { tipo: 'RECEITA', descricao: 'Implantação WMS — Cliente Beta (3x)', valor: 10000, categoria: 'servicos', venceEm: -5, status: 'PENDENTE', doc: 'CEN-R11', grupo: grpWms, numeroParcelas: 3, parcelaAtual: 2 },
    { tipo: 'RECEITA', descricao: 'Implantação WMS — Cliente Beta (3x)', valor: 10000, categoria: 'servicos', venceEm: 25, status: 'PENDENTE', doc: 'CEN-R11', grupo: grpWms, numeroParcelas: 3, parcelaAtual: 3 },

    // ---------- RECEITA: recebimento parcial em aberto ----------
    { tipo: 'RECEITA', descricao: 'Projeto de automação — Cliente Theta', valor: 22000, categoria: 'servicos', venceEm: 15, status: 'PENDENTE', doc: 'CEN-R12',
      parciais: [{ fracao: 0.3, em: -8, obs: 'Adiantamento na assinatura do contrato' }] },

    // ---------- RECEITA: quitada via parciais (soma dos parciais == valor → vira PAGO) ----------
    { tipo: 'RECEITA', descricao: 'Consultoria pontual — Cliente Rho', valor: 5000, categoria: 'servicos', venceEm: -6, status: 'PENDENTE', doc: 'CEN-R13',
      parciais: [{ fracao: 0.6, em: -14, obs: '1ª metade' }, { fracao: 0.4, em: -6, obs: '2ª metade — quitação' }] },
  ]

  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)

  let criados = 0
  let parciaisCriados = 0
  for (const l of linhas) {
    const somaParciais = (l.parciais ?? []).reduce((s, p) => s + Math.round(l.valor * p.fracao * 100) / 100, 0)
    const quitaViaParciais = !!l.parciais?.length && somaParciais >= l.valor - 0.01

    const criado = await prisma.lancamentoFinanceiro.create({
      data: {
        equipe_id: equipeId,
        tipo: l.tipo,
        descricao: l.descricao,
        beneficiario: l.tipo === 'DESPESA' ? (l.beneficiario ?? null) : null,
        valor: l.valor,
        dt_vencimento: addDias(hoje, l.venceEm),
        dt_pagamento: l.status === 'PAGO' ? addDias(hoje, l.pagoEm ?? l.venceEm)
          : quitaViaParciais ? addDias(hoje, l.parciais![l.parciais!.length - 1].em)
          : null,
        numero_documento: l.doc ?? null,
        plano_contas_id: cat[l.categoria],
        status: quitaViaParciais ? 'PAGO' : l.status,
        recorrencia: l.recorrencia ?? 'NAO',
        numero_parcelas: l.numeroParcelas ?? null,
        parcela_atual: l.parcelaAtual ?? null,
        grupo_parcela_id: l.grupo ?? null,
      },
    })
    criados++

    for (const p of l.parciais ?? []) {
      await prisma.pagamentoParcial.create({
        data: {
          lancamento_id: criado.id,
          valor: Math.round(l.valor * p.fracao * 100) / 100,
          dt_pagamento: addDias(hoje, p.em),
          observacao: p.obs ?? null,
        },
      })
      parciaisCriados++
    }
  }

  const despesas = linhas.filter(l => l.tipo === 'DESPESA').length
  const receitas = linhas.length - despesas
  console.log(`✅ ${criados} lançamentos de cenário criados (${despesas} despesas, ${receitas} receitas) na equipe "${equipe.nome}".`)
  console.log(`✅ ${parciaisCriados} pagamento(s) parcial(is) criado(s) (cenários CEN-D15, CEN-D16, CEN-R12, CEN-R13).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
