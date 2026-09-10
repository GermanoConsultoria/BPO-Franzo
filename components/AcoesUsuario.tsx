'use client'

import { useState, useTransition } from 'react'
import { Key, Power, Loader2, Shield } from 'lucide-react'
import { toggleStatusUsuario } from '@/app/actions'
import ModalAlterarSenha from './ModalAlterarSenha'
import ModalPermissoesSidebar from './ModalPermissoesSidebar'

interface Props {
  usuario: {
    id: string
    nome: string
    ativo: boolean
    permissoes_sidebar?: string | null
  }
}

export default function AcoesUsuario({ usuario }: Props) {
  const [modalSenha, setModalSenha] = useState(false)
  const [modalPermissoes, setModalPermissoes] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleToggleStatus = () => {
    startTransition(async () => {
      await toggleStatusUsuario(usuario.id)
    })
  }

  return (
    <>
      <div className="flex justify-end items-center gap-2">
        {/* PERMISSÕES DA SIDEBAR */}
        <button
          onClick={() => setModalPermissoes(true)}
          className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
          title="Permissões da Sidebar"
        >
          <Shield size={18} />
        </button>

        {/* ALTERAR SENHA */}
        <button
          onClick={() => setModalSenha(true)}
          className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors border border-transparent hover:border-amber-500/20"
          title="Alterar Senha"
        >
          <Key size={18} />
        </button>

        {/* ATIVAR/INATIVAR */}
        <button
          onClick={handleToggleStatus}
          disabled={isPending}
          className={`p-2 rounded-lg transition-colors border border-transparent flex items-center justify-center w-[36px] h-[36px] ${
            usuario.ativo
              ? 'text-red-500 hover:bg-red-500/10 hover:border-red-500/20'
              : 'text-green-500 hover:bg-green-500/10 hover:border-green-500/20'
          }`}
          title={usuario.ativo ? 'Inativar Usuário' : 'Ativar Usuário'}
        >
          {isPending ? <Loader2 size={18} className="animate-spin" /> : <Power size={18} />}
        </button>
      </div>

      <ModalAlterarSenha
        isOpen={modalSenha}
        onClose={() => setModalSenha(false)}
        usuario={usuario}
      />

      <ModalPermissoesSidebar
        isOpen={modalPermissoes}
        onClose={() => setModalPermissoes(false)}
        usuario={usuario}
      />
    </>
  )
}
