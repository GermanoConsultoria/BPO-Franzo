import type { Worksheet } from 'exceljs'

export const FORMATO_MOEDA_XLSX = '"R$" #,##0.00'

/** Cabeçalho padrão das planilhas exportadas: título, nome do cliente,
 * período e data/hora de geração — mesmo conteúdo usado no cabeçalho dos PDFs. */
export function adicionarCabecalhoXlsx(ws: Worksheet, titulo: string, nomeCliente: string, labelPeriodo: string) {
  const rTitulo = ws.addRow([titulo])
  rTitulo.getCell(1).font = { bold: true, size: 14 }

  const rCliente = ws.addRow([nomeCliente])
  rCliente.getCell(1).font = { bold: true, size: 11 }

  ws.addRow([`Período: ${labelPeriodo}`])
  ws.addRow([
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
  ])
  ws.addRow([])
}

export function adicionarCabecalhoTabelaXlsx(ws: Worksheet, colunas: string[], corFundo: string) {
  const row = ws.addRow(colunas)
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corFundo } }
  })
  return row
}
