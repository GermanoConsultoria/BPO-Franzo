import type { MovimentoExtrato } from '@/types'
import { adicionarCabecalhoXlsx, adicionarCabecalhoTabelaXlsx, FORMATO_MOEDA_XLSX } from '@/lib/xlsx-cabecalho'

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

interface GerarXlsxExtratoParams {
  nomeCliente: string
  nomeBanco: string
  movimentos: MovimentoExtrato[]
  labelPeriodo: string
  saldoAtual: number
}

export async function gerarXlsxExtratoBanco({ nomeCliente, nomeBanco, movimentos, labelPeriodo, saldoAtual }: GerarXlsxExtratoParams): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('Extrato')

  adicionarCabecalhoXlsx(ws, `Extrato Bancário — ${nomeBanco}`, nomeCliente, labelPeriodo)
  adicionarCabecalhoTabelaXlsx(ws, ['Data', 'Descrição', 'Valor', 'Saldo Anterior', 'Saldo Atual'], 'FF4F46E5')

  for (const m of movimentos) {
    const row = ws.addRow([
      m.dt_pagamento ? formatarData(m.dt_pagamento) : '—',
      m.descricao,
      m.tipo === 'DESPESA' ? -m.valor : m.valor,
      m.saldo_anterior,
      m.saldo_atual,
    ])
    row.getCell(3).numFmt = FORMATO_MOEDA_XLSX
    row.getCell(3).font = { color: { argb: m.tipo === 'DESPESA' ? 'FFB91C1C' : 'FF047857' } }
    row.getCell(4).numFmt = FORMATO_MOEDA_XLSX
    row.getCell(5).numFmt = FORMATO_MOEDA_XLSX
  }

  ws.addRow([])
  const saldoRow = ws.addRow(['Saldo atual:', '', saldoAtual])
  saldoRow.getCell(1).font = { bold: true }
  saldoRow.getCell(3).font = { bold: true }
  saldoRow.getCell(3).numFmt = FORMATO_MOEDA_XLSX

  ws.columns = [{ width: 12 }, { width: 42 }, { width: 16 }, { width: 16 }, { width: 16 }]

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
