'use client'

interface Props {
  titulo: string
  descricao: string
  gerandoXlsx: boolean
  onEscolherPdf: () => void
  onEscolherXlsx: () => void
  onCancelar: () => void
}

/** Popup de escolha de formato de exportação (PDF ou XLSX) — mesmo padrão
 * visual do popup "Resumida/Detalhada" do Balancete. */
export default function PopupExportar({ titulo, descricao, gerandoXlsx, onEscolherPdf, onEscolherXlsx, onCancelar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <div>
          <h2 className="text-lg font-bold">{titulo}</h2>
          <p className="text-sm text-gray-400 mt-1">{descricao}</p>
        </div>
        <div className="space-y-2">
          <button
            onClick={onEscolherPdf}
            className="w-full py-2.5 rounded-lg bg-surface border border-border hover:bg-surface-highlight text-sm font-medium transition-colors text-left px-4"
          >
            <div className="font-medium text-foreground">PDF</div>
            <div className="text-xs text-gray-500 mt-0.5">Abre uma pré-visualização para imprimir ou salvar.</div>
          </button>
          <button
            onClick={onEscolherXlsx}
            disabled={gerandoXlsx}
            className="w-full py-2.5 rounded-lg bg-surface border border-border hover:bg-surface-highlight text-sm font-medium transition-colors text-left px-4 disabled:opacity-50"
          >
            <div className="font-medium text-foreground">{gerandoXlsx ? 'Gerando XLSX...' : 'XLSX'}</div>
            <div className="text-xs text-gray-500 mt-0.5">Baixa uma planilha do Excel com os dados da tabela.</div>
          </button>
        </div>
        <button
          onClick={onCancelar}
          className="w-full py-2 rounded-lg border border-border text-sm text-gray-400 hover:text-foreground hover:bg-surface-highlight transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
