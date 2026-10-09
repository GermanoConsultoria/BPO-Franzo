const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export interface MesPeriodo {
  chave: string
  label: string
}

function chaveMes(data: Date | string) {
  const d = new Date(data)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Lista os meses presentes nos lançamentos (ordenados), com rótulo abreviado
 * (ex: "Set") — ou "Set/25" quando o mesmo mês aparece em anos diferentes. */
export function calcularMesesPeriodo(lancamentosPorConta: Record<string, { dt_vencimento: Date | string }[]>): MesPeriodo[] {
  const chaves = new Set<string>()
  for (const lista of Object.values(lancamentosPorConta)) {
    for (const l of lista) chaves.add(chaveMes(l.dt_vencimento))
  }
  const ordenadas = [...chaves].sort()

  const contagemAbrev = new Map<string, number>()
  for (const chave of ordenadas) {
    const abrev = MESES_ABREV[Number(chave.split('-')[1]) - 1]
    contagemAbrev.set(abrev, (contagemAbrev.get(abrev) ?? 0) + 1)
  }

  return ordenadas.map(chave => {
    const [ano, mesStr] = chave.split('-')
    const abrev = MESES_ABREV[Number(mesStr) - 1]
    const label = (contagemAbrev.get(abrev) ?? 0) > 1 ? `${abrev}/${ano}` : abrev
    return { chave, label }
  })
}

export function totalPorMes(lancamentos: { valor: number; dt_vencimento: Date | string }[], chaveAlvo: string) {
  return lancamentos
    .filter(l => chaveMes(l.dt_vencimento) === chaveAlvo)
    .reduce((s, l) => s + Number(l.valor), 0)
}
