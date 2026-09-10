'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { criarRecurso, editarRecurso, excluirRecurso } from '@/app/actions'
import { Link2, Plus, ExternalLink, Pencil, Trash2, BookOpen, Download, Upload, Loader2 } from 'lucide-react'
import { useUploadThing } from '@/lib/uploadthing'
import { useRouter } from 'next/navigation'

type Recurso = {
  id: string
  titulo: string
  url: string
  descricao: string | null
  categoria: string | null
  icone: string | null
  tipo: string
  arquivo_nome: string | null
  ordem: number
}

interface Props {
  equipeId: string
  equipeNome: string
  recursosIniciais: Recurso[]
  roleUsuario: string
}

// Categorias fixas com ícone e ordem definidos
const CATEGORIAS: { nome: string; icone: string }[] = [
  { nome: 'Documentação',        icone: '📋' },
  { nome: 'Checklists',          icone: '✅' },
  { nome: 'Templates',           icone: '📁' },
  { nome: 'Vídeos e Treinamentos', icone: '🎥' },
  { nome: 'Acesso Remoto',       icone: '🖥️' },
  { nome: 'Ferramentas',         icone: '🔧' },
  { nome: 'Outros',              icone: '🔗' },
]

const iconeDeCategoria = (cat: string | null) =>
  CATEGORIAS.find(c => c.nome === cat)?.icone ?? '🔗'

// Ordena categorias pela ordem predefinida (desconhecidas vão para o final)
function ordenarCategorias(cats: string[]) {
  const ordemPredefinida = CATEGORIAS.map(c => c.nome)
  return [...cats].sort((a, b) => {
    const ia = ordemPredefinida.indexOf(a)
    const ib = ordemPredefinida.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b, 'pt-BR')
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

export default function RecursosView({ equipeId, equipeNome, recursosIniciais, roleUsuario }: Props) {
  const [recursos, setRecursos] = useState<Recurso[]>(recursosIniciais)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Recurso | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Estado do formulário
  const [tipo, setTipo] = useState<'LINK' | 'ARQUIVO'>('LINK')
  const [arquivoUrl, setArquivoUrl] = useState('')
  const [arquivoNome, setArquivoNome] = useState('')
  const [uploading, setUploading] = useState(false)

  const { startUpload } = useUploadThing('recursoArquivo')

  const podeEditar = roleUsuario === 'OWNER' || roleUsuario === 'MANAGER'

  const categorias = ordenarCategorias(
    Array.from(new Set(recursos.map(r => r.categoria || 'Outros')))
  )

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await startUpload([file])
      if (res?.[0]) {
        setArquivoUrl(res[0].url)
        setArquivoNome(file.name)
        toast.success(`Arquivo "${file.name}" carregado.`)
      }
    } catch {
      toast.error('Erro ao enviar arquivo.')
    } finally {
      setUploading(false)
    }
  }

  const handleSalvar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('equipeId', equipeId)
    formData.set('tipo', tipo)

    if (tipo === 'ARQUIVO') {
      if (!arquivoUrl) { toast.error('Envie um arquivo antes de salvar.'); return }
      formData.set('url', arquivoUrl)
      formData.set('arquivo_nome', arquivoNome)
    }

    if (editando) {
      formData.set('id', editando.id)
      const res = await editarRecurso(formData)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Recurso atualizado.')
    } else {
      const res = await criarRecurso(formData)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Recurso adicionado.')
    }
    fecharModal()
    router.refresh()
  }

  const handleExcluir = (id: string) => {
    if (!confirm('Excluir este recurso?')) return
    startTransition(async () => {
      const res = await excluirRecurso(id, equipeId)
      if (!res.success) { toast.error(res.error); return }
      setRecursos(prev => prev.filter(r => r.id !== id))
      toast.success('Recurso removido.')
    })
  }

  const abrirEdicao = (recurso: Recurso) => {
    setEditando(recurso)
    setTipo(recurso.tipo === 'ARQUIVO' ? 'ARQUIVO' : 'LINK')
    setArquivoUrl(recurso.tipo === 'ARQUIVO' ? recurso.url : '')
    setArquivoNome(recurso.arquivo_nome || '')
    setModalAberto(true)
  }

  const fecharModal = () => {
    setModalAberto(false)
    setEditando(null)
    setTipo('LINK')
    setArquivoUrl('')
    setArquivoNome('')
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="px-8 py-6 bg-surface border-b border-border flex justify-between items-center sticky top-0 z-20 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Link2 className="text-indigo-600" />
            Recursos da Implantação: {equipeNome}
          </h1>
          <p className="text-text-muted text-sm mt-1">Links e documentações essenciais para a equipe.</p>
        </div>
        {podeEditar && (
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} /> Adicionar Recurso
          </button>
        )}
      </header>

      <div className="flex-1 overflow-auto p-8">
        {recursos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen size={48} className="text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-1">Nenhum recurso cadastrado</h3>
            <p className="text-text-muted text-sm max-w-xs">
              Adicione links externos ou faça upload de documentos importantes para a equipe.
            </p>
            {podeEditar && (
              <button onClick={() => setModalAberto(true)} className="mt-6 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700">
                + Adicionar primeiro recurso
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {categorias.map(categoria => (
              <section key={categoria}>
                <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="h-px flex-1 bg-border" />
                  <span>{iconeDeCategoria(categoria)} {categoria}</span>
                  <span className="h-px flex-1 bg-border" />
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {recursos
                    .filter(r => (r.categoria || 'Outros') === categoria)
                    .map(recurso => (
                      <div
                        key={recurso.id}
                        className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-indigo-300 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xl flex-shrink-0">
                              {recurso.tipo === 'ARQUIVO' ? '📄' : iconeDeCategoria(recurso.categoria)}
                            </span>
                            <div className="min-w-0">
                              <h3 className="font-bold text-foreground text-sm leading-tight truncate" title={recurso.titulo}>
                                {recurso.titulo}
                              </h3>
                              {recurso.tipo === 'ARQUIVO' && recurso.arquivo_nome && (
                                <p className="text-[10px] text-text-muted truncate">{recurso.arquivo_nome}</p>
                              )}
                            </div>
                          </div>
                          {podeEditar && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button onClick={() => abrirEdicao(recurso)} className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors" title="Editar">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleExcluir(recurso.id)} disabled={isPending} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors" title="Excluir">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>

                        {recurso.descricao && (
                          <p className="text-xs text-text-muted leading-relaxed line-clamp-3">{recurso.descricao}</p>
                        )}

                        <a
                          href={recurso.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-auto flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          {recurso.tipo === 'ARQUIVO'
                            ? <><Download size={12} /> Baixar Arquivo</>
                            : <><ExternalLink size={12} /> Abrir Link</>
                          }
                        </a>
                      </div>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CRIAR / EDITAR */}
      {modalAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-foreground">{editando ? 'Editar Recurso' : 'Novo Recurso'}</h3>
              <button onClick={fecharModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <form onSubmit={handleSalvar} className="p-6 space-y-4">

              {/* TOGGLE TIPO */}
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-2">Tipo</label>
                <div className="flex bg-surface-highlight/30 p-1 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => { setTipo('LINK'); setArquivoUrl(''); setArquivoNome('') }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-colors ${tipo === 'LINK' ? 'bg-surface shadow-sm text-indigo-600 border border-border/50' : 'text-gray-500 hover:text-foreground'}`}
                  >
                    <ExternalLink size={13} /> Link Externo
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipo('ARQUIVO')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-colors ${tipo === 'ARQUIVO' ? 'bg-indigo-600 shadow-sm text-white' : 'text-gray-500 hover:text-foreground'}`}
                  >
                    <Upload size={13} /> Upload de Arquivo
                  </button>
                </div>
              </div>

              {/* TÍTULO */}
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Título *</label>
                <input
                  name="titulo"
                  type="text"
                  required
                  defaultValue={editando?.titulo || ''}
                  placeholder={tipo === 'ARQUIVO' ? 'Ex: Manual de Cadastros Básicos' : 'Ex: Fluxo de Implantação WMS'}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground"
                  autoFocus
                />
              </div>

              {/* URL ou ARQUIVO */}
              {tipo === 'LINK' ? (
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">URL *</label>
                  <input
                    name="url"
                    type="url"
                    required
                    defaultValue={editando?.tipo === 'LINK' ? editando.url : ''}
                    placeholder="https://..."
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">Arquivo *</label>
                  {arquivoUrl ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="text-lg">📄</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-green-700 truncate">{arquivoNome}</p>
                        <p className="text-[10px] text-green-600">Arquivo enviado com sucesso</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setArquivoUrl(''); setArquivoNome('') }}
                        className="text-green-600 hover:text-red-500 text-xs font-bold"
                      >
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploading ? 'border-indigo-300 bg-indigo-50/20' : 'border-border hover:border-indigo-400 hover:bg-indigo-50/10'}`}>
                      {uploading ? (
                        <>
                          <Loader2 size={24} className="text-indigo-500 animate-spin" />
                          <span className="text-xs text-text-muted">Enviando arquivo...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={24} className="text-text-muted" />
                          <span className="text-xs text-text-muted text-center">
                            Clique para selecionar um arquivo<br />
                            <span className="text-[10px]">PDF, Word, Excel, imagem — até 32MB</span>
                          </span>
                        </>
                      )}
                      <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                  )}
                </div>
              )}

              {/* CATEGORIA */}
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Categoria</label>
                <select
                  name="categoria"
                  defaultValue={editando?.categoria || 'Documentação'}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-background text-foreground"
                >
                  {CATEGORIAS.map(c => (
                    <option key={c.nome} value={c.nome}>{c.icone} {c.nome}</option>
                  ))}
                </select>
              </div>

              {/* DESCRIÇÃO */}
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Descrição</label>
                <textarea
                  name="descricao"
                  rows={3}
                  defaultValue={editando?.descricao || ''}
                  placeholder="Descreva para que serve este recurso..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-background text-foreground"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <button type="button" onClick={fecharModal} className="px-4 py-2 text-sm text-gray-500 hover:bg-surface-highlight rounded-lg">Cancelar</button>
                <button
                  type="submit"
                  disabled={uploading || (tipo === 'ARQUIVO' && !arquivoUrl && !editando)}
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <Link2 size={14} /> {editando ? 'Salvar Alterações' : 'Adicionar Recurso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
