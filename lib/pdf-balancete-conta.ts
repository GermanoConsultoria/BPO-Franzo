import jsPDF from 'jspdf'
import { autoTable } from 'jspdf-autotable'

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

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function desenharCabecalho(doc: jsPDF, titulo: string, labelPeriodo: string) {
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
}

function desenharRodape(doc: jsPDF) {
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
}

interface ParamsBase {
  titulo: string
  itens: ItemConta[]
  total: number
  labelPeriodo: string
  corDestaque: [number, number, number]
}

export function gerarPdfContaResumo({ titulo, itens, total, labelPeriodo, corDestaque }: ParamsBase): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  desenharCabecalho(doc, titulo, labelPeriodo)

  const ordenados = [...itens].sort((a, b) => b.total - a.total)
  const linhas = ordenados.map(item => [
    item.nome,
    formatarMoeda(item.total),
    total > 0 ? `${((item.total / total) * 100).toFixed(1)}%` : '—',
  ])
  linhas.push(['Total', formatarMoeda(total), '100%'])

  autoTable(doc, {
    startY: 32,
    head: [['Conta', 'Total', '%']],
    body: linhas,
    styles: { fontSize: 9, cellPadding: 2.5, textColor: 30 },
    headStyles: { fillColor: corDestaque, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === linhas.length - 1) {
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  desenharRodape(doc)
  return doc.output('blob')
}

interface ParamsDetalhado extends ParamsBase {
  lancamentosPorConta: Record<string, LancamentoConta[]>
}

export function gerarPdfContaDetalhado({ titulo, itens, labelPeriodo, corDestaque, lancamentosPorConta }: ParamsDetalhado): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  desenharCabecalho(doc, titulo, labelPeriodo)

  const ordenados = [...itens].sort((a, b) => b.total - a.total)
  let y = 32
  const alturaPagina = doc.internal.pageSize.getHeight()

  for (const item of ordenados) {
    const lancamentos = lancamentosPorConta[item.plano_contas_id] ?? []

    if (y > alturaPagina - 30) {
      doc.addPage()
      y = 20
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text(`${item.nome} — ${formatarMoeda(item.total)}`, 14, y)
    y += 3

    if (lancamentos.length === 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text('Nenhum lançamento.', 14, y + 5)
      y += 14
      continue
    }

    autoTable(doc, {
      startY: y + 3,
      head: [['Descrição', 'Status', 'Vencimento', 'Valor']],
      body: lancamentos.map(l => [
        l.descricao,
        STATUS_LABEL[l.status] ?? l.status,
        formatarData(l.dt_vencimento),
        formatarMoeda(l.valor),
      ]),
      styles: { fontSize: 8, cellPadding: 2, textColor: 30 },
      headStyles: { fillColor: corDestaque, textColor: 255, fontStyle: 'bold' },
      columnStyles: { 3: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  desenharRodape(doc)
  return doc.output('blob')
}
