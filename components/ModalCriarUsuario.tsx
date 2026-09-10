'use client'

import { useState } from 'react'
import { criarNovoUsuario } from '@/app/actions'
import { PERMISSOES_LABEL } from '@/lib/permissoes'

export default function ModalCriarUsuario() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [role, setRole] = useState('CLIENTE')

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError('')
    
    const res = await criarNovoUsuario(formData)
    
    setIsLoading(false)
    if (res?.erro) {
      setError(res.erro)
    } else {
      setIsOpen(false)
      setRole('CLIENTE')
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
      >
        <span>+</span> Novo Usuário
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          
          <div className="relative bg-surface rounded-xl shadow-2xl w-full max-w-md p-6 border border-border animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-foreground mb-4">Adicionar Colaborador</h2>
            
            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Nome Completo</label>
                <input name="nome" required className="w-full bg-surface-highlight border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: João Silva" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">E-mail de Acesso</label>
                <input name="email" type="email" required className="w-full bg-surface-highlight border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="joao@empresa.com" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Cargo</label>
                <input name="cargo" className="w-full bg-surface-highlight border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Financeiro" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Papel de Acesso</label>
                <select name="role" value={role} onChange={e => setRole(e.target.value)} className="w-full bg-surface-highlight border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="CLIENTE">Cliente — vê só o financeiro dele</option>
                  <option value="PERSONALIZADO">Personalizado — permissões configuráveis</option>
                </select>
                <p className="text-[10px] text-text-muted mt-1">Depois, vincule este usuário a um cliente em Configurações → Clientes.</p>
              </div>

              {role === 'PERSONALIZADO' && (
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase mb-2">Permissões</label>
                  <div className="space-y-2">
                    {Object.entries(PERMISSOES_LABEL).map(([chave, label]) => (
                      <label key={chave} className="flex items-center gap-2 text-sm text-foreground">
                        <input type="checkbox" name="permissoes" value={chave} className="accent-indigo-600" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Senha Inicial</label>
                <input name="senha" type="password" required className="w-full bg-surface-highlight border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="******" />
                <p className="text-[10px] text-text-muted mt-1">O usuário poderá alterar depois.</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
                  ⚠️ {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm text-text-muted hover:text-foreground transition-colors">Cancelar</button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Salvando...' : 'Criar Acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}