import type { LancamentoComRelacoes, TipoLancamento, StatusLancamento } from '@/types'
import { adicionarCabecalhoXlsx, adicionarCabecalhoTabelaXlsx, FORMATO_MOEDA_XLSX } from '@/lib/xlsx-cabecalho'

const STATUS_LABEL: Record<StatusLancamento, string> = {
  PENDENTE: 'Pendente',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
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

interface GerarXlsxParams {
  nomeCliente: string
  lancamentos: LancamentoComRelacoes[]
  tipo: TipoLancamento
  labelPeriodo: string
}

export async function gerarXlsxLancamentos({ nomeCliente, lancamentos, tipo, labelPeriodo }: GerarXlsxParams): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const titulo = tipo === 'DESPESA' ? 'Contas a Pagar' : 'Contas a Receber'
  const corDestaque = tipo === 'DESPESA' ? 'FFB91C1C' : 'FF047857'
  const rotuloPago = tipo === 'DESPESA' ? 'pago' : 'recebido'

  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet(titulo)

  adicionarCabecalhoXlsx(ws, titulo, nomeCliente, labelPeriodo)

  const cabecalho = tipo === 'DESPESA'
    ? ['Descrição', 'Beneficiário', 'Categoria', 'Valor', 'Parciais', 'Restante', 'Vencimento', 'Pagamento', 'Nº Doc.', 'Status']
    : ['Descrição', 'Categoria', 'Valor', 'Parciais', 'Restante', 'Vencimento', 'Pagamento', 'Nº Doc.', 'Status']
  adicionarCabecalhoTabelaXlsx(ws, cabecalho, corDestaque)

  const colunaValorIndex = tipo === 'DESPESA' ? 4 : 3
  const colunaParciaisIndex = colunaValorIndex + 1
  const colunaRestanteIndex = colunaValorIndex + 2

  for (const l of lancamentos) {
    const descricao = l.descricao + (l.numero_parcelas && l.numero_parcelas > 1 ? ` (${l.parcela_atual}/${l.numero_parcelas})` : '')
    const pago = totalParciais(l)
    const linha: (string | number)[] = [descricao]
    if (tipo === 'DESPESA') linha.push(l.beneficiario ?? '—')
    linha.push(
      l.plano_contas.nome,
      Number(l.valor),
      pago > 0 ? pago : '',
      pago > 0 ? restanteDe(l) : '',
      formatarData(l.dt_vencimento),
      l.dt_pagamento ? formatarData(l.dt_pagamento) : '—',
      l.numero_documento ?? '—',
      STATUS_LABEL[l.status] ?? l.status,
    )
    const row = ws.addRow(linha)
    row.getCell(colunaValorIndex).numFmt = FORMATO_MOEDA_XLSX
    if (pago > 0) {
      row.getCell(colunaParciaisIndex).numFmt = FORMATO_MOEDA_XLSX
      row.getCell(colunaRestanteIndex).numFmt = FORMATO_MOEDA_XLSX
    }
  }

  const pagoQuitados = lancamentos.filter(l => l.status === 'PAGO').reduce((s, l) => s + Number(l.valor), 0)
  const pendentes = lancamentos.filter(l => l.status === 'PENDENTE').reduce((s, l) => s + Number(l.valor), 0)
  const pagoParcial = lancamentos.filter(l => l.status === 'PENDENTE').reduce((s, l) => s + totalParciais(l), 0)
  const totalPago = Math.round((pagoQuitados + pagoParcial) * 100) / 100
  const totalPendentes = Math.round((pendentes - pagoParcial) * 100) / 100

  function linhaTotal(label: string, valor: number) {
    const row = ws.addRow([label, valor])
    row.getCell(1).font = { bold: true }
    row.getCell(2).font = { bold: true }
    row.getCell(2).numFmt = FORMATO_MOEDA_XLSX
  }

  ws.addRow([])
  linhaTotal(`Total ${rotuloPago}:`, totalPago)
  linhaTotal('Pendentes:', pendentes)
  linhaTotal(`${tipo === 'DESPESA' ? 'Pago' : 'Recebido'} parcial:`, pagoParcial)
  linhaTotal('Total pendentes:', totalPendentes)

  ws.columns = cabecalho.map((_, i) => ({ width: i === 0 ? 32 : 16 }))

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
