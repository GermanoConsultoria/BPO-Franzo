'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Printer, AlertTriangle } from 'lucide-react'

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

interface Payload {
  geradoEm: string
  dados: DadosTarefasUsuario[]
}

const STATUS_INFO: Record<StatusTarefa, { label: string; cls: string }> = {
  concluidas: { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-700' },
  atrasadas: { label: 'Atrasada', cls: 'bg-red-100 text-red-700' },
  pendentes: { label: 'Pendente', cls: 'bg-indigo-100 text-indigo-700' },
}

export default function ExportarTarefasFuncionarioClient() {
  const searchParams = useSearchParams()
  const chave = searchParams.get('key')
  const [payload, setPayload] = useState<Payload | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!chave) { setErro(true); return }
    try {
      const bruto = localStorage.getItem(chave)
      if (!bruto) { setErro(true); return }
      setPayload(JSON.parse(bruto))
      localStorage.removeItem(chave)
    } catch {
      setErro(true)
    }
  }, [chave])

  if (erro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-700 gap-3 p-8 text-center">
        <AlertTriangle className="text-amber-500" size={32} />
        <p className="font-medium">Não foi possível carregar os dados do relatório.</p>
        <p className="text-sm text-gray-500">Feche esta guia e clique novamente em &quot;Exportar PDF&quot; no dashboard.</p>
      </div>
    )
  }

  if (!payload) {
    return <div className="min-h-screen flex items-center justify-center bg-white text-gray-500">Carregando...</div>
  }

  const { dados, geradoEm } = payload

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-4xl mx-auto p-10">

        {/* BARRA DE AÇÃO (some ao imprimir) */}
        <div className="print:hidden flex justify-end mb-6">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <Printer size={15} /> Imprimir / Salvar PDF
          </button>
        </div>

        <header className="mb-8 border-b border-gray-200 pb-4">
          <h1 className="text-2xl font-bold">Relatório de Tarefas por Funcionário</h1>
          <p className="text-sm text-gray-500 mt-1">Gerado em {new Date(geradoEm).toLocaleString('pt-BR')}</p>
        </header>

        {/* TABELA GERAL */}
        <section className="mb-10">
          <h2 className="text-base font-bold mb-3">Resumo Geral</h2>
          {dados.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Nenhum dado disponível.</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-xs uppercase text-gray-600">
                  <th className="px-3 py-2 border border-gray-200">Funcionário</th>
                  <th className="px-3 py-2 border border-gray-200 text-right">Total</th>
                  <th className="px-3 py-2 border border-gray-200 text-right">Concl.</th>
                  <th className="px-3 py-2 border border-gray-200 text-right">Atras.</th>
                  <th className="px-3 py-2 border border-gray-200 text-right">Pend.</th>
                </tr>
              </thead>
              <tbody>
                {dados.map(u => (
                  <tr key={u.nome}>
                    <td className="px-3 py-2 border border-gray-200 font-medium">{u.nome}</td>
                    <td className="px-3 py-2 border border-gray-200 text-right">{u.total}</td>
                    <td className="px-3 py-2 border border-gray-200 text-right text-emerald-600">{u.concluidas}</td>
                    <td className="px-3 py-2 border border-gray-200 text-right text-red-600">{u.atrasadas}</td>
                    <td className="px-3 py-2 border border-gray-200 text-right text-indigo-600">{u.pendentes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* TABELAS POR FUNCIONÁRIO */}
        {dados.map(u => (
          <section key={u.nome} className="mb-8 break-inside-avoid">
            <h2 className="text-base font-bold mb-3">{u.nome}</h2>
            {u.tarefas.length === 0 ? (
              <p className="text-sm text-gray-400 italic mb-4">Nenhuma tarefa no período.</p>
            ) : (
              <table className="w-full text-xs border-collapse mb-4">
                <thead>
                  <tr className="bg-gray-100 text-left uppercase text-gray-600">
                    <th className="px-3 py-2 border border-gray-200">Tarefa</th>
                    <th className="px-3 py-2 border border-gray-200">Projeto</th>
                    <th className="px-3 py-2 border border-gray-200">Etapa</th>
                    <th className="px-3 py-2 border border-gray-200 text-center">Status</th>
                    <th className="px-3 py-2 border border-gray-200 text-right">Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {u.tarefas.map((t, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 border border-gray-200">{t.titulo}</td>
                      <td className="px-3 py-2 border border-gray-200">{t.projeto}</td>
                      <td className="px-3 py-2 border border-gray-200">{t.etapa}</td>
                      <td className="px-3 py-2 border border-gray-200 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_INFO[t.status].cls}`}>
                          {STATUS_INFO[t.status].label}
                        </span>
                      </td>
                      <td className="px-3 py-2 border border-gray-200 text-right">{t.vencimento ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}

      </div>
    </div>
  )
}
