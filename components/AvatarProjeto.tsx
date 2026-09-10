'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { generateReactHelpers } from "@uploadthing/react"
import { atualizarImagemProjeto } from '@/app/actions'
import type { OurFileRouter } from "@/app/api/uploadthing/core"
import { useRouter } from 'next/navigation'
import ModalCropper from './ModalCropper'

const { useUploadThing } = generateReactHelpers<OurFileRouter>()

interface Props {
  projetoId: string
  imagem?: string | null
  nome: string
  tamanho?: string
  readonly?: boolean
}

export default function AvatarProjeto({ 
  projetoId, 
  imagem, 
  nome, 
  tamanho = "w-12 h-12",
  readonly = false
}: Props) {
  const router = useRouter()
  const [preview, setPreview] = useState<string | null>(imagem || null)
  const [loading, setLoading] = useState(false)
  const [imageSrcToCrop, setImageSrcToCrop] = useState<string | null>(null)
  const [isCropperOpen, setIsCropperOpen] = useState(false)

  const { startUpload } = useUploadThing("anexoUploader")

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readonly) return
    
    // REFORÇO 1: Parar propagação aqui também
    e.preventDefault()
    e.stopPropagation() 

    if (!e.target.files?.[0]) return
    const file = e.target.files[0]
    
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.src = objectUrl
    
    img.onload = () => {
        const MIN_SIZE = 150 
        if (img.naturalWidth < MIN_SIZE || img.naturalHeight < MIN_SIZE) {
            toast.error(`Imagem muito pequena. Use pelo menos ${MIN_SIZE}px.`)
            URL.revokeObjectURL(objectUrl)
            e.target.value = ''
            return
        }
        setImageSrcToCrop(objectUrl)
        setIsCropperOpen(true)
        e.target.value = '' 
    }
  }

  const handleUploadCroppedImage = async (croppedBlob: Blob) => {
      setLoading(true)
      setIsCropperOpen(false)
      const objectUrl = URL.createObjectURL(croppedBlob)
      setPreview(objectUrl)

      try {
          const fileToUpload = new File([croppedBlob], "logo.jpg", { type: "image/jpeg" })
          const res = await startUpload([fileToUpload])

          if (res && res[0]) {
            await atualizarImagemProjeto(projetoId, res[0].url)
            router.refresh()
          }
      } catch {
          toast.error('Erro ao enviar imagem. Tente novamente.')
          setPreview(imagem || null)
      } finally {
          setLoading(false)
          setImageSrcToCrop(null)
      }
  }

  const handleCancelCrop = () => {
      setIsCropperOpen(false)
      setImageSrcToCrop(null)
  }

  return (
    <>
        <div 
            className={`relative group ${tamanho} shrink-0`}
            // REFORÇO 2: Barreira de segurança no container pai
            onClick={(e) => {
                if (!readonly) {
                    e.stopPropagation()
                    // e.preventDefault() // Cuidado: não usar preventDefault no container ou o input filho pode falhar em alguns browsers
                }
            }}
        >
            {!readonly && (
                <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={loading}
                    // REFORÇO 3: onClick direto no input é a defesa principal
                    onClick={(e) => { 
                        e.stopPropagation() 
                        // Nota: Não use preventDefault() aqui, senão a janela de arquivos não abre
                    }}
                    // REFORÇO 4: z-50 garante que ele está ACIMA do Link (que geralmente é z-0 ou z-10)
                    className="absolute inset-0 w-full h-full opacity-0 z-50 cursor-pointer disabled:cursor-not-allowed"
                    title="Alterar logo"
                />
            )}

            <div className={`w-full h-full rounded-lg overflow-hidden border border-border flex items-center justify-center bg-surface-highlight/30 relative transition-all ${!readonly ? 'group-hover:border-indigo-500/50' : ''}`}>
                {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent" />
                ) : preview ? (
                    <img src={preview} alt={nome} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-lg font-bold text-foreground opacity-50 uppercase select-none">
                        {nome.substring(0, 1)}
                    </span>
                )}

                {!readonly && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-40 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </div>
                )}
            </div>
        </div>

        {isCropperOpen && imageSrcToCrop && !readonly && (
            <ModalCropper 
                imageSrc={imageSrcToCrop}
                onCancel={handleCancelCrop}
                onCropComplete={handleUploadCroppedImage}
                loading={loading}
            />
        )}
    </>
  )
}