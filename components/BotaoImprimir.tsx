'use client'

import { Printer } from 'lucide-react'

export default function BotaoImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 border border-border rounded-lg hover:bg-surface-highlight transition-colors"
    >
      <Printer size={15} /> Imprimir / PDF
    </button>
  )
}
