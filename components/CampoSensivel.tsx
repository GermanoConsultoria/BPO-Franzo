'use client'

import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

interface Props {
  valor: string | null
  permitido: boolean
}

export default function CampoSensivel({ valor, permitido }: Props) {
  const [revelado, setRevelado] = useState(false)

  if (!valor) {
    return <span className="text-gray-400 text-xs italic">Sem dados</span>
  }

  if (!permitido) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-400 text-xs italic">
        <Lock size={11} /> Restrito
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1.5 max-w-[180px]">
      <span className={`text-xs font-mono truncate transition-all ${revelado ? 'text-gray-800' : 'blur-sm select-none pointer-events-none'}`}>
        {valor}
      </span>
      <button
        onClick={() => setRevelado(v => !v)}
        className="text-gray-400 hover:text-indigo-500 transition-colors shrink-0"
        title={revelado ? 'Ocultar' : 'Revelar dados de acesso'}
      >
        {revelado ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  )
}
