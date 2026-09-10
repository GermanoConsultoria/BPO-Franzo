'use client'

import { useState } from 'react'
import { X, Maximize2, Download } from 'lucide-react'

interface VisualizadorImagemProps {
  url: string
  alt?: string
}

export function VisualizadorImagem({ url, alt = "Anexo" }: VisualizadorImagemProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!url) return null

  return (
    <>
      {/* 1. MINIATURA NA LISTA (O que aparece no comentário) */}
      <div 
        className="group relative mt-2 inline-block cursor-zoom-in overflow-hidden rounded-lg border border-border bg-surface-highlight/10 transition-all hover:border-indigo-500/50"
        onClick={() => setIsOpen(true)}
      >
        <img 
          src={url} 
          alt={alt} 
          className="h-32 w-auto object-cover opacity-90 transition-opacity group-hover:opacity-100" 
        />
        
        {/* Overlay com ícone de lupa ao passar o mouse */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <Maximize2 className="text-white drop-shadow-md" size={20} />
        </div>
      </div>

      {/* 2. MODAL DE TELA CHEIA (Lightbox) */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)} // Fecha ao clicar no fundo preto
        >
          
          {/* Botão de Fechar */}
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute right-5 top-5 rounded-full bg-zinc-800 p-2 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
          >
            <X size={24} />
          </button>

          {/* A Imagem Grande */}
          <div 
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()} // Impede que o clique na imagem feche o modal
          >
            <img 
              src={url} 
              alt={alt} 
              className="max-h-[85vh] max-w-full rounded-md object-contain shadow-2xl" 
            />
            
            {/* Barra de Ações (Opcional) */}
            <div className="mt-4 flex justify-center">
               <a 
                 href={url} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                 title="Abrir original em nova aba"
               >
                 <Download size={14} />
                 Abrir Original
               </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}