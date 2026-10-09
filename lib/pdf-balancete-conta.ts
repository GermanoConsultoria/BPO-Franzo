import jsPDF from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { desenharCabecalhoPdf, desenharRodapePdf, INICIO_CONTEUDO_PDF } from '@/lib/pdf-cabecalho'
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

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
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

export function gerarPdfContaResumo({ titulo, nomeCliente, itens, total, labelPeriodo, corDestaque, meses, lancamentosPorConta }: ParamsBase): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  desenharCabecalhoPdf(doc, titulo, nomeCliente, labelPeriodo)

  const ordenados = [...itens].sort((a, b) => b.total - a.total)
  const usarMatriz = !!meses && meses.length > 1 && !!lancamentosPorConta

  if (usarMatriz && meses && lancamentosPorConta) {
    const linhas = ordenados.map(item => {
      const lancamentos = lancamentosPorConta[item.plano_contas_id] ?? []
      return [
        item.nome,
        ...meses.map(m => formatarMoeda(totalPorMes(lancamentos, m.chave))),
        formatarMoeda(item.total),
        total > 0 ? `${((item.total / total) * 100).toFixed(1)}%` : '—',
      ]
    })
    const totalPorMesGeral = meses.map(m =>
      ordenados.reduce((s, item) => s + totalPorMes(lancamentosPorConta[item.plano_contas_id] ?? [], m.chave), 0)
    )
    linhas.push(['Total', ...totalPorMesGeral.map(formatarMoeda), formatarMoeda(total), '100%'])

    const colunasDireita: Record<number, { halign: 'right' }> = {}
    for (let i = 1; i <= meses.length + 2; i++) colunasDireita[i] = { halign: 'right' }

    autoTable(doc, {
      startY: INICIO_CONTEUDO_PDF,
      head: [['Conta', ...meses.map(m => m.label), 'Total', '%']],
      body: linhas,
      styles: { fontSize: 8, cellPadding: 2, textColor: 30 },
      headStyles: { fillColor: corDestaque, textColor: 255, fontStyle: 'bold' },
      columnStyles: colunasDireita,
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === linhas.length - 1) {
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
  } else {
    const linhas = ordenados.map(item => [
      item.nome,
      formatarMoeda(item.total),
      total > 0 ? `${((item.total / total) * 100).toFixed(1)}%` : '—',
    ])
    linhas.push(['Total', formatarMoeda(total), '100%'])

    autoTable(doc, {
      startY: INICIO_CONTEUDO_PDF,
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
  }

  desenharRodapePdf(doc)
  return doc.output('blob')
}

interface ParamsDetalhado extends ParamsBase {
  lancamentosPorConta: Record<string, LancamentoConta[]>
}

export function gerarPdfContaDetalhado({ titulo, nomeCliente, itens, labelPeriodo, corDestaque, lancamentosPorConta }: ParamsDetalhado): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  desenharCabecalhoPdf(doc, titulo, nomeCliente, labelPeriodo)

  const ordenados = [...itens].sort((a, b) => b.total - a.total)
  let y = INICIO_CONTEUDO_PDF
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

  desenharRodapePdf(doc)
  return doc.output('blob')
}
