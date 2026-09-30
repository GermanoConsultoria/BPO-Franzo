import jsPDF from 'jspdf'

/** Cabeçalho padrão de todos os PDFs exportados: título, nome do cliente,
 * período e data/hora de geração — mesmo layout usado no balancete. */
export function desenharCabecalhoPdf(doc: jsPDF, titulo: string, nomeCliente: string, labelPeriodo: string) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20)
  doc.text(titulo, 14, 16)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(70)
  doc.text(nomeCliente, 14, 23)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text(`Período: ${labelPeriodo}`, 14, 29)
  doc.text(
    `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    14,
    34
  )
}

/** Altura ocupada pelo cabeçalho — ponto de partida seguro para o conteúdo abaixo dele. */
export const INICIO_CONTEUDO_PDF = 39

export function desenharRodapePdf(doc: jsPDF) {
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
