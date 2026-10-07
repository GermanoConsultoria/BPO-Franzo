import jsPDF from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { desenharCabecalhoPdf, desenharRodapePdf, INICIO_CONTEUDO_PDF } from '@/lib/pdf-cabecalho'
import type { MovimentoExtrato } from '@/types'

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

interface GerarPdfExtratoParams {
  nomeCliente: string
  nomeBanco: string
  movimentos: MovimentoExtrato[]
  labelPeriodo: string
  saldoAtual: number
}

export function gerarPdfExtratoBanco({ nomeCliente, nomeBanco, movimentos, labelPeriodo, saldoAtual }: GerarPdfExtratoParams): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  desenharCabecalhoPdf(doc, `Extrato Bancário — ${nomeBanco}`, nomeCliente, labelPeriodo)

  const linhas = movimentos.map(m => [
    m.dt_pagamento ? formatarData(m.dt_pagamento) : '—',
    m.descricao,
    m.origem === 'INVESTIMENTO' ? 'Investimento' : 'Lançamento',
    `${(m.tipo === 'DESPESA' || m.tipo === 'RESGATE') ? '-' : '+'} ${formatarMoeda(m.valor)}`,
    m.saldo_anterior !== null ? formatarMoeda(m.saldo_anterior) : '—',
    m.saldo_atual !== null ? formatarMoeda(m.saldo_atual) : '—',
  ])

  autoTable(doc, {
    startY: INICIO_CONTEUDO_PDF,
    head: [['Data', 'Descrição', 'Origem', 'Valor', 'Saldo Anterior', 'Saldo Atual']],
    body: linhas,
    styles: { fontSize: 9, cellPadding: 2.5, textColor: 30 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const movimento = movimentos[data.row.index]
        if (movimento) data.cell.styles.textColor = (movimento.tipo === 'DESPESA' || movimento.tipo === 'RESGATE') ? [185, 28, 28] : [4, 120, 87]
      }
    },
  })

  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20)
  doc.text(`Saldo atual: ${formatarMoeda(saldoAtual)}`, 14, y)

  desenharRodapePdf(doc)
  return doc.output('blob')
}
