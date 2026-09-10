'use client'

import { UploadButton } from "@/lib/uploadthing";
import { toast } from 'sonner';
import { salvarAnexoNoBanco } from "@/app/actions";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Anexo } from "@/types";

interface Props {
  tarefaId: string
  onUploadComplete?: (novoAnexo?: Anexo) => void
  compacto?: boolean
}

export default function BotaoAnexo({ tarefaId, onUploadComplete, compacto = false }: Props) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);

  // Define o estilo baseado na prop 'compacto'
  const buttonStyle = compacto 
    ? "bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-[11px] font-bold px-3 py-1.5 rounded h-8 shadow-sm" // Estilo Compacto
    : "bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-medium px-4 py-2 rounded-md" // Estilo Padrão

  return (
    <div className={compacto ? "" : "mt-2"}>
      <UploadButton
        endpoint="anexoUploader"
        // Customização visual dinâmica
        appearance={{
            button: `${buttonStyle} transition-all ${isUploading ? 'opacity-50 cursor-wait' : ''}`,
            allowedContent: "hidden", 
            container: compacto ? "w-auto" : "w-full flex justify-start"
        }}
        // Textos personalizados
        content={{
            button({ ready, isUploading }) {
                if (isUploading) return "⏳ ...";
                if (ready) {
                    // Texto mais curto se for compacto
                    return compacto ? "📎 Anexar" : <div className="flex items-center gap-2">📎 Anexar Arquivo</div>;
                }
                return "...";
            }
        }}
        // Eventos
        onUploadBegin={() => {
            setIsUploading(true);
        }}
        onClientUploadComplete={async (res) => {
          if (res) {
            for (const arquivo of res) {
                const anexoSalvo = await salvarAnexoNoBanco({
                    nome: arquivo.name,
                    url: arquivo.url,
                    key: arquivo.key,
                    tamanho: arquivo.size,
                    tarefaId: tarefaId
                })
                
                // CHAMA O CALLBACK (Se existir)
                if (anexoSalvo && onUploadComplete) {
                    onUploadComplete(anexoSalvo)
                }
            }
            
            setIsUploading(false);
            router.refresh(); 
          }
        }}
        onUploadError={(error: Error) => {
          setIsUploading(false);
          toast.error(`Erro no upload: ${error.message}`);
        }}
      />
    </div>
  );
}