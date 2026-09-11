import jsPDF from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { LancamentoComRelacoes, TipoLancamento, StatusLancamento } from '@/types'

const STATUS_LABEL: Record<StatusLancamento, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function totalParciais(l: LancamentoComRelacoes) {
  return (l.parciais ?? []).reduce((s, p) => s + Number(p.valor), 0)
}

function restanteDe(l: LancamentoComRelacoes) {
  return Math.max(0, Math.round((Number(l.valor) - totalParciais(l)) * 100) / 100)
}

interface GerarPdfParams {
  lancamentos: LancamentoComRelacoes[]
  tipo: TipoLancamento
  labelPeriodo: string
}

export function gerarPdfLancamentos({ lancamentos, tipo, labelPeriodo }: GerarPdfParams): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const titulo = tipo === 'DESPESA' ? 'Contas a Pagar' : 'Contas a Receber'
  const corDestaque: [number, number, number] = tipo === 'DESPESA' ? [185, 28, 28] : [4, 120, 87]
  const rotuloPago = tipo === 'DESPESA' ? 'pago' : 'recebido'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20)
  doc.text(titulo, 14, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text(`Período: ${labelPeriodo}`, 14, 22)
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    14,
    27
  )

  const cabecalho = tipo === 'DESPESA'
    ? ['Descrição', 'Beneficiário', 'Categoria', 'Valor', 'Parciais', 'Restante', 'Vencimento', 'Pagamento', 'Nº Doc.', 'Status']
    : ['Descrição', 'Categoria', 'Valor', 'Parciais', 'Restante', 'Vencimento', 'Pagamento', 'Nº Doc.', 'Status']

  const colunaValorIndex = tipo === 'DESPESA' ? 3 : 2
  const colunaParciaisIndex = colunaValorIndex + 1
  const colunaRestanteIndex = colunaValorIndex + 2

  const linhas = lancamentos.map(l => {
    const descricao = l.descricao + (l.numero_parcelas && l.numero_parcelas > 1 ? ` (${l.parcela_atual}/${l.numero_parcelas})` : '')
    const pago = totalParciais(l)
    const linha = [descricao]
    if (tipo === 'DESPESA') linha.push(l.beneficiario ?? '—')
    linha.push(
      l.plano_contas.nome,
      formatarMoeda(Number(l.valor)),
      pago > 0 ? formatarMoeda(pago) : '—',
      pago > 0 ? formatarMoeda(restanteDe(l)) : '—',
      formatarData(l.dt_vencimento),
      l.dt_pagamento ? formatarData(l.dt_pagamento) : '—',
      l.numero_documento ?? '—',
      STATUS_LABEL[l.status] ?? l.status
    )
    return linha
  })

  autoTable(doc, {
    startY: 32,
    head: [cabecalho],
    body: linhas,
    styles: { fontSize: 8, cellPadding: 2.2, textColor: 30 },
    headStyles: { fillColor: corDestaque, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 247, 249] },
    columnStyles: {
      [colunaValorIndex]: { halign: 'right', cellWidth: 24 },
      [colunaParciaisIndex]: { halign: 'right', cellWidth: 24 },
      [colunaRestanteIndex]: { halign: 'right', cellWidth: 24 },
    },
    margin: { left: 14, right: 14 },
  })

  const pagoQuitados = lancamentos.filter(l => l.status === 'PAGO').reduce((s, l) => s + Number(l.valor), 0)
  const pendentes = lancamentos.filter(l => l.status === 'PENDENTE').reduce((s, l) => s + Number(l.valor), 0)
  const pagoParcial = lancamentos.filter(l => l.status === 'PENDENTE').reduce((s, l) => s + totalParciais(l), 0)
  const totalPago = Math.round((pagoQuitados + pagoParcial) * 100) / 100
  const totalPendentes = Math.round((pendentes - pagoParcial) * 100) / 100

  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  doc.text(`Total ${rotuloPago}: ${formatarMoeda(totalPago)}`, 14, y)
  doc.text(`Pendentes: ${formatarMoeda(pendentes)}`, 14, y + 6)
  doc.text(`${tipo === 'DESPESA' ? 'Pago' : 'Recebido'} parcial: ${formatarMoeda(pagoParcial)}`, 14, y + 12)
  doc.text(`Total pendentes: ${formatarMoeda(totalPendentes)}`, 14, y + 18)

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
