/**
 * Utilitários de data para o projeto.
 *
 * Contexto: O banco armazena datas em UTC. O Brasil usa America/Sao_Paulo
 * (UTC-3, com horário de verão), então precisamos converter corretamente
 * para exibição e para comparações de "hoje".
 *
 * Regra: use estas funções em vez de calcular offset manualmente (-3h).
 */

const TIMEZONE = 'America/Sao_Paulo'

/**
 * Retorna a data "hoje" no fuso de São Paulo, zerada em 00:00:00.
 * Substitui os blocos com `offsetBrasil = -3` espalhados pelo projeto.
 */
export function hojeNoFusoBrasil(): Date {
    const agora = new Date()
    // Formata no fuso correto e reconstrói como Date local
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(agora)

    const ano = Number(partes.find(p => p.type === 'year')?.value)
    const mes = Number(partes.find(p => p.type === 'month')?.value) - 1
    const dia = Number(partes.find(p => p.type === 'day')?.value)

    return new Date(ano, mes, dia, 0, 0, 0, 0)
}

/**
 * Extrai apenas a parte YYYY-MM-DD de uma data ISO/string/Date,
 * ignorando o horário e o fuso. Útil para comparar se uma tarefa
 * vence "neste dia" sem que a hora interfira.
 */
export function extrairDataYMD(data: Date | string | null | undefined): string | null {
    if (!data) return null
    const str = data instanceof Date ? data.toISOString() : String(data)
    return str.split('T')[0] ?? null
}

/**
 * Converte uma data (Date | string) para Date local sem alterar o dia.
 * Resolve o problema de datas UTC que ao serem parseadas localmente
 * retrocedem um dia (ex: "2024-03-15T00:00:00Z" → 14/03 em UTC-3).
 */
export function parseDateLocal(data: Date | string | null | undefined): Date | null {
    if (!data) return null
    const ymd = extrairDataYMD(data)
    if (!ymd) return null
    const [ano, mes, dia] = ymd.split('-').map(Number)
    return new Date(ano, mes - 1, dia, 0, 0, 0, 0)
}

/**
 * Formata uma data para exibição em pt-BR (dd/mm/aaaa), sem problemas de fuso.
 */
export function formatarDataBR(data: Date | string | null | undefined): string {
    const d = parseDateLocal(data)
    if (!d) return '-'
    return d.toLocaleDateString('pt-BR')
}

/**
 * Formata data e hora para exibição em pt-BR.
 */
export function formatarDataHoraBR(data: Date | string | null | undefined): string {
    if (!data) return '-'
    return new Date(data).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
        timeZone: TIMEZONE,
    })
}

/**
 * Retorna label amigável para datas de vencimento (Hoje, Amanhã, dia da semana, dd/mm).
 */
export function labelVencimento(data: Date | string | null | undefined): string {
    const dataTarefa = parseDateLocal(data)
    if (!dataTarefa) return ''

    const hoje = hojeNoFusoBrasil()
    const diffMs = dataTarefa.getTime() - hoje.getTime()
    const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDias === 0) return 'Hoje'
    if (diffDias === 1) return 'Amanhã'
    if (diffDias > 1 && diffDias < 7) {
        return dataTarefa.toLocaleDateString('pt-BR', { weekday: 'long' })
    }
    return dataTarefa.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
