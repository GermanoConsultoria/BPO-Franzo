'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import BotaoDeletar from './BotaoDeletar'
import { excluirEquipe } from '@/app/actions'
import { AlertTriangle } from 'lucide-react'

interface Props {
  equipeId: string
  nomeEquipe: string
}

export default function BotaoExcluirEquipe({ equipeId, nomeEquipe }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleExcluir = () => {
    startTransition(async () => {
      await excluirEquipe(equipeId)
      // Redireciona o utilizador de volta para a lista global de equipes
      router.push('/configuracoes/equipes')
    })
  }

  return (
    <div className="bg-red-50 border border-red-200/60 p-6 rounded-xl shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h2 className="text-sm font-bold text-red-600 uppercase tracking-wide flex items-center gap-2 mb-1">
                <AlertTriangle size={18} /> Zona de Perigo
            </h2>
            <p className="text-sm text-red-500">
                A exclusão é irreversível. Todo o plano de contas e os lançamentos financeiros deste cliente serão apagados permanentemente.
            </p>
        </div>

        <div className="flex-shrink-0">
            {isPending ? (
                 <span className="text-sm font-medium text-red-500 px-4 py-2">Apagando...</span>
            ) : (
                <div className="bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors overflow-hidden">
                    <BotaoDeletar
                        texto="Excluir cliente"
                        titulo={`Excluir o cliente "${nomeEquipe}"?`}
                        descricao="Esta ação apagará todo o financeiro deste cliente. Tem certeza absoluta?"
                        onConfirm={handleExcluir}
                        // Um truque para forçar as classes do seu botão original a ficarem bonitas aqui:
                        className="!text-white !no-underline block px-6 py-2.5 font-bold"
                    />
                </div>
            )}
        </div>
      </div>
    </div>
  )
}