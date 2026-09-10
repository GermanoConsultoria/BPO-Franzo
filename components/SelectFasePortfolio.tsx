'use client'

import { useState, useTransition, useEffect } from 'react'
import { atualizarFaseMacro } from '@/app/actions'
import { Loader2 } from 'lucide-react'

interface Props {
  projetoId: string
  equipeId: string
  faseAtual: string
  opcoes: string[] // <-- RECEBE AS OPÇÕES DO PROJETO
}

export default function SelectFasePortfolio({ projetoId, equipeId, faseAtual, opcoes }: Props) {
  const [isPending, startTransition] = useTransition()
  const [valorLocal, setValorLocal] = useState(faseAtual)

  // Sincroniza o estado local se o valor mudar no banco por outro lugar
  useEffect(() => {
    setValorLocal(faseAtual)
  }, [faseAtual])

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const novaFase = e.target.value
    setValorLocal(novaFase)

    startTransition(async () => {
        const formData = new FormData()
        formData.append('projetoId', projetoId)
        formData.append('novaFase', novaFase)
        formData.append('equipeId', equipeId)
        
        await atualizarFaseMacro(formData)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select 
        value={valorLocal}
        onChange={handleChange}
        disabled={isPending}
        className={`bg-transparent border border-border rounded px-2 py-1 text-[11px] font-bold outline-none transition-all cursor-pointer hover:bg-surface-highlight
          ${isPending ? 'opacity-50' : 'text-indigo-600'}
        `}
      >
        <option value="">Sem Fase</option>
        {/* MAPEIA AS COLUNAS REAIS DO PROJETO */}
        {opcoes.map(fase => (
          <option key={fase} value={fase}>{fase}</option>
        ))}
        {/* Adicionamos o "CONCLUIDO" manualmente pois ele é o fim de todo projeto */}
        <option value="CONCLUIDO">✅ CONCLUÍDO</option>
      </select>

      {isPending && <Loader2 size={12} className="animate-spin text-indigo-400" />}
    </div>
  )
}