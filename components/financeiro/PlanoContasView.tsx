'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import { criarPlanoContas, editarPlanoContas, excluirPlanoContas, toggleAtivoPlanoContas } from '@/app/actions'
import type { PlanoContas, TipoLancamento } from '@/types'

type ContaComContagem = PlanoContas & { _count: { lancamentos: number } }

interface Props {
  contas: ContaComContagem[]
}

export default function PlanoContasView({ contas: contasIniciais }: Props) {
  const router = useRouter()
  const [contas, setContas] = useState(contasIniciais)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<ContaComContagem | null>(null)
  const [loading, setLoading] = useState(false)

  const receitas = contas.filter(c => c.tipo === 'RECEITA')
  const despesas = contas.filter(c => c.tipo === 'DESPESA')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)

    const resultado = editando
      ? await editarPlanoContas(formData)
      : await criarPlanoContas(formData)

    if (!resultado.success) {
      toast.error(resultado.error)
      setLoading(false)
      return
    }

    if (editando) {
      setContas(prev => prev.map(c =>
        c.id === editando.id ? { ...c, nome: resultado.data.nome, tipo: resultado.data.tipo } : c
      ))
    } else {
      setContas(prev => [...prev, { ...resultado.data, _count: { lancamentos: 0 } }])
    }

    toast.success(editando ? 'Conta atualizada.' : 'Conta criada.')
    setShowModal(false)
    setEditando(null)
    setLoading(false)
  }

  async function handleToggle(id: string) {
    const resultado = await toggleAtivoPlanoContas(id)
    if (!resultado.success) { toast.error(resultado.error); return }
    setContas(prev => prev.map(c => c.id === id ? { ...c, ativo: !c.ativo } : c))
  }

  async function handleExcluir(conta: ContaComContagem) {
    if (conta._count.lancamentos > 0) {
      toast.error('Esta conta possui lançamentos e não pode ser excluída.')
      return
    }
    if (!confirm(`Excluir a conta "${conta.nome}"?`)) return
    const resultado = await excluirPlanoContas(conta.id)
    if (!resultado.success) { toast.error(resultado.error); return }
    toast.success('Conta excluída.')
    setContas(prev => prev.filter(c => c.id !== conta.id))
  }

  function abrirEditar(conta: ContaComContagem) {
    setEditando(conta)
    setShowModal(true)
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          onClick={() => { setEditando(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Nova Conta
        </button>
      </div>

      {(['RECEITA', 'DESPESA'] as TipoLancamento[]).map(tipo => {
        const lista = tipo === 'RECEITA' ? receitas : despesas
        return (
          <section key={tipo}>
            <h2 className={`text-sm font-semibold uppercase tracking-wider mb-3 ${tipo === 'RECEITA' ? 'text-emerald-400' : 'text-red-400'}`}>
              {tipo === 'RECEITA' ? '📈 Receitas' : '📉 Despesas'} ({lista.length})
            </h2>
            {lista.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center border border-dashed border-border rounded-lg">Nenhuma conta cadastrada.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-2">Nome</th>
                      <th className="text-center px-4 py-2">Lançamentos</th>
                      <th className="text-center px-4 py-2">Status</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {lista.map(conta => (
                      <tr key={conta.id} className="hover:bg-surface/50 transition-colors">
                        <td className={`px-4 py-3 font-medium ${!conta.ativo && 'opacity-40 line-through'}`}>{conta.nome}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{conta._count.lancamentos}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleToggle(conta.id)} className="text-gray-400 hover:text-indigo-400 transition-colors" title={conta.ativo ? 'Desativar' : 'Ativar'}>
                            {conta.ativo ? <ToggleRight size={20} className="text-indigo-400" /> : <ToggleLeft size={20} />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => abrirEditar(conta)} className="p-1 text-gray-400 hover:text-indigo-400 transition-colors" title="Editar">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => handleExcluir(conta)} className="p-1 text-gray-400 hover:text-red-400 transition-colors" title="Excluir">
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
          </section>
        )
      })}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold mb-4">{editando ? 'Editar Conta' : 'Nova Conta'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {editando && <input type="hidden" name="id" value={editando.id} />}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
                <select name="tipo" defaultValue={editando?.tipo ?? 'DESPESA'} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="RECEITA">Receita</option>
                  <option value="DESPESA">Despesa</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nome da Conta</label>
                <input
                  name="nome"
                  defaultValue={editando?.nome ?? ''}
                  placeholder="Ex: Prestação de Serviços"
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
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
    </div>
  )
}
