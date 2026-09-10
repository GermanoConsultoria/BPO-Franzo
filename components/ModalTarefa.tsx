'use client'

import { useState, useTransition, useEffect, ClipboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { atualizarTarefa, excluirTarefa, adicionarComentario, excluirAnexo, concluirTarefaComComentario, getCommitsDoProjeto, vincularCommitATarefa } from '@/app/actions'
import BotaoAnexo from '@/components/BotaoAnexo'
import BotaoDeletar from './BotaoDeletar'
import ItemComentario from './ItemComentario'
import ModalConclusao from './ModalConclusao'
import { X, Loader2, Github } from 'lucide-react'
import { useUploadThing } from "@/lib/uploadthing"
import type { TarefaComRelacoes, UsuarioBasico, ProjetoComColunas, Anexo, ComentarioComUsuario, Recorrencia, CommitGithubOpcao } from '@/types'

interface Props {
    tarefa: TarefaComRelacoes
    isOpen: boolean
    onClose: () => void
    usuarios: UsuarioBasico[]
    projetos: ProjetoComColunas[]
    usuarioLogadoId: string
}

export default function ModalTarefa({ tarefa, isOpen, onClose, usuarios, projetos, usuarioLogadoId }: Props) {
    const [isPending, startTransition] = useTransition()
    const [modoEdicao, setModoEdicao] = useState(false)
    const [modalConclusaoAberto, setModalConclusaoAberto] = useState(false)
    const [isSavingConclusao, setIsSavingConclusao] = useState(false)

    const router = useRouter()

    // --- ESTADOS DA TAREFA ---
    const [titulo, setTitulo] = useState('')
    const [descricao, setDescricao] = useState('')
    const [prioridadeId, setPrioridadeId] = useState('2')
    const [dificuldadeId, setDificuldadeId] = useState('3')
    const [usuarioId, setUsuarioId] = useState('')
    const [dtVencimento, setDtVencimento] = useState('')
    const [listaAnexos, setListaAnexos] = useState<Anexo[]>([])
    const [colunaId, setColunaId] = useState(tarefa?.coluna_id || '')
    const [recorrencia, setRecorrencia] = useState<Recorrencia>(tarefa?.recorrencia || 'NAO')
    const [diasRecorrencia, setDiasRecorrencia] = useState<number[]>(
        tarefa?.dias_recorrencia ? tarefa.dias_recorrencia.split(',').map(Number) : [0,1,2,3,4,5,6]
    )
    const [diaMesRecorrencia, setDiaMesRecorrencia] = useState<number>(tarefa?.dia_mes_recorrencia || 1)

    // --- ESTADOS DO VÍNCULO COM COMMIT GITHUB ---
    const [commitsDisponiveis, setCommitsDisponiveis] = useState<CommitGithubOpcao[]>([])
    const [commitSelecionadoVinculo, setCommitSelecionadoVinculo] = useState('')
    const [commitVinculadoAtual, setCommitVinculadoAtual] = useState('')
    const [isVinculandoCommit, setIsVinculandoCommit] = useState(false)
    const [concluidaAtual, setConcluidaAtual] = useState(false)

    const DIAS_SEMANA = [
        { idx: 0, label: 'DOM' }, { idx: 1, label: 'SEG' }, { idx: 2, label: 'TER' },
        { idx: 3, label: 'QUA' }, { idx: 4, label: 'QUI' }, { idx: 5, label: 'SEX' },
        { idx: 6, label: 'SAB' },
    ]
    const toggleDia = (idx: number) =>
        setDiasRecorrencia(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])

    // --- ESTADOS DO COMENTÁRIO ---
    const [novoComentario, setNovoComentario] = useState('')
    const [listaComentarios, setListaComentarios] = useState<ComentarioComUsuario[]>([])
    
    // Novidades para o Print
    const [printImagem, setPrintImagem] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isUploadingComment, setIsUploadingComment] = useState(false)

    // Hook do UploadThing (Rota 'comentarioImage' que criamos no core.ts)
    const { startUpload } = useUploadThing("comentarioImage")

    const projetoAtual = projetos.find(p => p.id === tarefa?.projeto_id)
    const colunasDisponiveis = projetoAtual?.colunas?.map(c => c.coluna) ?? []

    useEffect(() => {
        if (isOpen && tarefa) {
            setTitulo(tarefa.titulo)
            setDescricao(tarefa.descricao || '')
            setPrioridadeId(String(tarefa.prioridade_id || '2'))
            setDificuldadeId(String(tarefa.dificuldade_id || '3'))
            setUsuarioId(tarefa.usuario_id || '')
            setColunaId(tarefa.coluna_id || '')
            setRecorrencia(tarefa.recorrencia || 'NAO')
            setDiasRecorrencia(tarefa.dias_recorrencia ? tarefa.dias_recorrencia.split(',').map(Number) : [0,1,2,3,4,5,6])
            setDiaMesRecorrencia(tarefa.dia_mes_recorrencia || 1)
            setListaAnexos(tarefa.anexos || [])

            const comentariosOrdenados = [...(tarefa.comentarios || [])].sort((a, b) =>
                new Date(b.dt_insert).getTime() - new Date(a.dt_insert).getTime()
            )
            setListaComentarios(comentariosOrdenados)

            if (tarefa.dt_vencimento) {
                const iso = new Date(tarefa.dt_vencimento).toISOString().split('T')[0]
                setDtVencimento(iso)
            } else {
                setDtVencimento('')
            }

            setCommitSelecionadoVinculo(tarefa.github_commit_sha || '')
            setCommitVinculadoAtual(tarefa.github_commit_sha || '')
            setConcluidaAtual(tarefa.concluida)
            getCommitsDoProjeto(tarefa.projeto_id, tarefa.id).then(dados => setCommitsDisponiveis(dados))
        }
    }, [isOpen, tarefa])

    const handleVincularCommit = async () => {
        setIsVinculandoCommit(true)
        const commit = commitsDisponiveis.find(c => c.sha === commitSelecionadoVinculo)
        const resultado = await vincularCommitATarefa(tarefa.id, tarefa.projeto_id, commitSelecionadoVinculo || null, commit?.message)
        setIsVinculandoCommit(false)
        if (!resultado.success) {
            toast.error(resultado.error || 'Erro ao vincular commit.')
            return
        }
        setCommitVinculadoAtual(commitSelecionadoVinculo)
        setConcluidaAtual(!!commitSelecionadoVinculo)
        toast.success(commitSelecionadoVinculo ? 'Commit vinculado. Tarefa marcada como concluída.' : 'Commit desvinculado. Tarefa reaberta.')
        router.refresh()
    }

    if (!isOpen) return null

    // --- LÓGICA DE COLAR (PASTE) ---
    const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault() // Impede colar o nome do arquivo texto
                const file = item.getAsFile()
                if (file) {
                    setPrintImagem(file)
                    setPreviewUrl(URL.createObjectURL(file))
                }
            }
        }
    }

    const limparPreview = () => {
        setPrintImagem(null)
        setPreviewUrl(null)
    }

    // --- ENVIO DO COMENTÁRIO ---
    const handleEnviarComentario = async () => {
        if (!novoComentario.trim() && !printImagem) return

        setIsUploadingComment(true)

        // Captura os valores antes de limpar o form
        const textoEnviar = novoComentario
        const imagemParaUpload = printImagem

        try {
            let imagemFinalUrl: string | null = null

            // 1. Upload da Imagem (se houver)
            if (imagemParaUpload) {
                const res = await startUpload([imagemParaUpload])
                if (res && res[0]) {
                    imagemFinalUrl = res[0].url
                }
            }

            // 2. ID Temporário único
            const tempId = crypto.randomUUID()
            const tempComentario: ComentarioComUsuario = {
                id: tempId,
                texto: textoEnviar,
                imagemUrl: previewUrl,
                dt_insert: new Date(),
                dt_update: new Date(),
                tarefa_id: tarefa.id,
                usuario_id: usuarioLogadoId,
                usuario: { id: usuarioLogadoId, nome: 'Eu', imagem: null, cargo: null },
            }

            // Limpa form ANTES de mostrar o otimista (evita double-submit)
            setNovoComentario('')
            limparPreview()

            // 3. Atualiza UI de forma otimista
            setListaComentarios(prev => [tempComentario, ...prev])

            // 4. Salva no Banco
            const comentarioReal = await adicionarComentario(tarefa.id, textoEnviar, imagemFinalUrl)

            if (comentarioReal) {
                // Substitui o temporário pelo real
                setListaComentarios(prev => prev.map(c => c.id === tempId ? comentarioReal : c))
            } else {
                // Rollback: remove o temporário se a requisição falhou sem lançar erro
                setListaComentarios(prev => prev.filter(c => c.id !== tempId))
            }
        } catch {
            // Rollback: remove o comentário temporário da UI
            setListaComentarios(prev => prev.filter(c => c.usuario_id === usuarioLogadoId && c.texto !== textoEnviar))
        } finally {
            setIsUploadingComment(false)
        }
    }

    // Helpers de Data e Visual
    const formatarDataExibicao = (dataString: Date | string | null) => {
        if (!dataString) return 'Sem data';
        return new Date(dataString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    }

    const formatarDataHora = (dataString: Date | string | null | undefined) => {
        if (!dataString) return '-';
        return new Date(dataString).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }

    const renderPreview = (anexo: Anexo) => {
        const ext = anexo.nome.split('.').pop()?.toLowerCase() || '';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return (
                <div className="w-14 h-14 rounded overflow-hidden border border-gray-200 shrink-0 bg-gray-100">
                    <img src={anexo.url} alt="preview" className="w-full h-full object-cover" />
                </div>
            )
        }
        if (ext === 'pdf') {
            return (
                <div className="w-14 h-14 rounded bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                    <span className="text-[8px] font-bold">PDF</span>
                </div>
            )
        }
        return (
            <div className="w-14 h-14 rounded bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 border border-gray-200">
                <span className="text-[8px] font-bold">FILE</span>
            </div>
        )
    }

    const handleConfirmarConclusao = async (comentario: string) => {
        setIsSavingConclusao(true)
        const commit = commitsDisponiveis.find(c => c.sha === commitSelecionadoVinculo)
        const resultado = await concluirTarefaComComentario(
            tarefa.id,
            comentario,
            tarefa.projeto_id,
            usuarioLogadoId,
            commitSelecionadoVinculo || null,
            commit?.message
        )
        setIsSavingConclusao(false)
        if (!resultado.success) {
            toast.error(resultado.error || 'Erro ao concluir a tarefa.')
            return
        }
        if (commitSelecionadoVinculo) {
            setCommitVinculadoAtual(commitSelecionadoVinculo)
        }
        setModalConclusaoAberto(false)
        setConcluidaAtual(true)
        router.refresh()
        onClose()
    }

    const handleSalvar = () => {
        startTransition(async () => {
            let dataIso = null
            if (dtVencimento) {
                const [ano, mes, dia] = dtVencimento.split('-').map(Number)
                dataIso = new Date(ano, mes - 1, dia, 12, 0, 0)
            }

            await atualizarTarefa(tarefa.id, {
                titulo,
                descricao,
                dt_vencimento: dataIso,
                prioridade_id: Number(prioridadeId),
                dificuldade_id: Number(dificuldadeId),
                usuario_id: usuarioId || null,
                coluna_id: colunaId,
                recorrencia: recorrencia,
                dias_recorrencia: recorrencia !== 'NAO' && recorrencia !== 'MENSALMENTE' && diasRecorrencia.length > 0
                    ? diasRecorrencia.sort((a, b) => a - b).join(',')
                    : null,
                dia_mes_recorrencia: recorrencia === 'MENSALMENTE' ? diaMesRecorrencia : null,
            }, tarefa.projeto_id)

            setModoEdicao(false)
            router.refresh()
            onClose()
        })
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-surface w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border animate-in zoom-in-95 duration-200">

                {/* HEADER */}
                <div className="flex justify-between items-start p-5 border-b border-border bg-surface-highlight/20">
                    <div className="flex-1 mr-4">
                        {modoEdicao ? (
                            <input
                                value={titulo}
                                onChange={e => setTitulo(e.target.value)}
                                className="w-full text-xl font-bold bg-white border border-indigo-300 rounded px-2 py-1 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        ) : (
                            <h2 className="text-xl font-bold text-foreground leading-tight">{tarefa.titulo}</h2>
                        )}
                        <div className="text-xs text-text-muted mt-1 flex gap-2">
                            <span>Em: {tarefa.projeto?.nome}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-foreground text-2xl leading-none">&times;</button>
                </div>

                {/* BODY */}
                <div className="p-6 overflow-y-auto custom-scrollbar-thin space-y-6 flex-1">

                    {/* GRID DE METADADOS */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface-highlight/10 p-4 rounded-lg border border-border">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Etapa Atual</label>
                            {modoEdicao ? (
                                <select value={colunaId} onChange={e => setColunaId(e.target.value)} className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-foreground">
                                    <option value="">Não Classificado</option>
                                    {colunasDisponiveis.map(col => <option key={col.id} value={col.id}>{col.nome}</option>)}
                                </select>
                            ) : (
                                <div className="flex items-center gap-1"><span className="text-sm font-medium text-foreground">{colunasDisponiveis.find(c => c.id === colunaId)?.nome || 'Não Classificado'}</span></div>
                            )}
                        </div>
                        <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Recorrência</label>
                            {modoEdicao ? (
                                <div className="space-y-2">
                                    <select value={recorrencia} onChange={e => setRecorrencia(e.target.value as Recorrencia)} className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-foreground">
                                        <option value="NAO">Não repetir</option>
                                        <option value="DIARIAMENTE">Diariamente</option>
                                        <option value="SEMANALMENTE">Semanalmente</option>
                                        <option value="MENSALMENTE">Mensalmente</option>
                                    </select>
                                    {recorrencia !== 'NAO' && recorrencia !== 'MENSALMENTE' && (
                                        <div className="flex gap-1">
                                            {DIAS_SEMANA.map(d => (
                                                <button key={d.idx} type="button" onClick={() => toggleDia(d.idx)}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${diasRecorrencia.includes(d.idx) ? 'bg-indigo-600 text-white' : 'bg-surface border border-border text-text-muted hover:border-indigo-400'}`}>
                                                    {d.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {recorrencia === 'MENSALMENTE' && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-text-muted">Dia do mês:</span>
                                            <input type="number" min={1} max={31} value={diaMesRecorrencia}
                                                onChange={e => setDiaMesRecorrencia(Math.min(31, Math.max(1, Number(e.target.value))))}
                                                className="w-16 bg-surface border border-border rounded px-2 py-1 text-sm text-foreground focus:ring-1 focus:ring-indigo-500 outline-none" />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm font-medium text-foreground">
                                    {recorrencia === 'NAO' && 'Não'}
                                    {recorrencia === 'DIARIAMENTE' && (
                                        <span>Diária 🔄{tarefa.dias_recorrencia ? ` — ${tarefa.dias_recorrencia.split(',').map(n => DIAS_SEMANA[Number(n)]?.label).join(', ')}` : ''}</span>
                                    )}
                                    {recorrencia === 'SEMANALMENTE' && (
                                        <span>Semanal 🔄{tarefa.dias_recorrencia ? ` — ${tarefa.dias_recorrencia.split(',').map(n => DIAS_SEMANA[Number(n)]?.label).join(', ')}` : ''}</span>
                                    )}
                                    {recorrencia === 'MENSALMENTE' && (
                                        <span>Mensal 🔄{tarefa.dia_mes_recorrencia ? ` — dia ${tarefa.dia_mes_recorrencia}` : ''}</span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Vencimento</label>
                            {modoEdicao ? (
                                <input type="date" value={dtVencimento} onChange={e => setDtVencimento(e.target.value)} className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-foreground scheme-dark" />
                            ) : (
                                <div className="flex items-center gap-1 text-sm font-medium text-foreground"><span>{formatarDataExibicao(tarefa.dt_vencimento)}</span></div>
                            )}
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Prioridade</label>
                            {modoEdicao ? (
                                <select value={prioridadeId} onChange={e => setPrioridadeId(e.target.value)} className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-foreground">
                                    <option value="1">1 - Baixa</option>
                                    <option value="2">2 - Média</option>
                                    <option value="3">3 - Alta</option>
                                </select>
                            ) : (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${tarefa.prioridade_id === 3 ? 'bg-red-500/10 text-red-500 border-red-500/20' : (tarefa.prioridade_id === 2 ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20')}`}>{tarefa.prioridade?.nome || 'Normal'}</span>
                            )}
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Responsável</label>
                            {modoEdicao ? (
                                <select value={usuarioId} onChange={e => setUsuarioId(e.target.value)} className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-foreground">
                                    <option value="">Sem dono</option>
                                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                                </select>
                            ) : (
                                <div className="flex items-center gap-2">
                                    {tarefa.usuario ? (
                                        <div className="flex items-center gap-1.5" title={tarefa.usuario.nome}>
                                            <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center text-[9px] font-bold border border-indigo-500/30">{tarefa.usuario.nome.substring(0, 1).toUpperCase()}</div>
                                            <span className="text-sm text-foreground truncate max-w-[80px]">{tarefa.usuario.nome.split(' ')[0]}</span>
                                        </div>
                                    ) : <span className="text-sm text-text-muted italic">--</span>}
                                </div>
                            )}
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Dificuldade</label>
                            {modoEdicao ? (
                                <select value={dificuldadeId} onChange={e => setDificuldadeId(e.target.value)} className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-foreground">
                                    <option value="1">1 - Muito Fácil</option>
                                    <option value="2">2 - Fácil</option>
                                    <option value="3">3 - Média</option>
                                    <option value="4">4 - Difícil</option>
                                    <option value="5">5 - Muito Difícil</option>
                                </select>
                            ) : (
                                <span className="text-sm font-medium text-foreground">{tarefa.dificuldade?.nome || 'Média'}</span>
                            )}
                        </div>
                    </div>

                    {/* DESCRIÇÃO */}
                    <div>
                        <h3 className="text-xs font-bold text-text-muted uppercase mb-2">Descrição</h3>
                        {modoEdicao ? (
                            <textarea
                                value={descricao}
                                onChange={e => setDescricao(e.target.value)}
                                rows={4}
                                className="w-full bg-surface border border-border rounded-lg p-3 text-sm text-foreground focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            />
                        ) : (
                            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed bg-surface-highlight/5 p-3 rounded-lg border border-border/50">
                                {tarefa.descricao || <span className="italic text-text-muted">Sem descrição.</span>}
                            </div>
                        )}
                    </div>

                    {/* VÍNCULO COM COMMIT GITHUB */}
                    {(commitsDisponiveis.length > 0 || commitVinculadoAtual) && (
                        <div className="border-t border-border pt-4">
                            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                                <Github size={16} /> Commit vinculado
                            </h3>
                            {commitVinculadoAtual ? (
                                <p className="text-xs text-text-muted mb-2 flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-bold">✓ Vinculada</span>
                                    ao commit{' '}
                                    {projetoAtual?.github_repo_full_name ? (
                                        <a
                                            href={`https://github.com/${projetoAtual.github_repo_full_name}/commit/${commitVinculadoAtual}`}
                                            target="_blank"
                                            className="text-indigo-500 hover:underline font-mono"
                                        >
                                            {commitVinculadoAtual.slice(0, 7)}
                                        </a>
                                    ) : (
                                        <span className="font-mono">{commitVinculadoAtual.slice(0, 7)}</span>
                                    )}
                                </p>
                            ) : (
                                <p className="text-xs text-text-muted mb-2">Nenhum commit vinculado a esta tarefa ainda.</p>
                            )}
                            <div className="flex gap-2">
                                <select
                                    value={commitSelecionadoVinculo}
                                    onChange={e => setCommitSelecionadoVinculo(e.target.value)}
                                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">Nenhum</option>
                                    {commitsDisponiveis.map(c => (
                                        <option key={c.sha} value={c.sha}>{c.sha.slice(0, 7)} — {c.message}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleVincularCommit}
                                    disabled={isVinculandoCommit || commitSelecionadoVinculo === commitVinculadoAtual}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    {isVinculandoCommit ? 'Salvando...' : 'Vincular'}
                                </button>
                            </div>
                            <p className="text-[10px] text-text-muted mt-1">Vincular a um commit marca a tarefa como concluída automaticamente.</p>
                        </div>
                    )}

                    {/* ANEXOS */}
                    <div className="border-t border-border pt-4">
                        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                            📎 Anexos
                            {listaAnexos.length > 0 && (
                                <span className="bg-surface-highlight px-2 py-0.5 rounded-full text-xs text-text-muted">{listaAnexos.length}</span>
                            )}
                        </h3>

                        <div className="flex gap-3 overflow-x-auto pb-2 mb-4 custom-scrollbar-thin">
                            {listaAnexos.map((anexo) => (
                                <div
                                    key={anexo.id}
                                    className="flex-shrink-0 w-[250px] flex items-center justify-between p-3 bg-surface border border-border rounded-lg group hover:border-indigo-500/50 transition-colors"
                                >
                                    <a href={anexo.url} target="_blank" className="flex items-center gap-3 overflow-hidden flex-1">
                                        {renderPreview(anexo)}
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-sm font-bold text-foreground truncate" title={anexo.nome}>{anexo.nome}</span>
                                            <span className="text-[10px] text-text-muted">{Math.round(anexo.tamanho / 1024)} KB</span>
                                        </div>
                                    </a>
                                    <div className="ml-2 flex-shrink-0">
                                        <BotaoDeletar
                                            titulo="Excluir Anexo?"
                                            descricao={`Deseja realmente apagar o arquivo "${anexo.nome}"?`}
                                            onConfirm={async () => {
                                                setListaAnexos(curr => curr.filter(a => a.id !== anexo.id))
                                                await excluirAnexo(anexo.id)
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {listaAnexos.length === 0 && (
                                <p className="text-xs text-text-muted italic w-full">Nenhum anexo encontrado.</p>
                            )}
                        </div>

                        <div className="mt-2">
                            <BotaoAnexo
                                tarefaId={tarefa.id}
                                onUploadComplete={(novoAnexo) => {
                                    if (novoAnexo) setListaAnexos(antigos => [...antigos, novoAnexo])
                                }}
                            />
                        </div>
                    </div>

                    {/* COMENTÁRIOS COM LÓGICA DE PASTE */}
                    <div className="border-t border-border pt-4">
                        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                            💬 Comentários <span className="bg-surface-highlight px-2 py-0.5 rounded-full text-xs text-text-muted">{listaComentarios.length}</span>
                        </h3>

                        <div className="space-y-3 mb-4 max-h-[200px] overflow-y-auto custom-scrollbar-thin pr-2">
                            {listaComentarios.length === 0 ? (
                                <div className="text-center py-4 bg-surface-highlight/5 rounded-lg border border-dashed border-border">
                                    <p className="text-xs text-text-muted">Nenhum comentário. Seja o primeiro!</p>
                                </div>
                            ) : (
                                listaComentarios.map((c) => (
                                    <ItemComentario
                                        key={c.id}
                                        comentario={c}
                                        usuarioLogadoId={usuarioLogadoId}
                                        onDeleteSuccess={(idDeletado) => {
                                            setListaComentarios(prev => prev.filter(item => item.id !== idDeletado))
                                        }}
                                    />
                                ))
                            )}
                        </div>

                        {/* ÁREA DE INPUT COM PREVIEW E PASTE */}
                        <div className="flex flex-col gap-2 bg-surface-highlight/5 p-2 rounded-lg border border-border">
                            
                            {/* Preview da Imagem Colada */}
                            {previewUrl && (
                                <div className="relative inline-block w-fit mb-2 group animate-in zoom-in-95">
                                    <div className="border border-indigo-500/50 rounded-lg overflow-hidden relative">
                                        <img src={previewUrl} alt="Print" className="h-24 w-auto object-contain bg-black/20" />
                                        <button
                                            onClick={limparPreview}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                            title="Remover imagem"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-indigo-400 font-medium mt-1 block">Imagem pronta para envio</span>
                                </div>
                            )}

                            <div className="flex gap-2 items-end">
                                <div className="flex-1 relative">
                                    <textarea
                                        value={novoComentario}
                                        onChange={e => setNovoComentario(e.target.value)}
                                        onPaste={handlePaste} // <--- MÁGICA AQUI
                                        placeholder="Escreva um comentário..."
                                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-indigo-500 outline-none resize-none h-[50px] min-h-[50px] max-h-[120px] custom-scrollbar-thin"
                                        disabled={isUploadingComment}
                                    />
                                </div>

                                <button
                                    onClick={handleEnviarComentario}
                                    disabled={(!novoComentario.trim() && !printImagem) || isUploadingComment}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 h-[50px] rounded-lg flex items-center justify-center transition-colors min-w-[50px]"
                                >
                                    {isUploadingComment ? <Loader2 className="animate-spin" size={18} /> : 'Enviar'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 text-[9px] text-text-muted pt-2 opacity-60">
                        <p>Criado: {formatarDataHora(tarefa.dt_insert)}</p>
                        {tarefa.dt_update && <p>Atualizado: {formatarDataHora(tarefa.dt_update)}</p>}
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-4 bg-surface border-t border-border flex justify-between items-center">
                    {modoEdicao ? (
                        <>
                            <BotaoDeletar
                                texto="Excluir Tarefa"
                                titulo="Excluir Tarefa?"
                                descricao="Isso apagará a tarefa, todos os comentários e anexos permanentemente."
                                onConfirm={async () => {
                                    await excluirTarefa(tarefa.id, tarefa.projeto_id)
                                    router.refresh()
                                    onClose()
                                }}
                            />
                            <div className="flex gap-2">
                                <button onClick={() => setModoEdicao(false)} disabled={isPending} className="px-4 py-2 text-sm text-text-muted hover:text-foreground">Cancelar</button>
                                <button onClick={handleSalvar} disabled={isPending} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-sm transition-colors">
                                    {isPending ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div></div>
                            <div className="flex gap-2">
                                {!concluidaAtual && (
                                    <button
                                        onClick={() => setModalConclusaoAberto(true)}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                                    >
                                        ✓ Finalizar
                                    </button>
                                )}
                                <button onClick={() => setModoEdicao(true)} className="px-6 py-2 bg-surface-highlight border border-border hover:bg-surface-highlight/80 text-foreground rounded-lg text-sm font-medium transition-colors shadow-sm">
                                    Editar Detalhes
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <ModalConclusao
                tarefaId={tarefa.id}
                isOpen={modalConclusaoAberto}
                onClose={() => setModalConclusaoAberto(false)}
                onConfirm={handleConfirmarConclusao}
                isSaving={isSavingConclusao}
            />
        </div>
    )
}