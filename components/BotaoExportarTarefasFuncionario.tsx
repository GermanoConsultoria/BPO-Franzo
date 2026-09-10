'use client'

import { FileDown } from 'lucide-react'
import { toast } from 'sonner'

type StatusTarefa = 'concluidas' | 'atrasadas' | 'pendentes'

interface TarefaLinha {
  titulo: string
  projeto: string
  etapa: string
  status: StatusTarefa
  vencimento: string | null
}

interface DadosTarefasUsuario {
  nome: string
  total: number
  concluidas: number
  atrasadas: number
  pendentes: number
  tarefas: TarefaLinha[]
}

interface Props {
  dados: DadosTarefasUsuario[]
}

export default function BotaoExportarTarefasFuncionario({ dados }: Props) {
  const exportar = () => {
    const chave = `export-tarefas-funcionario-${Date.now()}`
    const payload = { geradoEm: new Date().toISOString(), dados }

    try {
      localStorage.setItem(chave, JSON.stringify(payload))
    } catch {
      toast.error('Não foi possível preparar a exportação.')
      return
    }

    window.open(`/exportar/tarefas-funcionario?key=${chave}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      onClick={exportar}
      disabled={dados.length === 0}
      title="Exportar PDF"
      className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-indigo-400 border border-border rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-text-muted"
    >
      <FileDown size={13} /> Exportar PDF
    </button>
  )
}
