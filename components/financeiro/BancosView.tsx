'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import { criarBanco, editarBanco, excluirBanco, toggleAtivoBanco } from '@/app/actions'
import ModalExtratoBanco from '@/components/financeiro/ModalExtratoBanco'
import type { Banco } from '@/types'

type BancoComContagem = Banco & { _count: { lancamentos: number } }

interface Props {
  equipeId: string
  bancos: BancoComContagem[]
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function BancosView({ equipeId, bancos: bancosIniciais }: Props) {
  const [bancos, setBancos] = useState(bancosIniciais)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<BancoComContagem | null>(null)
  const [loading, setLoading] = useState(false)
  const [saldoCentavos, setSaldoCentavos] = useState(0)
  const [saldoDisplay, setSaldoDisplay] = useState('')
  const [extratoBanco, setExtratoBanco] = useState<BancoComContagem | null>(null)

  function handleSaldoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const apenasDigitos = e.target.value.replace(/\D/g, '')
    const centavos = parseInt(apenasDigitos || '0', 10)
    setSaldoCentavos(centavos)
    setSaldoDisplay(centavos > 0 ? formatarMoeda(centavos / 100) : '')
  }

  function abrirNovo() {
    setEditando(null)
    setSaldoCentavos(0)
    setSaldoDisplay('')
    setShowModal(true)
  }

  function abrirEditar(banco: BancoComContagem) {
    setEditando(banco)
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    if (!editando) formData.set('saldo_inicial', (saldoCentavos / 100).toFixed(2))

    const resultado = editando
      ? await editarBanco(formData)
      : await criarBanco(formData)

    if (!resultado.success) {
      toast.error(resultado.error)
      setLoading(false)
      return
    }

    if (editando) {
      setBancos(prev => prev.map(b => b.id === editando.id ? { ...b, nome: resultado.data.nome } : b))
    } else {
      const saldo = Number(resultado.data.saldo_inicial)
      setBancos(prev => [...prev, { ...resultado.data, saldo_inicial: saldo, saldo_atual: saldo, _count: { lancamentos: 0 } }])
    }

    toast.success(editando ? 'Banco atualizado.' : 'Banco criado.')
    setShowModal(false)
    setEditando(null)
    setLoading(false)
  }

  async function handleToggle(id: string) {
    const resultado = await toggleAtivoBanco(id, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    setBancos(prev => prev.map(b => b.id === id ? { ...b, ativo: !b.ativo } : b))
  }

  async function handleExcluir(banco: BancoComContagem) {
    if (banco._count.lancamentos > 0) {
      toast.error('Este banco possui lançamentos e não pode ser excluído.')
      return
    }
    if (!confirm(`Excluir o banco "${banco.nome}"?`)) return
    const resultado = await excluirBanco(banco.id, equipeId)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success('Banco excluído.')
    setBancos(prev => prev.filter(b => b.id !== banco.id))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Novo Banco
        </button>
      </div>

      {bancos.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center border border-dashed border-border rounded-lg">Nenhum banco cadastrado.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Nome</th>
                <th className="text-right px-4 py-2">Saldo Inicial</th>
                <th className="text-right px-4 py-2">Saldo Atual</th>
                <th className="text-center px-4 py-2">Lançamentos</th>
                <th className="text-center px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bancos.map(banco => (
                <tr
                  key={banco.id}
                  onClick={() => setExtratoBanco(banco)}
                  className="hover:bg-surface/50 transition-colors cursor-pointer"
                  title="Ver extrato"
                >
                  <td className={`px-4 py-3 font-medium ${!banco.ativo && 'opacity-40 line-through'}`}>{banco.nome}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{formatarMoeda(banco.saldo_inicial)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${banco.saldo_atual < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatarMoeda(banco.saldo_atual)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{banco._count.lancamentos}</td>
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleToggle(banco.id)} className="text-gray-400 hover:text-indigo-400 transition-colors" title={banco.ativo ? 'Desativar' : 'Ativar'}>
                      {banco.ativo ? <ToggleRight size={20} className="text-indigo-400" /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => abrirEditar(banco)} className="p-1 text-gray-400 hover:text-indigo-400 transition-colors" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleExcluir(banco)} className="p-1 text-gray-400 hover:text-red-400 transition-colors" title="Excluir">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold mb-4">{editando ? 'Editar Banco' : 'Novo Banco'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {editando && <input type="hidden" name="id" value={editando.id} />}
              <input type="hidden" name="equipeId" value={equipeId} />
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nome do Banco</label>
                <input
                  name="nome"
                  defaultValue={editando?.nome ?? ''}
                  placeholder="Ex: Banco do Brasil"
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {editando ? (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Saldo Inicial</label>
                  <p className="text-sm text-gray-400 bg-background border border-border rounded-lg px-3 py-2">
                    {formatarMoeda(editando.saldo_inicial)} <span className="text-xs text-gray-500">(não pode ser alterado)</span>
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Saldo Inicial</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={saldoDisplay}
                    onChange={handleSaldoChange}
                    placeholder="R$ 0,00"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Vira o saldo atual do banco a partir de agora.</p>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditando(null) }} className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-surface-highlight transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {extratoBanco && (
        <ModalExtratoBanco
          equipeId={equipeId}
          banco={extratoBanco}
          onClose={() => setExtratoBanco(null)}
        />
      )}
    </div>
  )
}
