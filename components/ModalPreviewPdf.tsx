'use client'

import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'

interface Props {
  pdfBlob: Blob
  onClose: () => void
}

export default function ModalPreviewPdf({ pdfBlob, onClose }: Props) {
  const url = useMemo(() => URL.createObjectURL(pdfBlob), [pdfBlob])

  useEffect(() => {
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-surface/50 flex-shrink-0">
          <h3 className="font-bold text-foreground">Pré-visualização do PDF</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-foreground transition-colors" title="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 bg-gray-600 overflow-hidden">
          <iframe src={url} className="w-full h-full border-0" title="Pré-visualização do PDF" />
        </div>
      </div>
    </div>
  )
}
