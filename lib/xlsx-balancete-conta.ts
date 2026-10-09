import { adicionarCabecalhoXlsx, adicionarCabecalhoTabelaXlsx, FORMATO_MOEDA_XLSX } from '@/lib/xlsx-cabecalho'
import { totalPorMes, type MesPeriodo } from '@/lib/balancete-periodo'

interface ItemConta {
  plano_contas_id: string
  nome: string
  total: number
}

interface LancamentoConta {
  descricao: string
  valor: number
  status: string
  dt_vencimento: Date | string
}

const STATUS_LABEL: Record<string, string> = {
  PAGO: 'Pago',
  PENDENTE: 'Pendente',
  CANCELADO: 'Cancelado',
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function corArgb([r, g, b]: [number, number, number]) {
  const hex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase()
  return `FF${hex(r)}${hex(g)}${hex(b)}`
}

interface ParamsBase {
  titulo: string
  nomeCliente: string
  itens: ItemConta[]
  total: number
  labelPeriodo: string
  corDestaque: [number, number, number]
  /** Quando há mais de um mês no período filtrado, quebra o total de cada conta por mês. */
  meses?: MesPeriodo[]
  lancamentosPorConta?: Record<string, LancamentoConta[]>
}

export async function gerarXlsxContaResumo({ titulo, nomeCliente, itens, total, labelPeriodo, corDestaque, meses, lancamentosPorConta }: ParamsBase): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet(titulo)

  adicionarCabecalhoXlsx(ws, titulo, nomeCliente, labelPeriodo)

  const ordenados = [...itens].sort((a, b) => b.total - a.total)
  const usarMatriz = !!meses && meses.length > 1 && !!lancamentosPorConta

  if (usarMatriz && meses && lancamentosPorConta) {
    adicionarCabecalhoTabelaXlsx(ws, ['Conta', ...meses.map(m => m.label), 'Total', '%'], corArgb(corDestaque))

    const colTotal = meses.length + 2
    const colPercentual = meses.length + 3

    for (const item of ordenados) {
      const lancamentos = lancamentosPorConta[item.plano_contas_id] ?? []
      const linha = [item.nome, ...meses.map(m => totalPorMes(lancamentos, m.chave)), Number(item.total), total > 0 ? item.total / total : 0]
      const row = ws.addRow(linha)
      for (let i = 2; i <= colTotal; i++) row.getCell(i).numFmt = FORMATO_MOEDA_XLSX
      row.getCell(colPercentual).numFmt = '0.0%'
    }

    const totalPorMesGeral = meses.map(m =>
      ordenados.reduce((s, item) => s + totalPorMes(lancamentosPorConta[item.plano_contas_id] ?? [], m.chave), 0)
    )
    const rowTotal = ws.addRow(['Total', ...totalPorMesGeral, Number(total), total > 0 ? 1 : 0])
    rowTotal.font = { bold: true }
    for (let i = 2; i <= colTotal; i++) rowTotal.getCell(i).numFmt = FORMATO_MOEDA_XLSX
    rowTotal.getCell(colPercentual).numFmt = '0.0%'

    ws.columns = [{ width: 36 }, ...meses.map(() => ({ width: 14 })), { width: 18 }, { width: 10 }]
  } else {
    adicionarCabecalhoTabelaXlsx(ws, ['Conta', 'Total', '%'], corArgb(corDestaque))

    for (const item of ordenados) {
      const row = ws.addRow([item.nome, Number(item.total), total > 0 ? item.total / total : 0])
      row.getCell(2).numFmt = FORMATO_MOEDA_XLSX
      row.getCell(3).numFmt = '0.0%'
    }

    const rowTotal = ws.addRow(['Total', Number(total), total > 0 ? 1 : 0])
    rowTotal.font = { bold: true }
    rowTotal.getCell(2).numFmt = FORMATO_MOEDA_XLSX
    rowTotal.getCell(3).numFmt = '0.0%'

    ws.columns = [{ width: 36 }, { width: 18 }, { width: 10 }]
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

interface ParamsDetalhado extends ParamsBase {
  lancamentosPorConta: Record<string, LancamentoConta[]>
}

export async function gerarXlsxContaDetalhado({ titulo, nomeCliente, itens, labelPeriodo, corDestaque, lancamentosPorConta }: ParamsDetalhado): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet(titulo)

  adicionarCabecalhoXlsx(ws, titulo, nomeCliente, labelPeriodo)

  const ordenados = [...itens].sort((a, b) => b.total - a.total)
  const corFundo = corArgb(corDestaque)

  for (const item of ordenados) {
    const rTitulo = ws.addRow([`${item.nome} — ${item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`])
    rTitulo.getCell(1).font = { bold: true, size: 11 }

    const lancamentos = lancamentosPorConta[item.plano_contas_id] ?? []
    if (lancamentos.length === 0) {
      ws.addRow(['Nenhum lançamento.'])
      ws.addRow([])
      continue
    }

    adicionarCabecalhoTabelaXlsx(ws, ['Descrição', 'Status', 'Vencimento', 'Valor'], corFundo)
    for (const l of lancamentos) {
      const row = ws.addRow([l.descricao, STATUS_LABEL[l.status] ?? l.status, formatarData(l.dt_vencimento), Number(l.valor)])
      row.getCell(4).numFmt = FORMATO_MOEDA_XLSX
    }
    ws.addRow([])
  }

  ws.columns = [{ width: 36 }, { width: 14 }, { width: 14 }, { width: 16 }]

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
