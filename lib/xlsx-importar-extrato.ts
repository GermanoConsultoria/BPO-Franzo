import type ExcelJS from 'exceljs'

export interface LinhaExtratoParseada {
  data: string // yyyy-mm-dd
  descricao: string
  tipo: 'RECEITA' | 'DESPESA'
  valor: number // sempre positivo — o sinal já é dado pela coluna Tipo
}

export interface ResultadoParseExtrato {
  linhas: LinhaExtratoParseada[]
  avisos: string[]
}

function normalizar(texto: unknown): string {
  return typeof texto === 'string' ? texto.trim().toLowerCase() : ''
}

function parseDataCelula(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && value > 0) {
    // Serial de data do Excel (epoch 1899-12-30)
    const epoch = Date.UTC(1899, 11, 30)
    const dt = new Date(epoch + value * 86400000)
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const s = value.trim()
    const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
    if (dmy) {
      const [, d, m, y] = dmy
      const ano = y.length === 2 ? `20${y}` : y
      return `${ano}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
  }
  return null
}

function parseValorCelula(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'number') return Math.abs(value)
  if (value && typeof value === 'object' && 'result' in value) {
    const resultado = (value as { result?: unknown }).result
    if (typeof resultado === 'number') return Math.abs(resultado)
  }
  if (typeof value === 'string') {
    let s = value.trim()
    if (!s) return null
    s = s.replace(/^-/, '').replace(/^\(|\)$/g, '').replace(/r\$\s?/i, '').trim()
    // formato pt-BR: milhar com "." e decimal com ","
    if (/,\d{1,2}$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
    const n = parseFloat(s)
    if (isNaN(n)) return null
    return Math.abs(n)
  }
  return null
}

function parseTipoCelula(value: ExcelJS.CellValue): 'RECEITA' | 'DESPESA' | null {
  const s = normalizar(value)
  if (!s) return null
  if (s.startsWith('r') || s.includes('receit') || s.includes('credit') || s.includes('entrada')) return 'RECEITA'
  if (s.startsWith('d') || s.includes('desp') || s.includes('debit') || s.includes('saida') || s.includes('saída')) return 'DESPESA'
  return null
}

/** Lê um buffer .xlsx com colunas Data / Descrição / Tipo / Valor (em
 * qualquer posição, identificadas pelo cabeçalho) e devolve as linhas
 * reconhecidas. "Tipo" deve conter "Receita" ou "Despesa". Linhas totalmente
 * vazias são ignoradas; linhas com algum dado mas campos inválidos geram um
 * aviso e são puladas.
 *
 * Roda apenas no servidor: a leitura de .xlsx do ExcelJS depende de
 * internals do Node (Buffer/streams) que não existem no navegador. */
export async function parseXlsxExtratoBuffer(buffer: Buffer): Promise<ResultadoParseExtrato> {
  const { default: ExcelJSRuntime } = await import('exceljs')
  const workbook = new ExcelJSRuntime.Workbook()
  // cast só do tipo do parâmetro (mismatch entre duas declarações de Buffer) —
  // chamando via member access em vez de extrair a função, pra não perder o
  // `this` (xlsx.load usa `this.parseRels` internamente).
  const xlsxApi = workbook.xlsx as unknown as { load: (dados: Buffer) => Promise<unknown> }
  await xlsxApi.load(buffer)

  const ws = workbook.worksheets[0]
  if (!ws) throw new Error('A planilha está vazia.')

  let headerRow = -1
  let colData = -1
  let colDescricao = -1
  let colTipo = -1
  let colValor = -1

  ws.eachRow((row, rowNumber) => {
    if (headerRow !== -1) return
    // Array.from em vez de .map direto: row.values vem esparso (índice 0
    // sempre "vazio"), e .map pula buracos — Array.from os preenche com
    // undefined antes, senão o findIndex abaixo quebra ao cair num buraco.
    const valores = Array.from(row.values as unknown[]).map(normalizar)
    const idxData = valores.findIndex(v => v.includes('data'))
    const idxDescricao = valores.findIndex(v => v.includes('descri'))
    const idxTipo = valores.findIndex(v => v.includes('tipo'))
    const idxValor = valores.findIndex(v => v.includes('valor'))
    if (idxData !== -1 && idxDescricao !== -1 && idxTipo !== -1 && idxValor !== -1) {
      headerRow = rowNumber
      colData = idxData
      colDescricao = idxDescricao
      colTipo = idxTipo
      colValor = idxValor
    }
  })

  if (headerRow === -1) {
    throw new Error('Não encontrei as colunas "Data", "Descrição", "Tipo" e "Valor" na planilha.')
  }

  const linhas: LinhaExtratoParseada[] = []
  const avisos: string[] = []

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return

    const valorData = row.getCell(colData).value
    const valorDescricao = row.getCell(colDescricao).value
    const valorTipo = row.getCell(colTipo).value
    const valorValor = row.getCell(colValor).value

    const descricao = String(valorDescricao ?? '').trim()
    const vazia = !descricao && valorData == null && valorTipo == null && valorValor == null
    if (vazia) return

    const data = parseDataCelula(valorData)
    const tipo = parseTipoCelula(valorTipo)
    const valor = parseValorCelula(valorValor)

    if (!data || !tipo || valor === null || valor === 0 || !descricao) {
      avisos.push(`Linha ${rowNumber} da planilha ignorada por estar incompleta ou inválida (Tipo deve ser "Receita" ou "Despesa").`)
      return
    }

    linhas.push({ data, descricao, tipo, valor })
  })

  return { linhas, avisos }
}
