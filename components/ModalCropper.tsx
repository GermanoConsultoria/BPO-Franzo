'use client'

import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import Cropper from 'react-easy-crop'
import getCroppedImg from '@/lib/cropImage'
import type { Area } from 'react-easy-crop'

interface Props {
    imageSrc: string
    onCancel: () => void
    onCropComplete: (croppedFile: Blob) => void
    loading?: boolean
}

export default function ModalCropper({ imageSrc, onCancel, onCropComplete, loading }: Props) {
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = 'unset' }
    }, [])

    const onCropChangeComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const handleConfirm = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        if (!imageSrc || !croppedAreaPixels) return;
        
        try {
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
            if (croppedImageBlob) {
                onCropComplete(croppedImageBlob)
            }
        } catch {
            toast.error('Erro ao cortar imagem. Tente novamente.')
        }
    }

    const handleCancel = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
    }

    if (!mounted) return null

    return createPortal(
        <div 
            className="fixed inset-0 z-[99999] bg-black/95 flex flex-col animate-in fade-in duration-200"
            onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
            }}
        >
            <div className="p-4 flex justify-between items-center text-white/80 absolute top-0 left-0 right-0 z-50 pointer-events-none">
                <span className="bg-black/50 px-3 py-1 rounded text-xs pointer-events-auto">Ajuste Livre (Arraste e Zoom)</span>
            </div>

            <div className="relative flex-1 w-full h-full overflow-hidden bg-black/90">
                 <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    
                    // --- MUDANÇA PRINCIPAL AQUI ---
                    // Define um tamanho fixo visual para o quadrado na tela.
                    // Independente se a imagem é 50px ou 5000px, o quadrado terá 280px.
                    cropSize={{ width: 280, height: 280 }}
                    // ------------------------------

                    minZoom={0.1}
                    maxZoom={10} // Aumentei o zoom máximo caso seja um ícone muito pequeno
                    restrictPosition={false}
                    onCropChange={setCrop}
                    onCropComplete={onCropChangeComplete}
                    onZoomChange={setZoom}
                    style={{
                        containerStyle: { width: '100%', height: '100%' },
                        cropAreaStyle: { 
                            border: '2px solid white', 
                            color: 'rgba(0,0,0,0.5)',
                            // Opcional: arredondar um pouco o quadrado visualmente
                            borderRadius: '8px'
                        }
                    }}
                    // 'contain' faz a imagem aparecer inteira na tela preta inicialmente
                    objectFit="contain" 
                />
            </div>
            
            <div className="bg-[#18181b] border-t border-[#27272a] p-6 pb-8 shrink-0 flex flex-col gap-6" onClick={e => e.stopPropagation()}>
                
                {/* Slider de Zoom */}
                <div className="flex items-center gap-4 max-w-md mx-auto w-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="11" cy="11" r="8"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
                    
                    <input
                        type="range"
                        value={zoom}
                        min={0.1}
                        // Aumentei o max aqui também para combinar com o Cropper
                        max={10}
                        step={0.1}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
                </div>

                <div className="flex gap-4 max-w-md mx-auto w-full">
                    <button 
                        onClick={handleCancel} 
                        disabled={loading}
                        className="flex-1 py-3 bg-[#27272a] hover:bg-[#3f3f46] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={loading}
                        className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                        {loading ? (
                             <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                        ) : 'Salvar Logo'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}