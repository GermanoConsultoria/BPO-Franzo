'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { editarProjeto, excluirProjetoCompleto, getUsuariosDoWorkspace, getRepositoriosGithub } from '@/app/actions'
import { Settings2, Save, Github } from 'lucide-react'
import BotaoDeletar from './BotaoDeletar'
import { useRouter } from 'next/navigation'
import type { ProjetoBasico, RepositorioGithubOpcao } from '@/types'
import { extrairDataYMD } from '@/lib/date'

interface Props {
  projeto: ProjetoBasico & {
    descricao?: string | null
    erp?: string | null
    dados_acesso?: string | null
    pacote_onblox?: string | null
    tipo_integracao?: string | null
    status_cliente?: string | null
    motivo_pausa?: string | null
    equipe_id?: string | null
    usuario_id?: string | null
    data_inicio?: Date | string | null
    data_prevista_entrega?: Date | string | null
    conta_github_id?: string | null
    github_repo_id?: number | null
    github_repo_full_name?: string | null
  }
}

type UsuarioOpcao = { id: string; nome: string }

export default function ModalEditarProjeto({ projeto }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<UsuarioOpcao[]>([])
  const [repositoriosDisponiveis, setRepositoriosDisponiveis] = useState<RepositorioGithubOpcao[]>([])
  const [repoSelecionado, setRepoSelecionado] = useState(
    projeto.conta_github_id && projeto.github_repo_id && projeto.github_repo_full_name
      ? `${projeto.conta_github_id}::${projeto.github_repo_id}::${projeto.github_repo_full_name}`
      : ''
  )
  const router = useRouter()

  const [statusSelecionado, setStatusSelecionado] = useState(projeto.status_cliente || 'EM_ANDAMENTO')
  const [responsavelSelecionado, setResponsavelSelecionado] = useState(projeto.usuario_id || '')

  useEffect(() => {
    if (isOpen) {
      getUsuariosDoWorkspace().then(dados => setUsuariosDisponiveis(dados.map(u => ({ id: u.id, nome: u.nome }))))
      if (projeto.equipe_id) {
        getRepositoriosGithub(projeto.equipe_id, projeto.id).then(dados => setRepositoriosDisponiveis(dados))
      }
    }
  }, [isOpen])

  const [contaGithubId, repoIdStr, repoFullName] = repoSelecionado.split('::')

  if (!projeto) return null

  const handleSubmit = async (formData: FormData) => {
    setLoading(true)
    const resultado = await editarProjeto(formData)
    setLoading(false)
    if (!resultado.success) {
      toast.error(resultado.error)
      return
    }
    if (resultado.warning) {
      toast.warning(resultado.warning)
    }
    setIsOpen(false)
  }

  // --- NOVA FUNÇÃO DE EXCLUSÃO ---
  const handleExcluir = async () => {
    setLoading(true)
    await excluirProjetoCompleto(projeto.id)
    setLoading(false)
    setIsOpen(false)
    
    // Redireciona o usuário para a lista de projetos da equipe após apagar
    if (projeto.equipe_id) {
        router.push(`/equipe/${projeto.equipe_id}/projetos`)
    } else {
        router.push('/')
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        title="Editar Dados do Projeto"
        className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-md hover:bg-indigo-50 transition-colors ml-2"
      >
        <Settings2 size={18} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            
            <div className="px-6 py-4 border-b border-border bg-surface-highlight/20 flex justify-between items-center">
              <h3 className="font-bold text-foreground">Editar Projeto</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar-thin">
                <form id="form-editar-projeto" action={handleSubmit} className="p-6 space-y-5">
                <input type="hidden" name="id" value={projeto.id} />
                <input type="hidden" name="equipeId" value={projeto.equipe_id || ''} />
                <input type="hidden" name="contaGithubId" value={contaGithubId || ''} />
                <input type="hidden" name="githubRepoId" value={repoIdStr || ''} />
                <input type="hidden" name="githubRepoFullName" value={repoFullName || ''} />

                {/* Dados Básicos */}
                <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">Nome do Projeto *</label>
                    <input name="nome" type="text" required defaultValue={projeto.nome} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground" />
                </div>

                <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">Descrição</label>
                    <textarea name="descricao" rows={2} defaultValue={projeto.descricao || ''} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-foreground" />
                </div>

                <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">Responsável</label>
                    <select
                        name="responsavelId"
                        value={responsavelSelecionado}
                        onChange={(e) => setResponsavelSelecionado(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground"
                    >
                        <option value="">— Não atribuído —</option>
                        {usuariosDisponiveis.map(u => (
                            <option key={u.id} value={u.id}>{u.nome}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1 flex items-center gap-1">
                        <Github size={12} /> Repositório GitHub
                    </label>
                    <select
                        value={repoSelecionado}
                        onChange={(e) => setRepoSelecionado(e.target.value)}
                        disabled={repositoriosDisponiveis.length === 0}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground disabled:opacity-60"
                    >
                        <option value="">Nenhum</option>
                        {repositoriosDisponiveis.map(r => (
                            <option key={`${r.contaId}-${r.repoId}`} value={`${r.contaId}::${r.repoId}::${r.fullName}`}>
                                {r.contaLogin} / {r.fullName}
                            </option>
                        ))}
                    </select>
                    {repositoriosDisponiveis.length > 0 ? (
                        <p className="text-[10px] text-text-muted mt-1">Cada push nesse repositório vai gerar uma tarefa automaticamente neste projeto.</p>
                    ) : (
                        <p className="text-[10px] text-amber-500 mt-1">
                            {projeto.equipe_id
                                ? 'Nenhum repositório disponível. Verifique se há uma conta do GitHub conectada nas configurações da equipe.'
                                : 'Este projeto não está vinculado a uma equipe, então não é possível selecionar um repositório.'}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-1">Data de Início</label>
                        <input
                            name="data_inicio"
                            type="date"
                            defaultValue={extrairDataYMD(projeto.data_inicio) || ''}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-text-muted uppercase mb-1">Previsão de Entrega</label>
                        <input
                            name="data_prevista_entrega"
                            type="date"
                            defaultValue={extrairDataYMD(projeto.data_prevista_entrega) || ''}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground"
                        />
                    </div>
                </div>

                <hr className="border-border" />

                {/* DADOS ONBLOX */}
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        Detalhes da Implantação
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                        
                        {/* STATUS DO PROJETO */}
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Status do Projeto *</label>
                            <select 
                                name="status_cliente" 
                                value={statusSelecionado}
                                onChange={(e) => setStatusSelecionado(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-600"
                            >
                                <option value="EM_ANDAMENTO">🟢 Em Andamento</option>
                                <option value="AGUARDANDO_ONBLOX">⏳ Aguardando Onblox</option>
                                <option value="AGUARDANDO_CLIENTE">🔔 Aguardando Cliente</option>
                                <option value="RISCO_CHURN">🔴 Risco Churn</option>
                                <option value="PAUSADO">⏸️ Pausado</option>
                                <option value="CONCLUIDO">✅ Concluído</option>
                            </select>
                        </div>

                        {/* MOTIVO DA PAUSA */}
                        {statusSelecionado === 'PAUSADO' && (
                            <div className="col-span-2 animate-in fade-in zoom-in-95">
                                <label className="block text-xs font-bold text-red-500 uppercase mb-1">Motivo da Pausa *</label>
                                <textarea 
                                    name="motivo_pausa" 
                                    required 
                                    rows={2} 
                                    defaultValue={projeto.motivo_pausa || ''}
                                    placeholder="Descreva por que o projeto está travado..." 
                                    className="w-full bg-red-50/10 border border-red-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none text-red-500 resize-none" 
                                />
                            </div>
                        )}

                        {/* PACOTE ONBLOX */}
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Pacote Onblox</label>
                            <select name="pacote_onblox" defaultValue={projeto.pacote_onblox || ''} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground">
                                <option value="">Selecione...</option>
                                <option value="WMS + REMOTO">WMS + REMOTO</option>
                                <option value="WMS + PRESENCIAL">WMS + PRESENCIAL</option>
                                <option value="RF + REMOTO">RF + REMOTO</option>
                                <option value="RF + PRESENCIAL">RF + PRESENCIAL</option>
                                <option value="START + REMOTO">START + REMOTO</option>
                                <option value="START + PRESENCIAL">START + PRESENCIAL</option>
                            </select>
                        </div>

                        {/* INTEGRAÇÃO */}
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Integração</label>
                            <select name="tipo_integracao" defaultValue={projeto.tipo_integracao || ''} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground">
                                <option value="">Selecione...</option>
                                <option value="VIEW">VIEW</option>
                                <option value="API">API</option>
                                <option value="BANCO DE DADOS">BANCO DE DADOS</option>
                            </select>
                        </div>

                        {/* ERP */}
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1">ERP Principal</label>
                            {/* Como o ERP pode ser "Outro", deixamos um input de texto livre para edição para facilitar */}
                            <input name="erp" type="text" defaultValue={projeto.erp || ''} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground" />
                        </div>

                        {/* Acesso */}
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Acesso Remoto</label>
                            <input name="dadosAcesso" type="text" defaultValue={projeto.dados_acesso || ''} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-foreground" />
                        </div>
                    </div>
                </div>

                </form>
            </div>

            {/* FOOTER ATUALIZADO: Botão de exclusão à esquerda e Salvar/Cancelar à direita */}
            <div className="px-6 py-4 bg-surface-highlight/10 border-t border-border flex justify-between items-center mt-auto">
                
                {/* Botão de Excluir */}
                <div>
                    <BotaoDeletar 
                        texto="Excluir Projeto"
                        titulo="Excluir Projeto Definitivamente?"
                        descricao="Atenção: Isso apagará todas as tarefas, comentários, anexos e históricos vinculados a este projeto. Essa ação NÃO PODE ser desfeita."
                        onConfirm={handleExcluir}
                        className="!text-red-500 hover:!bg-red-50 px-3 py-2 rounded-lg font-bold border border-transparent hover:border-red-200 !no-underline"
                    />
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-3">
                    <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-surface/50 rounded-lg">Cancelar</button>
                    <button type="submit" form="form-editar-projeto" disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 flex items-center gap-2">
                        {loading ? 'Salvando...' : <><Save size={16}/> Salvar Alterações</>}
                    </button>
                </div>
            </div>

          </div>
        </div>
      )}
    </>
  )
}