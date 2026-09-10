'use client'

import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { criarTarefa, getCommitsDoProjeto } from '@/app/actions'
import { Github } from 'lucide-react'
import type { ProjetoComColunas, UsuarioBasico, CommitGithubOpcao } from '@/types'
import type { Recorrencia } from '@prisma/client'

interface Props {
  listaProjetos: ProjetoComColunas[]
  usuarios: UsuarioBasico[]
}

export default function ModalCriarTarefaGeral({ listaProjetos, usuarios }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Estados locais
  const [projetoId, setProjetoId] = useState(listaProjetos.length > 0 ? listaProjetos[0].id : '')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dtVencimento, setDtVencimento] = useState('')
  const [colunaId, setColunaId] = useState('')
  const [prioridadeId, setPrioridadeId] = useState('2')
  const [dificuldadeId, setDificuldadeId] = useState('3')
  const [usuarioId, setUsuarioId] = useState('')

  const [commitsDisponiveis, setCommitsDisponiveis] = useState<CommitGithubOpcao[]>([])
  const [commitSelecionado, setCommitSelecionado] = useState('')

  useEffect(() => {
    if (isOpen) {
      // getCommitsDoProjeto já retorna [] quando não há projeto ou repositório vinculado
      getCommitsDoProjeto(projetoId).then(dados => {
        setCommitsDisponiveis(dados)
        setCommitSelecionado('')
      })
    }
  }, [isOpen, projetoId])

  const [recorrencia, setRecorrencia] = useState<Recorrencia>('NAO')
  const [diasRecorrencia, setDiasRecorrencia] = useState<number[]>([0,1,2,3,4,5,6])
  const [diaMesRecorrencia, setDiaMesRecorrencia] = useState<number>(1)

  const DIAS_SEMANA = [
    { idx: 0, label: 'DOM' },
    { idx: 1, label: 'SEG' },
    { idx: 2, label: 'TER' },
    { idx: 3, label: 'QUA' },
    { idx: 4, label: 'QUI' },
    { idx: 5, label: 'SEX' },
    { idx: 6, label: 'SAB' },
  ]

  const colunasDoProjeto = useMemo(() => {
    const projeto = listaProjetos.find(p => p.id === projetoId)
    return projeto ? projeto.colunas.map(pc => pc.coluna) : []
  }, [listaProjetos, projetoId])

  const toggleDia = (idx: number) =>
    setDiasRecorrencia(prev =>
      prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
    )

  const handleProjetoChange = (novoProjetoId: string) => {
    setProjetoId(novoProjetoId)
    const projeto = listaProjetos.find(p => p.id === novoProjetoId)
    setColunaId(projeto && projeto.colunas.length > 0 ? projeto.colunas[0].coluna.id : '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo || !usuarioId || !projetoId) return;

    setIsSaving(true)

    // Ajuste Fuso Horário (Meio-dia)
    let dataIso = null
    if (dtVencimento) {
        const [ano, mes, dia] = dtVencimento.split('-').map(Number)
        dataIso= new Date(ano, mes-1, dia, 12, 0, 0)
    }

    const resultado = await criarTarefa({
        titulo,
        descricao,
        dt_vencimento: dataIso,
        projeto_id: projetoId,
        coluna_id: colunaId,
        prioridade_id: Number(prioridadeId),
        dificuldade_id: Number(dificuldadeId),
        usuario_id: usuarioId,
        recorrencia,
        dias_recorrencia: recorrencia !== 'NAO' && recorrencia !== 'MENSALMENTE' && diasRecorrencia.length > 0
          ? diasRecorrencia.sort((a, b) => a - b).join(',')
          : null,
        dia_mes_recorrencia: recorrencia === 'MENSALMENTE' ? diaMesRecorrencia : null,
        github_commit_sha: commitSelecionado || null,
        concluida: !!commitSelecionado,
    })

    setIsSaving(false)
    if (!resultado.success) {
      toast.error(resultado.error)
      return
    }
    setIsOpen(false)

    // Limpa form
    setTitulo('')
    setDescricao('')
    setDtVencimento('')
    setRecorrencia('NAO')
    setDiasRecorrencia([0,1,2,3,4,5,6])
    setDiaMesRecorrencia(1)
    setCommitSelecionado('')
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={listaProjetos.length === 0}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-lg leading-none">+</span>
        Nova Tarefa
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />

          <div className="relative bg-surface rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border border-border">

            <div className="px-6 py-4 border-b border-border bg-surface-highlight/20 flex justify-between items-center">
              <h2 className="text-lg font-bold text-foreground">Criar Nova Tarefa</h2>
              <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-foreground">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* PROJETO */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Projeto</label>
                <select
                    value={projetoId} onChange={e => handleProjetoChange(e.target.value)}
                    required
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="">Selecione...</option>
                    {listaProjetos.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                </select>
              </div>

              {/* TÍTULO */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Título</label>
                <input
                  value={titulo} onChange={e => setTitulo(e.target.value)}
                  required
                  autoFocus
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none placeholder-text-muted"
                  placeholder="O que precisa ser feito?"
                />
              </div>

              {/* DESCRIÇÃO */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Descrição</label>
                <textarea
                  value={descricao} onChange={e => setDescricao(e.target.value)}
                  rows={3}
                  required
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none placeholder-text-muted resize-none"
                  placeholder="Detalhes da tarefa..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* DATA */}
                <div>
                   <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Vencimento</label>
                   <input
                      type="date"
                      value={dtVencimento} onChange={e => setDtVencimento(e.target.value)}
                      required
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none scheme-dark"
                   />
                </div>

                {/* COLUNA INICIAL */}
                <div>
                   <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Etapa Inicial</label>
                   <select value={colunaId} onChange={e => setColunaId(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none">
                      {colunasDoProjeto.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                   </select>
                </div>
              </div>

              {/* --- NOVA LINHA: PRIORIDADE E RECORRÊNCIA --- */}
              <div className="grid grid-cols-2 gap-4">
                 {/* PRIORIDADE */}
                 <div>
                   <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Prioridade</label>
                   <select
                      value={prioridadeId} onChange={e => setPrioridadeId(e.target.value)}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
                   >
                      <option value="1">1 - Baixa</option>
                      <option value="2">2 - Média</option>
                      <option value="3">3 - Alta</option>
                   </select>
                </div>

                {/* RECORRÊNCIA */}
                <div>
                   <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Repetir</label>
                   <select
                      value={recorrencia} onChange={e => setRecorrencia(e.target.value as Recorrencia)}
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
                   >
                      <option value="NAO">Nunca</option>
                      <option value="DIARIAMENTE">Diariamente</option>
                      <option value="SEMANALMENTE">Semanalmente</option>
                      <option value="MENSALMENTE">Mensalmente</option>
                   </select>
                </div>
              </div>

              {/* SELETOR DE DIAS / DIA DO MÊS */}
              {recorrencia !== 'NAO' && (
                <div>
                  {recorrencia === 'MENSALMENTE' ? (
                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Dia do mês</label>
                      <input
                        type="number"
                        min={1} max={31}
                        value={diaMesRecorrencia}
                        onChange={e => setDiaMesRecorrencia(Math.min(31, Math.max(1, Number(e.target.value))))}
                        className="w-24 bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Dias da semana</label>
                      <div className="flex gap-1.5">
                        {DIAS_SEMANA.map(d => (
                          <button
                            key={d.idx}
                            type="button"
                            onClick={() => toggleDia(d.idx)}
                            className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                              diasRecorrencia.includes(d.idx)
                                ? 'bg-indigo-600 text-white'
                                : 'bg-surface border border-border text-text-muted hover:border-indigo-400'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DIFICULDADE E RESPONSÁVEL */}
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Dificuldade</label>
                    <select
                        value={dificuldadeId} onChange={e => setDificuldadeId(e.target.value)}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="1">1 - Muito Fácil</option>
                        <option value="2">2 - Fácil</option>
                        <option value="3">3 - Média</option>
                        <option value="4">4 - Difícil</option>
                        <option value="5">5 - Muito Difícil</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Responsável</label>
                    <select value={usuarioId} onChange={e => setUsuarioId(e.target.value)} required className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option value="">Selecione...</option>
                        {usuarios.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                        ))}
                    </select>
                  </div>
              </div>

              {/* VÍNCULO COM COMMIT GITHUB */}
              {commitsDisponiveis.length > 0 && (
                <div className="border-t border-border pt-4">
                  <label className="block text-xs font-semibold text-text-muted uppercase mb-1 flex items-center gap-1">
                    <Github size={12} /> Vincular a um commit (opcional)
                  </label>
                  <select
                    value={commitSelecionado}
                    onChange={e => setCommitSelecionado(e.target.value)}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">Nenhum</option>
                    {commitsDisponiveis.map(c => (
                      <option key={c.sha} value={c.sha}>{c.sha.slice(0, 7)} — {c.message}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-muted mt-1">Vincular a um commit marca a tarefa como concluída automaticamente.</p>
                </div>
              )}

              <div className="flex justify-end pt-4 gap-2 border-t border-border mt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? 'Criando...' : 'Criar Tarefa'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  )
}
