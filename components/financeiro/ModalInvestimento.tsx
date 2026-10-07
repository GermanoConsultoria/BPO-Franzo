'use client'

import { useState } from 'react'
import { X, FileUp } from 'lucide-react'
import { toast } from 'sonner'
import { criarInvestimento, editarInvestimento } from '@/app/actions'
import ModalImportarContaPaga from '@/components/financeiro/ModalImportarContaPaga'
import type { Investimento, TipoInvestimento, Banco } from '@/types'

interface Props {
  equipeId: string
  bancos: Banco[]
  investimento?: Investimento
  onClose: () => void
  onSuccess: (investimento: Investimento) => void
}

function formatarMoeda(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseCentavos(valor: number) {
  return Math.round(valor * 100)
}

export default function ModalInvestimento({ equipeId, bancos, investimento, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [mostrarImportar, setMostrarImportar] = useState(false)
  const [tipo, setTipo] = useState<TipoInvestimento>(investimento?.tipo ?? 'APORTE')
  const [valorCentavos, setValorCentavos] = useState(
    investimento ? parseCentavos(Number(investimento.valor)) : 0
  )
  const [valorDisplay, setValorDisplay] = useState(
    investimento ? formatarMoeda(parseCentavos(Number(investimento.valor))) : ''
  )

  const hoje = new Date().toISOString().split('T')[0]

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

    const resultado = investimento
      ? await editarInvestimento(formData)
      : await criarInvestimento(formData)

    if (!resultado.success) {
      toast.error(resultado.error)
      setLoading(false)
      return
    }

    toast.success(investimento ? 'Movimento atualizado.' : 'Movimento registrado.')
    onSuccess({ ...resultado.data, valor: Number(resultado.data.valor) })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface">
          <h2 className="text-lg font-bold">{investimento ? 'Editar' : 'Novo'} Movimento</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {investimento && <input type="hidden" name="id" value={investimento.id} />}
          <input type="hidden" name="equipeId" value={equipeId} />

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo('APORTE')}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${tipo === 'APORTE' ? 'bg-yellow-600 border-yellow-500 text-white' : 'bg-background border-border text-gray-400 hover:text-foreground'}`}
              >
                Aporte (entrada)
              </button>
              <button
                type="button"
                onClick={() => setTipo('RESGATE')}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${tipo === 'RESGATE' ? 'bg-yellow-600 border-yellow-500 text-white' : 'bg-background border-border text-gray-400 hover:text-foreground'}`}
              >
                Resgate (saída)
              </button>
            </div>
            {!investimento && tipo === 'APORTE' && (
              <button
                type="button"
                onClick={() => setMostrarImportar(true)}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border text-xs font-medium text-gray-400 hover:text-yellow-400 hover:border-yellow-500/40 transition-colors"
              >
                <FileUp size={13} /> Importar de Contas a Pagar
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descrição *</label>
            <input
              name="descricao"
              defaultValue={investimento?.descricao ?? ''}
              placeholder={tipo === 'APORTE' ? 'Ex: Aporte em CDB' : 'Ex: Resgate para capital de giro'}
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

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
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Data *</label>
              <input
                name="dt_movimento"
                type="date"
                defaultValue={investimento ? new Date(investimento.dt_movimento).toISOString().split('T')[0] : hoje}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nº do Documento</label>
            <input
              name="numero_documento"
              defaultValue={investimento?.numero_documento ?? ''}
              placeholder="Ex: comprovante, nota de corretagem..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Banco</label>
            <select
              name="banco_id"
              defaultValue={investimento?.banco_id ?? ''}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">Nenhum</option>
              {bancos.map(b => (
                <option key={b.id} value={b.id}>{b.nome}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Vincular não altera o saldo atual do banco — só compõe o saldo real/investido exibido no extrato dele.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Salvando...' : investimento ? 'Salvar Alterações' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>

      {mostrarImportar && (
        <ModalImportarContaPaga
          equipeId={equipeId}
          onClose={() => setMostrarImportar(false)}
          onImportado={investimentoImportado => {
            onSuccess(investimentoImportado)
            onClose()
          }}
        />
      )}
    </div>
  )
}
