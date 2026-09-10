'use client'

import { useState, useEffect } from 'react'
import { criarProjeto, getColunasDaEquipe, getUsuariosDoWorkspace, getRepositoriosGithub } from '@/app/actions'
import { Rocket, Layout, Github } from 'lucide-react'
import type { RepositorioGithubOpcao } from '@/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  equipeId: string
}

type ColunaOpcao = { id: string; nome: string }
type UsuarioOpcao = { id: string; nome: string }

export default function ModalCriarProjeto({ isOpen, onClose, equipeId }: Props) {
  const [loading, setLoading] = useState(false)
  const [colunasDisponiveis, setColunasDisponiveis] = useState<ColunaOpcao[]>([])
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<UsuarioOpcao[]>([])
  const [repositoriosDisponiveis, setRepositoriosDisponiveis] = useState<RepositorioGithubOpcao[]>([])
  const [repoSelecionado, setRepoSelecionado] = useState('')
  const [isTemplateOnblox, setIsTemplateOnblox] = useState(false)
  const [erpSelecionado, setErpSelecionado] = useState('')
  const [statusSelecionado, setStatusSelecionado] = useState('EM_ANDAMENTO')

  // Busca colunas, usuários e repositórios GitHub quando o modal abre
  useEffect(() => {
    if (isOpen) {
        getColunasDaEquipe(equipeId).then(dados => setColunasDisponiveis(dados))
        getUsuariosDoWorkspace().then(dados => setUsuariosDisponiveis(dados.map(u => ({ id: u.id, nome: u.nome }))))
        getRepositoriosGithub(equipeId).then(dados => setRepositoriosDisponiveis(dados))
    }
  }, [isOpen])

  const [contaGithubId, repoIdStr, repoFullName] = repoSelecionado.split('::')

  if (!isOpen) return null

  const handleSubmit = async (formData: FormData) => {
    setLoading(true)
    await criarProjeto(formData)
    setLoading(false)
    onClose() 
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
        
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-surface/50">
          <h3 className="font-bold text-foreground">Criar Novo Projeto</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form action={handleSubmit} className="p-6 space-y-5">
          <input type="hidden" name="equipeId" value={equipeId} />
          {/* Action precisa saber se a chavinha tá ativada */}
          <input type="hidden" name="isTemplateOnblox" value={isTemplateOnblox ? 'true' : 'false'} />
          <input type="hidden" name="contaGithubId" value={contaGithubId || ''} />
          <input type="hidden" name="githubRepoId" value={repoIdStr || ''} />
          <input type="hidden" name="githubRepoFullName" value={repoFullName || ''} />

          {/* ========================================== */}
          {/* SELETOR DE TIPO DE PROJETO                 */}
          {/* ========================================== */}
          <div className="flex bg-surface-highlight/30 p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setIsTemplateOnblox(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-colors ${!isTemplateOnblox ? 'bg-white shadow-sm text-indigo-600 border border-border/50' : 'text-gray-500 hover:text-foreground'}`}
            >
              <Layout size={14} /> Projeto em Branco
            </button>
            <button
              type="button"
              onClick={() => setIsTemplateOnblox(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-colors ${isTemplateOnblox ? 'bg-indigo-600 shadow-sm text-white' : 'text-gray-500 hover:text-foreground'}`}
            >
              <Rocket size={14} /> Implantação Onblox
            </button>
          </div>

          {/* ========================================== */}
          {/* DADOS BÁSICOS (Sempre aparecem)            */}
          {/* ========================================== */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome do Cliente/Projeto *</label>
            <input name="nome" type="text" required placeholder="Ex: Macropack Distribuidora" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground" autoFocus />
          </div>

          <div>
             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
             <textarea name="descricao" rows={2} placeholder="Detalhes adicionais..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-background text-foreground" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Responsável</label>
            <select name="responsavelId" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground">
              <option value="">Não atribuído</option>
              {usuariosDisponiveis.map(u => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
              <Github size={12} /> Repositório GitHub
            </label>
            <select
              value={repoSelecionado}
              onChange={(e) => setRepoSelecionado(e.target.value)}
              disabled={repositoriosDisponiveis.length === 0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground disabled:opacity-60"
            >
              <option value="">Nenhum</option>
              {repositoriosDisponiveis.map(r => (
                <option key={`${r.contaId}-${r.repoId}`} value={`${r.contaId}::${r.repoId}::${r.fullName}`}>
                  {r.contaLogin} / {r.fullName}
                </option>
              ))}
            </select>
            {repositoriosDisponiveis.length > 0 ? (
              <p className="text-[10px] text-gray-400 mt-1">Cada push nesse repositório vai gerar uma tarefa automaticamente neste projeto.</p>
            ) : (
              <p className="text-[10px] text-amber-500 mt-1">Nenhum repositório disponível. Verifique se há uma conta do GitHub conectada nas configurações da equipe.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data de Início</label>
              <input name="data_inicio" type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Previsão de Entrega</label>
              <input name="data_prevista_entrega" type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground" />
            </div>
          </div>

          {/* ========================================== */}
          {/* CAMPOS CONDICIONAIS (Onblox ou Branco)     */}
          {/* ========================================== */}
          {isTemplateOnblox ? (
             <div className="space-y-4 border border-indigo-100 bg-indigo-50/30 p-4 rounded-xl animate-in fade-in slide-in-from-top-2 max-h-[50vh] overflow-y-auto">
                
                <div className="grid grid-cols-2 gap-4">
                    
                    {/* STATUS DO PROJETO */}
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-800 uppercase mb-1">Status do Projeto *</label>
                        <select 
                            name="status_cliente" 
                            value={statusSelecionado}
                            onChange={(e) => setStatusSelecionado(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background font-bold text-indigo-700"
                        >
                            <option value="EM_ANDAMENTO">🟢 Em Andamento</option>
                            <option value="AGUARDANDO_ONBLOX">⏳ Aguardando Onblox</option>
                            <option value="AGUARDANDO_CLIENTE">🔔 Aguardando Cliente</option>
                            <option value="RISCO_CHURN">🔴 Risco Churn</option>
                            <option value="PAUSADO">⏸️ Pausado</option>
                            <option value="CONCLUIDO">✅ Concluído</option>
                        </select>
                    </div>

                    {/* MOTIVO DA PAUSA (Só aparece se estiver PAUSADO) */}
                    {statusSelecionado === 'PAUSADO' && (
                        <div className="col-span-2 animate-in fade-in zoom-in-95">
                            <label className="block text-xs font-bold text-red-600 uppercase mb-1">Motivo da Pausa *</label>
                            <textarea 
                                name="motivo_pausa" 
                                required 
                                rows={2} 
                                placeholder="Descreva por que o projeto está travado (ex: Aguardando servidor do cliente)..." 
                                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-red-50 text-red-900 resize-none" 
                            />
                        </div>
                    )}

                    {/* PACOTE ONBLOX */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-bold text-gray-800 uppercase mb-1">Pacote Onblox *</label>
                      <select name="pacote_onblox" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground">
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
                      <label className="block text-xs font-bold text-gray-800 uppercase mb-1">Integração *</label>
                      <select name="tipo_integracao" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground">
                          <option value="">Selecione...</option>
                          <option value="VIEW">VIEW</option>
                          <option value="API">API</option>
                          <option value="BANCO DE DADOS">BANCO DE DADOS</option>
                      </select>
                    </div>

                    {/* ERP */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-bold text-gray-800 uppercase mb-1">ERP Principal *</label>
                      <select 
                          name="erpSelect" 
                          required 
                          onChange={(e) => setErpSelecionado(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground"
                      >
                          <option value="">Selecione...</option>
                          <option value="Winthor">Winthor</option>
                          <option value="Sankhya">Sankhya</option>
                          <option value="Protheus">Protheus</option>
                          <option value="Outro">Outro...</option>
                      </select>
                    </div>

                    {/* Acesso */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-bold text-gray-800 uppercase mb-1">Acesso Remoto</label>
                      <input name="dadosAcesso" type="text" placeholder="TV: 123 456 / Senha: abc" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground" />
                    </div>

                    {/* CAMPO CONDICIONAL DE ERP OUTRO */}
                    {erpSelecionado === 'Outro' && (
                        <div className="col-span-2 animate-in fade-in zoom-in-95">
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Qual ERP? *</label>
                            <input name="erpPersonalizado" type="text" required placeholder="Digite o nome do ERP..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground" />
                        </div>
                    )}
                </div>

                {/* Aviso visual da automação */}
                <div className="mt-4 p-3 bg-indigo-100/50 border border-indigo-200 rounded-lg">
                    <p className="text-[11px] text-indigo-800 font-medium flex items-start gap-2">
                       <Rocket size={16} className="shrink-0 mt-0.5" />
                       As colunas MODELAGEM, CADASTROS BASICOS, GO LIVE DE PROCESSOS e ATIVIDADES DIA A DIA serão criadas automaticamente nesta ordem.
                    </p>
                </div>
             </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Quais etapas este projeto terá?</label>
              {colunasDisponiveis.length === 0 ? (
                  <div className="p-3 bg-yellow-50 text-yellow-700 text-xs rounded border border-yellow-100">
                      ⚠️ Seu workspace ainda não tem colunas cadastradas. Vá em Gerenciar Colunas primeiro.
                  </div>
              ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-600 rounded-lg bg-surface/50">
                      {colunasDisponiveis.map(col => (
                          <label key={col.id} className="flex items-center space-x-2 bg-surface p-2 rounded border border-gray-600 cursor-pointer hover:border-indigo-300 transition-colors">
                              <input
                                  type="checkbox"
                                  name="colunas"
                                  value={col.id}
                                  className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-sm text-gray-300">{col.nome}</span>
                          </label>
                      ))}
                  </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1">Selecione na ordem que deseja que apareçam.</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-surface/50 rounded-lg">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 flex items-center gap-2">
              {loading ? 'Processando...' : (isTemplateOnblox ? <><Rocket size={16}/> Lançar Implantação</> : 'Criar Projeto')}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}