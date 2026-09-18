'use client'

import { useState } from 'react'
import { X, Paperclip, Plus, Trash2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { criarLancamento, editarLancamento, salvarAnexoFinanceiro, excluirAnexoFinanceiro, registrarPagamentoParcial, excluirPagamentoParcial, estornarPagamento } from '@/app/actions'
import { UploadButton } from '@/lib/uploadthing'
import ListaAnexos from '@/components/ListaAnexos'
import type { LancamentoComRelacoes, PlanoContas, Banco, TipoLancamento, AnexoFinanceiro, PagamentoParcial } from '@/types'

interface Props {
  equipeId: string
  tipo: TipoLancamento
  planoContas: PlanoContas[]
  bancos: Banco[]
  lancamento?: LancamentoComRelacoes
  onClose: () => void
  onSuccess: () => void
}

function formatarMoeda(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseCentavos(valor: number) {
  return Math.round(valor * 100)
}

export default function ModalLancamento({ equipeId, tipo, planoContas, bancos, lancamento, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [aplicarATodos, setAplicarATodos] = useState(false)
  const [parcelas, setParcelas] = useState(lancamento?.numero_parcelas ?? 1)
  const [parcelasInput, setParcelasInput] = useState(String(lancamento?.numero_parcelas ?? 1))
  const [recorrencia, setRecorrencia] = useState<'NAO' | 'DIARIAMENTE' | 'SEMANALMENTE' | 'MENSALMENTE'>(lancamento?.recorrencia ?? 'NAO')
  const [anexos, setAnexos] = useState<AnexoFinanceiro[]>(lancamento?.anexos ?? [])
  const [valorCentavos, setValorCentavos] = useState(
    lancamento ? parseCentavos(Number(lancamento.valor)) : 0
  )
  const [valorDisplay, setValorDisplay] = useState(
    lancamento ? formatarMoeda(parseCentavos(Number(lancamento.valor))) : ''
  )

  // --- Pagamentos parciais (só ao editar um lançamento existente) ---
  const [parciais, setParciais] = useState<PagamentoParcial[]>(lancamento?.parciais ?? [])
  const [showParcialForm, setShowParcialForm] = useState(false)
  const [salvandoParcial, setSalvandoParcial] = useState(false)
  const [parcialCentavos, setParcialCentavos] = useState(0)
  const [parcialDisplay, setParcialDisplay] = useState('')
  const [parcialData, setParcialData] = useState(new Date().toISOString().split('T')[0])
  const [parcialObs, setParcialObs] = useState('')

  const totalParciais = parciais.reduce((s, p) => s + Number(p.valor), 0)
  const restanteParciais = Math.round((Number(lancamento?.valor ?? 0) - totalParciais) * 100) / 100
  // Valor/banco já movimentaram dinheiro real — trava a edição desses dois campos.
  const temMovimento = !!lancamento && (lancamento.status === 'PAGO' || parciais.length > 0)

  const [confirmandoEstorno, setConfirmandoEstorno] = useState(false)
  const [estornando, setEstornando] = useState(false)

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const apenasDigitos = e.target.value.replace(/\D/g, '')
    const centavos = parseInt(apenasDigitos || '0', 10)
    setValorCentavos(centavos)
    setValorDisplay(centavos > 0 ? formatarMoeda(centavos) : '')
}

  function handleParcialValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const apenasDigitos = e.target.value.replace(/\D/g, '')
    const centavos = parseInt(apenasDigitos || '0', 10)
    setParcialCentavos(centavos)
    setParcialDisplay(centavos > 0 ? formatarMoeda(centavos) : '')
  }

  async function handleAddParcial() {
    if (!lancamento) return
    if (parcialCentavos <= 0) { toast.error('Informe o valor do parcial.'); return }
    setSalvandoParcial(true)
    const r = await registrarPagamentoParcial(lancamento.id, parcialCentavos / 100, parcialData, parcialObs || null, equipeId)
    setSalvandoParcial(false)
    if (!r.success) { toast.error(r.error); return }

    setParciais(prev => [...prev, {
      id: crypto.randomUUID(),
      lancamento_id: lancamento.id,
      valor: parcialCentavos / 100,
      dt_pagamento: parcialData,
      observacao: parcialObs || null,
      dt_insert: new Date().toISOString(),
    }])
    const quitou = parcialCentavos / 100 >= restanteParciais
    setParcialCentavos(0)
    setParcialDisplay('')
    setParcialObs('')
    setShowParcialForm(false)
    toast.success(quitou ? 'Parcial registrado — lançamento quitado!' : 'Parcial registrado.')
    onSuccess()
  }

  async function handleEstornar() {
    if (!lancamento) return
    setEstornando(true)
    const r = await estornarPagamento(lancamento.id, equipeId)
    setEstornando(false)
    if (!r.success) { toast.error(r.error); return }
    toast.success(tipo === 'DESPESA' ? 'Pagamento estornado.' : 'Recebimento estornado.')
    onClose()
    onSuccess()
  }

  async function handleDelParcial(id: string) {
    const r = await excluirPagamentoParcial(id, equipeId)
    if (!r.success) { toast.error(r.error); return }
    setParciais(prev => prev.filter(p => p.id !== id))
    toast.success('Parcial removido.')
    onSuccess()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set('tipo', tipo)
    formData.set('valor', (valorCentavos / 100).toFixed(2))
    if (aplicarATodos) formData.set('aplicar_a_todos', 'true')

    const resultado = lancamento
      ? await editarLancamento(formData)
      : await criarLancamento(formData)

    if (!resultado.success) {
      toast.error(resultado.error)
      setLoading(false)
      return
    }

    toast.success(lancamento ? 'Lançamento atualizado.' : 'Lançamento criado.')
    if (resultado.warning) toast.warning(resultado.warning)
    onClose()
    onSuccess()
  }

  const labelTipo = tipo === 'DESPESA' ? 'Despesa' : 'Receita'
  const hoje = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface">
          <h2 className="text-lg font-bold">
            {lancamento ? 'Editar' : 'Nova'} {labelTipo}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {lancamento && <input type="hidden" name="id" value={lancamento.id} />}
          <input type="hidden" name="equipeId" value={equipeId} />

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descrição *</label>
            <input
              name="descricao"
              defaultValue={lancamento?.descricao ?? ''}
              placeholder={tipo === 'DESPESA' ? 'Ex: Aluguel do escritório' : 'Ex: Pagamento de consultoria'}
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {tipo === 'DESPESA' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Beneficiário</label>
              <input
                name="beneficiario"
                defaultValue={lancamento?.beneficiario ?? ''}
                placeholder="Ex: Fornecedor XYZ"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Valor *</label>
              <input
                type="text"
                inputMode="numeric"
                value={valorDisplay}
                onChange={handleValorChange}
                placeholder="R$ 0,00"
                required={valorCentavos === 0}
                disabled={temMovimento}
                title={temMovimento ? 'Não é possível alterar o valor após pagamentos registrados.' : undefined}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Vencimento *</label>
              <input
                name="dt_vencimento"
                type="date"
                defaultValue={lancamento ? new Date(lancamento.dt_vencimento).toISOString().split('T')[0] : hoje}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* PAGAMENTOS PARCIAIS — só ao editar um lançamento não cancelado */}
          {lancamento && lancamento.status !== 'CANCELADO' && (
            <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {tipo === 'DESPESA' ? 'Pagamentos parciais' : 'Recebimentos parciais'}
                </span>
                {totalParciais > 0 && (
                  <span className="text-xs text-yellow-400">
                    {formatarMoeda(parseCentavos(totalParciais))} de {formatarMoeda(parseCentavos(Number(lancamento.valor)))}
                    {restanteParciais > 0 && ` · falta ${formatarMoeda(parseCentavos(restanteParciais))}`}
                  </span>
                )}
              </div>

              {parciais.length > 0 && (
                <ul className="space-y-1">
                  {parciais.map(p => (
                    <li key={p.id} className="flex items-center justify-between gap-2 text-sm bg-surface border border-border rounded-lg px-3 py-1.5">
                      <div className="min-w-0">
                        <span className="font-medium text-foreground">{formatarMoeda(parseCentavos(Number(p.valor)))}</span>
                        <span className="text-gray-500 ml-2">{new Date(p.dt_pagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                        {p.observacao && <span className="text-gray-500 ml-2 truncate">— {p.observacao}</span>}
                      </div>
                      {lancamento.status === 'PENDENTE' && (
                        <button
                          type="button"
                          onClick={() => handleDelParcial(p.id)}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                          title="Remover parcial"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {lancamento.status === 'PAGO' ? (
                confirmandoEstorno ? (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-2">
                    <p className="text-xs text-yellow-300">
                      Estornar? O lançamento volta para <span className="font-semibold">Pendente</span>
                      {lancamento.banco ? <> e o valor retorna ao saldo do banco <span className="font-semibold">{lancamento.banco.nome}</span></> : null}.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmandoEstorno(false)}
                        disabled={estornando}
                        className="flex-1 py-1.5 rounded-lg border border-border text-xs hover:bg-surface-highlight transition-colors disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleEstornar}
                        disabled={estornando}
                        className="flex-1 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                      >
                        {estornando ? 'Estornando...' : 'Confirmar estorno'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-emerald-400">Lançamento quitado.</p>
                    <button
                      type="button"
                      onClick={() => setConfirmandoEstorno(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-yellow-500 hover:text-yellow-400 transition-colors"
                    >
                      <RotateCcw size={13} /> Estornar
                    </button>
                  </div>
                )
              ) : showParcialForm ? (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-400 mb-1">Valor do parcial</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={parcialDisplay}
                        onChange={handleParcialValorChange}
                        placeholder="R$ 0,00"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-400 mb-1">Data</label>
                      <input
                        type="date"
                        value={parcialData}
                        onChange={e => setParcialData(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 mb-1">Observação</label>
                    <input
                      type="text"
                      value={parcialObs}
                      onChange={e => setParcialObs(e.target.value)}
                      placeholder="Ex: PIX, boleto, adiantamento…"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowParcialForm(false); setParcialCentavos(0); setParcialDisplay(''); setParcialObs('') }}
                      className="flex-1 py-2 rounded-lg border border-border text-xs hover:bg-surface-highlight transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddParcial}
                      disabled={salvandoParcial}
                      className="flex-1 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                    >
                      {salvandoParcial ? 'Salvando...' : 'Adicionar parcial'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setShowParcialForm(true); setParcialData(new Date().toISOString().split('T')[0]) }}
                  className="flex items-center gap-1.5 text-xs font-medium text-yellow-500 hover:text-yellow-400 transition-colors"
                >
                  <Plus size={14} /> Registrar parcial
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Nº do Documento</label>
              <input
                name="numero_documento"
                defaultValue={lancamento?.numero_documento ?? ''}
                placeholder="Ex: NF-001"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Categoria *</label>
              <select
                name="plano_contas_id"
                defaultValue={lancamento?.plano_contas_id ?? ''}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione...</option>
                {planoContas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Banco</label>
            <select
              name="banco_id"
              defaultValue={lancamento?.banco_id ?? ''}
              disabled={temMovimento}
              title={temMovimento ? 'Não é possível trocar o banco após pagamentos registrados.' : undefined}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">Nenhum</option>
              {bancos.map(b => (
                <option key={b.id} value={b.id}>{b.nome}</option>
              ))}
            </select>
          </div>

          {!lancamento && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Recorrência</label>
                  <select
                    name="recorrencia"
                    value={recorrencia}
                    onChange={e => { setRecorrencia(e.target.value as 'NAO' | 'DIARIAMENTE' | 'SEMANALMENTE' | 'MENSALMENTE'); if (e.target.value !== 'NAO') setParcelas(1) }}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="NAO">Sem recorrência</option>
                    <option value="DIARIAMENTE">Diária</option>
                    <option value="SEMANALMENTE">Semanal</option>
                    <option value="MENSALMENTE">Mensal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">
                    Nº de Parcelas
                    {parcelas > 1 && <span className="ml-1 text-indigo-400">(gera {parcelas}x)</span>}
                  </label>
                  <input
                    name="numero_parcelas"
                    type="number"
                    min="1"
                    max="120"
                    value={parcelasInput}
                    disabled={recorrencia !== 'NAO'}
                    onChange={e => {
                      setParcelasInput(e.target.value)
                      const v = parseInt(e.target.value)
                      if (!isNaN(v) && v > 0) { setParcelas(v); if (v > 1) setRecorrencia('NAO') }
                    }}
                    onBlur={() => {
                      const v = parseInt(parcelasInput)
                      const final = isNaN(v) || v < 1 ? 1 : Math.min(v, 120)
                      setParcelas(final)
                      setParcelasInput(String(final))
                    }}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {recorrencia !== 'NAO' && (
                <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  A cada pagamento, o próximo lançamento será criado automaticamente.
                </p>
              )}
              {recorrencia === 'NAO' && parcelas > 1 && (
                <p className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                  Serão criados {parcelas} lançamentos com vencimentos mensais a partir da data informada.
                </p>
              )}
            </div>
          )}

          {/* ANEXOS — só disponível ao editar (precisa do ID do lançamento) */}
          {lancamento && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Paperclip size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Anexos</span>
              </div>

              <ListaAnexos
                anexos={anexos}
                onDelete={async (id) => {
                  const r = await excluirAnexoFinanceiro(id, equipeId)
                  if (!r.success) { toast.error(r.error); return }
                  setAnexos(prev => prev.filter(a => a.id !== id))
                  toast.success('Anexo removido.')
                }}
              />

              <UploadButton
                endpoint="anexoUploader"
                onClientUploadComplete={async (files) => {
                  for (const file of files) {
                    const r = await salvarAnexoFinanceiro({
                      lancamento_id: lancamento.id,
                      equipeId,
                      nome: file.name,
                      url: file.url,
                      key: file.key,
                      tamanho: file.size,
                    })
                    if (r.success) {
                      setAnexos(prev => [...prev, {
                        id: crypto.randomUUID(),
                        lancamento_id: lancamento.id,
                        nome: file.name,
                        url: file.url,
                        key: file.key,
                        tamanho: file.size,
                        dt_upload: new Date().toISOString(),
                      }])
                    }
                  }
                  toast.success('Arquivo(s) enviado(s).')
                }}
                onUploadError={() => { toast.error('Erro ao enviar arquivo.') }}
                appearance={{
                  button: 'bg-surface border border-border text-gray-400 hover:text-foreground hover:bg-surface-highlight text-xs px-3 py-1.5 rounded-lg transition-colors ut-uploading:opacity-50',
                  allowedContent: 'hidden',
                }}
                content={{ button: '+ Adicionar anexo' }}
              />
            </div>
          )}

          {!lancamento && (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Paperclip size={12} /> Salve o lançamento primeiro para adicionar anexos.
            </p>
          )}

          {lancamento?.grupo_parcela_id && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aplicarATodos}
                onChange={e => setAplicarATodos(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-500"
              />
              <span className="text-sm text-gray-300">
                Aplicar alterações a todas as {lancamento.numero_parcelas}x parcelas do grupo
              </span>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors ${tipo === 'DESPESA' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
            >
              {loading ? 'Salvando...' : lancamento ? 'Salvar Alterações' : `Criar ${labelTipo}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
