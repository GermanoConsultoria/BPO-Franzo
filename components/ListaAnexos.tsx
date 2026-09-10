'use client'

import Link from "next/link"

interface Anexo {
  id: string
  nome: string
  url: string
  tamanho: number
  dt_insert?: Date | string
}

interface Props {
  anexos: Anexo[]
  onDelete?: (id: string) => void // Opcional: Se quiser permitir deletar
}

export default function ListaAnexos({ anexos, onDelete }: Props) {
  
  // Função para formatar Bytes em KB ou MB
  const formatarTamanho = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Função para decidir qual ícone mostrar
  const renderPreview = (anexo: Anexo) => {
    const ext = anexo.nome.split('.').pop()?.toLowerCase() || '';

    // 1. SE FOR IMAGEM: Mostra a miniatura real
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
      return (
        <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-gray-100">
          <img 
            src={anexo.url} 
            alt={anexo.nome} 
            className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )
    }

    // 2. SE FOR PDF
    if (ext === 'pdf') {
      return (
        <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
      )
    }

    // 3. SE FOR EXCEL / PLANILHA
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return (
        <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0 border border-green-200">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>
        </div>
      )
    }

    // 4. SE FOR ARQUIVO ZIP/RAR
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) {
        return (
          <div className="w-10 h-10 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center shrink-0 border border-yellow-200">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 20h4"/></svg>
          </div>
        )
      }

    // 5. GENÉRICO (Qualquer outro arquivo)
    return (
      <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 border border-gray-200">
         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
    )
  }

  if (anexos.length === 0) return null

  return (
    <div className="space-y-2 mt-2">
      {anexos.map((anexo) => (
        <div 
            key={anexo.id} 
            className="group flex items-center justify-between p-2 rounded-lg bg-surface border border-transparent hover:border-indigo-200 hover:bg-surface-highlight/50 transition-all"
        >
            <Link 
                href={anexo.url} 
                target="_blank" 
                className="flex items-center gap-3 flex-1 min-w-0"
            >
                {/* ÍCONE OU MINIATURA */}
                {renderPreview(anexo)}

                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-foreground truncate group-hover:text-indigo-600 transition-colors" title={anexo.nome}>
                        {anexo.nome}
                    </span>
                    <span className="text-[10px] text-gray-400">
                        {formatarTamanho(anexo.tamanho)} • Clique para abrir
                    </span>
                </div>
            </Link>

            {onDelete && (
                <button 
                    onClick={() => onDelete(anexo.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    title="Remover anexo"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            )}
        </div>
      ))}
    </div>
  )
}