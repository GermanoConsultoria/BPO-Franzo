'use client'

import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { X, Upload, GripVertical, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { importarExtratoBanco, parseArquivoExtratoBanco } from '@/app/actions'
import type { Banco, PlanoContas } from '@/types'

interface Props {
  equipeId: string
  banco: Banco
  planoContas: PlanoContas[]
  onClose: () => void
  onImportado: (saldoAtual: number, quantidade: number) => void
}

interface LinhaRevisao {
  id: string
  data: string // yyyy-mm-dd
  descricao: string
  tipo: 'RECEITA' | 'DESPESA'
  valorCentavos: number
  plano_contas_id: string
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function categoriaPadrao(planoContas: PlanoContas[], tipo: 'RECEITA' | 'DESPESA'): string {
  return planoContas.find(p => p.tipo === tipo && p.nome.toLowerCase().includes('identificar'))?.id ?? ''
}

const TIPO_DRAG = 'linha-extrato-importado'

function LinhaArrastavel({
  linhaId,
  data,
  index,
  moverLinha,
  children,
}: {
  linhaId: string
  data: string
  index: number
  moverLinha: (indiceOrigem: number, indiceDestino: number) => void
  children: ReactNode
}) {
  const rowRef = useRef<HTMLTableRowElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  const [, drop] = useDrop<{ id: string; index: number; data: string }>({
    accept: TIPO_DRAG,
    hover(item) {
      if (item.id === linhaId) return
      if (item.data !== data) return // só reordena dentro do mesmo dia
      moverLinha(item.index, index)
      item.index = index
    },
  })

  const [{ isDragging }, drag] = useDrag({
    type: TIPO_DRAG,
    item: { id: linhaId, index, data },
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  })

  drop(rowRef)
  drag(handleRef)

  return (
    <tr ref={rowRef} className={`hover:bg-background/50 transition-colors ${isDragging ? 'opacity-30' : ''}`}>
      <td className="px-1 py-1 text-gray-500">
        <div ref={handleRef} className="cursor-grab active:cursor-grabbing p-1.5" title="Arrastar para reordenar (só no mesmo dia)">
          <GripVertical size={14} />
        </div>
      </td>
      {children}
    </tr>
  )
}

export default function ModalImportarExtrato({ equipeId, banco, planoContas, onClose, onImportado }: Props) {
  const [etapa, setEtapa] = useState<'upload' | 'revisao'>('upload')
  const [carregandoArquivo, setCarregandoArquivo] = useState(false)
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([])
  const [enviando, setEnviando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setCarregandoArquivo(true)
    setErroArquivo(null)
    try {
      const formData = new FormData()
      formData.set('equipeId', equipeId)
      formData.set('arquivo', file)
      const resultado = await parseArquivoExtratoBanco(formData)
      if (!resultado.success) {
        setErroArquivo(resultado.error)
        return
      }
      const revisao: LinhaRevisao[] = resultado.data.linhas
        .map((l, i) => ({
          id: `${Date.now()}-${i}`,
          data: l.data,
          descricao: l.descricao,
          tipo: l.tipo,
          valorCentavos: Math.round(l.valor * 100),
          plano_contas_id: categoriaPadrao(planoContas, l.tipo),
        }))
        .sort((a, b) => a.data.localeCompare(b.data))
      setLinhas(revisao)
      setAvisos(resultado.data.avisos)
      setEtapa('revisao')
    } catch {
      setErroArquivo('Erro ao ler a planilha.')
    } finally {
      setCarregandoArquivo(false)
    }
  }

  function atualizarLinha(id: string, patch: Partial<LinhaRevisao>) {
    setLinhas(prev => {
      const atualizado = prev.map(l => l.id === id ? { ...l, ...patch } : l)
      return patch.data !== undefined ? [...atualizado].sort((a, b) => a.data.localeCompare(b.data)) : atualizado
    })
  }

  function alternarTipo(id: string) {
    setLinhas(prev => prev.map(l => {
      if (l.id !== id) return l
      const novoTipo = l.tipo === 'RECEITA' ? 'DESPESA' : 'RECEITA'
      const categoriaAindaValida = planoContas.some(p => p.id === l.plano_contas_id && p.tipo === novoTipo)
      return { ...l, tipo: novoTipo, plano_contas_id: categoriaAindaValida ? l.plano_contas_id : categoriaPadrao(planoContas, novoTipo) }
    }))
  }

  function handleValorChange(id: string, valorStr: string) {
    const digitos = valorStr.replace(/\D/g, '')
    atualizarLinha(id, { valorCentavos: parseInt(digitos || '0', 10) })
  }

  function removerLinha(id: string) {
    setLinhas(prev => prev.filter(l => l.id !== id))
  }

  function moverLinha(indiceOrigem: number, indiceDestino: number) {
    setLinhas(prev => {
      if (!prev[indiceOrigem] || !prev[indiceDestino]) return prev
      if (prev[indiceOrigem].data !== prev[indiceDestino].data) return prev
      const copia = [...prev]
      const [item] = copia.splice(indiceOrigem, 1)
      copia.splice(indiceDestino, 0, item)
      return copia
    })
  }

  function aplicarCategoriaEmMassa(tipo: 'RECEITA' | 'DESPESA', planoContasId: string) {
    if (!planoContasId) return
    setLinhas(prev => prev.map(l => l.tipo === tipo ? { ...l, plano_contas_id: planoContasId } : l))
  }

  const linhasComSaldo = useMemo(() => {
    let corrente = banco.saldo_atual
    return linhas.map(l => {
      const saldoAnterior = corrente
      const delta = (l.tipo === 'RECEITA' ? 1 : -1) * (l.valorCentavos / 100)
      corrente = Math.round((corrente + delta) * 100) / 100
      return { ...l, saldoAnterior, saldoAtual: corrente }
    })
  }, [linhas, banco.saldo_atual])

  const saldoFinal = linhasComSaldo.length > 0 ? linhasComSaldo[linhasComSaldo.length - 1].saldoAtual : banco.saldo_atual

  const linhasInvalidas = useMemo(() => {
    const invalidas = new Set<string>()
    for (const l of linhas) {
      if (!l.descricao.trim() || l.valorCentavos <= 0 || !l.plano_contas_id || !l.data) invalidas.add(l.id)
    }
    return invalidas
  }, [linhas])

  async function confirmarImportacao() {
    if (linhas.length === 0) {
      toast.error('Não há lançamentos para importar.')
      return
    }
    if (linhasInvalidas.size > 0) {
      toast.error('Corrija as linhas destacadas em vermelho antes de confirmar.')
      return
    }

    setEnviando(true)
    try {
      const payload = linhas.map(l => ({
        data: l.data,
        descricao: l.descricao.trim(),
        valor: l.tipo === 'RECEITA' ? l.valorCentavos / 100 : -(l.valorCentavos / 100),
        plano_contas_id: l.plano_contas_id,
      }))
      const resultado = await importarExtratoBanco(equipeId, banco.id, payload)
      if (!resultado.success) {
        toast.error(resultado.error)
        return
      }
      toast.success(`${resultado.data.quantidade} lançamento(s) importado(s).`)
      onImportado(resultado.data.saldoFinal, resultado.data.quantidade)
    } catch {
      toast.error('Erro ao importar extrato.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className={`bg-surface border border-border rounded-xl w-full ${etapa === 'revisao' ? 'max-w-6xl' : 'max-w-lg'} shadow-2xl max-h-[92vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="text-lg font-bold">Importar Extrato — {banco.nome}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {etapa === 'upload'
                ? 'Envie uma planilha .xlsx com as colunas Data, Descrição e Valor.'
                : 'Revise, edite e confirme os lançamentos antes de importar.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {etapa === 'upload' ? (
          <div className="p-5 space-y-4">
            <label
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-12 cursor-pointer hover:border-indigo-500 hover:bg-background/40 transition-colors"
            >
              <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={handleArquivo} disabled={carregandoArquivo} />
              {carregandoArquivo ? (
                <Loader2 size={28} className="text-indigo-400 animate-spin" />
              ) : (
                <Upload size={28} className="text-gray-500" />
              )}
              <p className="text-sm text-gray-300 font-medium">{carregandoArquivo ? 'Lendo planilha...' : 'Clique para escolher o arquivo .xlsx'}</p>
              <p className="text-xs text-gray-500">Colunas esperadas: Data, Descrição, Tipo, Valor</p>
            </label>

            <div className="text-xs text-gray-500 bg-background border border-border rounded-lg p-3 space-y-1">
              <p>• A coluna <span className="text-foreground font-medium">Tipo</span> deve conter &quot;Receita&quot; ou &quot;Despesa&quot; em cada linha.</p>
              <p>• Todos os lançamentos importados entram como já <span className="text-foreground font-medium">pagos</span>, vinculados a este banco.</p>
              <p>• Na próxima etapa você confere e edita tudo antes de confirmar.</p>
            </div>

            {erroArquivo && (
              <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{erroArquivo}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {avisos.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <div className="space-y-0.5">{avisos.map((a, i) => <p key={i}>{a}</p>)}</div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 bg-background border border-border rounded-lg p-3">
              <div className="text-xs text-gray-400">
                Saldo atual do banco: <span className="font-semibold text-foreground">{formatarMoeda(banco.saldo_atual)}</span>
              </div>
              <div className="text-xs text-gray-400">
                Saldo após importar {linhas.length} lançamento(s): <span className={`font-semibold ${saldoFinal < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatarMoeda(saldoFinal)}</span>
              </div>
              <p className="text-xs text-gray-500 w-full">Confira se o saldo final bate com o extrato real do banco antes de confirmar.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Categoria em massa:</span>
              <select
                onChange={e => aplicarCategoriaEmMassa('RECEITA', e.target.value)}
                defaultValue=""
                className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="" disabled>Aplicar a todas as Receitas...</option>
                {planoContas.filter(p => p.tipo === 'RECEITA').map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <select
                onChange={e => aplicarCategoriaEmMassa('DESPESA', e.target.value)}
                defaultValue=""
                className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="" disabled>Aplicar a todas as Despesas...</option>
                {planoContas.filter(p => p.tipo === 'DESPESA').map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>

            <DndProvider backend={HTML5Backend}>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[45vh] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-background text-gray-400 text-[11px] uppercase sticky top-0">
                      <tr>
                        <th className="w-6" />
                        <th className="text-left px-2 py-2">Data</th>
                        <th className="text-left px-2 py-2">Descrição</th>
                        <th className="text-center px-2 py-2">Tipo</th>
                        <th className="text-right px-2 py-2">Valor</th>
                        <th className="text-left px-2 py-2">Categoria</th>
                        <th className="text-right px-2 py-2">Saldo Ant.</th>
                        <th className="text-right px-2 py-2">Saldo Atual</th>
                        <th className="w-6" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {linhasComSaldo.map((l, index) => {
                        const invalida = linhasInvalidas.has(l.id)
                        return (
                          <LinhaArrastavel key={l.id} linhaId={l.id} data={l.data} index={index} moverLinha={moverLinha}>
                            <td className={invalida ? 'bg-red-500/5' : undefined}>
                              <input
                                type="date"
                                value={l.data}
                                onChange={e => atualizarLinha(l.id, { data: e.target.value })}
                                className="bg-transparent px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded w-[9.5rem]"
                              />
                            </td>
                            <td className={invalida ? 'bg-red-500/5' : undefined}>
                              <input
                                type="text"
                                value={l.descricao}
                                onChange={e => atualizarLinha(l.id, { descricao: e.target.value })}
                                className="bg-transparent px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded w-full min-w-[160px]"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => alternarTipo(l.id)}
                                className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors ${l.tipo === 'RECEITA' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
                                title="Clique para alternar Receita/Despesa"
                              >
                                {l.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
                              </button>
                            </td>
                            <td className={invalida ? 'bg-red-500/5' : undefined}>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={l.valorCentavos > 0 ? formatarMoeda(l.valorCentavos / 100) : ''}
                                placeholder="R$ 0,00"
                                onChange={e => handleValorChange(l.id, e.target.value)}
                                className={`bg-transparent px-2 py-1.5 text-right font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded w-28 ${l.tipo === 'RECEITA' ? 'text-emerald-400' : 'text-red-400'}`}
                              />
                            </td>
                            <td className={invalida ? 'bg-red-500/5' : undefined}>
                              <select
                                value={l.plano_contas_id}
                                onChange={e => atualizarLinha(l.id, { plano_contas_id: e.target.value })}
                                className="bg-transparent px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded w-full min-w-[160px]"
                              >
                                <option value="">Selecione...</option>
                                {planoContas.filter(p => p.tipo === l.tipo).map(p => (
                                  <option key={p.id} value={p.id}>{p.nome}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-2 py-1.5 text-right text-gray-500 whitespace-nowrap">{formatarMoeda(l.saldoAnterior)}</td>
                            <td className="px-2 py-1.5 text-right text-gray-300 font-medium whitespace-nowrap">{formatarMoeda(l.saldoAtual)}</td>
                            <td className="px-1 py-1.5 text-center">
                              <button onClick={() => removerLinha(l.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" title="Remover linha">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </LinhaArrastavel>
                        )
                      })}
                    </tbody>
                  </table>
                  {linhas.length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-8">Todas as linhas foram removidas.</p>
                  )}
                </div>
              </div>
            </DndProvider>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setEtapa('upload'); setLinhas([]); setAvisos([]) }}
                className="py-2 px-4 rounded-lg border border-border text-sm text-gray-400 hover:text-foreground hover:bg-surface-highlight transition-colors"
              >
                Escolher outro arquivo
              </button>
              <button
                type="button"
                onClick={confirmarImportacao}
                disabled={enviando || linhas.length === 0}
                className="py-2 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {enviando ? 'Importando...' : `Confirmar Importação (${linhas.length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
