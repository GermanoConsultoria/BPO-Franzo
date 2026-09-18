import jsPDF from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { MovimentoExtrato } from '@/types'

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

interface GerarPdfExtratoParams {
  nomeBanco: string
  movimentos: MovimentoExtrato[]
  labelPeriodo: string
  saldoAtual: number
}

export function gerarPdfExtratoBanco({ nomeBanco, movimentos, labelPeriodo, saldoAtual }: GerarPdfExtratoParams): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20)
  doc.text('Extrato Bancário', 14, 16)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(70)
  doc.text(nomeBanco, 14, 23)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text(`Período: ${labelPeriodo}`, 14, 29)
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    14,
    34
  )

  const linhas = movimentos.map(m => [
    m.dt_pagamento ? formatarData(m.dt_pagamento) : '—',
    m.descricao,
    `${m.tipo === 'DESPESA' ? '-' : '+'} ${formatarMoeda(m.valor)}`,
    m.saldo_anterior !== null ? formatarMoeda(m.saldo_anterior) : '—',
    m.saldo_atual !== null ? formatarMoeda(m.saldo_atual) : '—',
  ])

  autoTable(doc, {
    startY: 39,
    head: [['Data', 'Descrição', 'Valor', 'Saldo Anterior', 'Saldo Atual']],
    body: linhas,
    styles: { fontSize: 9, cellPadding: 2.5, textColor: 30 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const movimento = movimentos[data.row.index]
        if (movimento) data.cell.styles.textColor = movimento.tipo === 'DESPESA' ? [185, 28, 28] : [4, 120, 87]
      }
    },
  })

  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20)
  doc.text(`Saldo atual: ${formatarMoeda(saldoAtual)}`, 14, y)

  const totalPaginas = doc.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150)
    const largura = doc.internal.pageSize.getWidth()
    const altura = doc.internal.pageSize.getHeight()
    doc.text(`Página ${i} de ${totalPaginas}`, largura - 14, altura - 8, { align: 'right' })
  }

  return doc.output('blob')
}
