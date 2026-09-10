'use client'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  titulo: string
  descricao?: string
  loading?: boolean
}

export default function ModalConfirmacao({ 
  isOpen, 
  onClose, 
  onConfirm, 
  titulo, 
  descricao, 
  loading 
}: Props) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop Escuro (Clica fora para fechar) */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={!loading ? onClose : undefined}
      />

      {/* A "Telinha" */}
      <div className="relative bg-surface w-full max-w-sm rounded-xl border border-border shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        
        {/* Ícone de Alerta */}
        <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </div>
            
            <h3 className="text-lg font-bold text-foreground mb-2">
                {titulo}
            </h3>
            
            {descricao && (
                <p className="text-sm text-text-muted mb-6">
                    {descricao}
                </p>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-3 w-full">
                <button
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-surface-highlight hover:bg-surface-highlight/80 text-foreground text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                    Cancelar
                </button>
                <button
                    onClick={onConfirm}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {loading ? 'Apagando...' : 'Sim, excluir'}
                </button>
            </div>
        </div>

      </div>
    </div>
  )
}