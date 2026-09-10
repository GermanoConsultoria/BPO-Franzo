'use client'

import { useState } from 'react'
import ModalCriarProjeto from '@/components/ModalCriarProjeto'

export default function BotaoNovoProjeto({ equipeId }: { equipeId: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
      >
        <span className="text-lg leading-none">+</span>
        Novo Projeto
      </button>

      <ModalCriarProjeto isOpen={isOpen} onClose={() => setIsOpen(false)} equipeId={equipeId} />
    </>
  )
}