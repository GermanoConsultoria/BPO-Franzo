'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { alterarSenhaUsuario } from '@/app/actions'
import { Key, Loader2, Eye, EyeOff } from 'lucide-react'
import ModalSucesso from './ModalSucesso' // <--- IMPORTAR O NOVO MODAL

interface Props {
  isOpen: boolean
  onClose: () => void
  usuario: { id: string; nome: string }
}

export default function ModalAlterarSenha({ isOpen, onClose, usuario }: Props) {
  const [novaSenha, setNovaSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  
  // Controle do Modal de Sucesso
  const [sucesso, setSucesso] = useState(false) // <--- ESTADO NOVO

  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  const handleSalvar = () => {
    startTransition(async () => {
      try {
        await alterarSenhaUsuario(usuario.id, novaSenha)
        
        // --- MUDANÇA AQUI ---
        // Antes: alert(...) e onClose()
        // Agora: Abre o modal de sucesso
        setSucesso(true)
        
      } catch {
        toast.error('Erro ao alterar senha. Verifique se você é OWNER.')
      }
    })
  }

  // Função para fechar tudo (chamada pelo botão "Entendido" do ModalSucesso)
  const fecharTudo = () => {
      setSucesso(false)
      setNovaSenha('')
      onClose()
  }

  return (
    <>
      {/* 1. MODAL PRINCIPAL (FORMULÁRIO) */}
      {/* Só mostramos o formulário se o sucesso NÃO estiver aberto, ou sobrepomos? 
          Vamos manter o formulário no fundo para não piscar a tela. */}
      
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-surface w-full max-w-md rounded-xl border border-border shadow-2xl p-6 animate-in zoom-in-95">
          
          <div className="flex items-center gap-3 mb-4 text-amber-500">
              <div className="bg-amber-500/10 p-2 rounded-lg">
                  <Key size={24} />
              </div>
              <h2 className="text-lg font-bold text-foreground">Alterar Senha</h2>
          </div>
  
          <p className="text-sm text-text-muted mb-4">
              Definindo nova senha para: <strong className="text-foreground">{usuario.nome}</strong>
          </p>
  
          <div className="relative mb-6">
              <input 
                  type={mostrarSenha ? "text" : "password"}
                  value={novaSenha}
                  onChange={e => setNovaSenha(e.target.value)}
                  placeholder="Digite a nova senha..."
                  className="w-full bg-surface-highlight/10 border border-border rounded-lg px-4 py-3 text-foreground focus:ring-2 focus:ring-amber-500 outline-none pr-12"
              />
              <button 
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-3 text-text-muted hover:text-foreground"
              >
                  {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
          </div>
  
          <div className="flex justify-end gap-3">
              <button 
                  onClick={onClose} 
                  disabled={isPending}
                  className="px-4 py-2 text-sm text-text-muted hover:text-foreground font-medium"
              >
                  Cancelar
              </button>
              <button 
                  onClick={handleSalvar}
                  disabled={isPending || novaSenha.trim() === ''}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isPending ? <Loader2 className="animate-spin" size={16}/> : 'Confirmar Alteração'}
              </button>
          </div>
        </div>
      </div>

      {/* 2. MODAL DE SUCESSO (Aparece por cima quando der certo) */}
      <ModalSucesso 
        isOpen={sucesso}
        onClose={fecharTudo} // Ao fechar o sucesso, fecha o form também
        titulo="Senha Alterada!"
        descricao={`A senha do usuário ${usuario.nome} foi atualizada com sucesso.`}
      />
    </>
  )
}