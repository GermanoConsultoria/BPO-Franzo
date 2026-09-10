'use client'

import { useState } from 'react'
import { X, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { criarLancamento, editarLancamento, salvarAnexoFinanceiro, excluirAnexoFinanceiro } from '@/app/actions'
import { UploadButton } from '@/lib/uploadthing'
import ListaAnexos from '@/components/ListaAnexos'
import type { LancamentoComRelacoes, PlanoContas, TipoLancamento, AnexoFinanceiro } from '@/types'

interface Props {
  tipo: TipoLancamento
  planoContas: PlanoContas[]
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

export default function ModalLancamento({ tipo, planoContas, lancamento, onClose, onSuccess }: Props) {
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

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const apenasDigitos = e.target.value.replace(/\D/g, '')
    const centavos = parseInt(apenasDigitos || '0', 10)
    setValorCentavos(centavos)
    setValorDisplay(centavos > 0 ? formatarMoeda(centavos) : '')
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
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  const r = await excluirAnexoFinanceiro(id)
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
