'use client'

import { useRouter } from 'next/navigation'
import AvatarProjeto from './AvatarProjeto'

interface CardProjetoProps {
  projeto: {
    id: string
    nome: string
    descricao: string | null
    ativo: boolean
    imagem: string | null
    equipe_id?: string | null // <--- ADICIONAMOS AQUI
    _count: {
        tarefas: number
    }
  }
}

export default function CardProjeto({ projeto }: CardProjetoProps) {
  const router = useRouter()

  // Função de navegação corrigida!
  const handleNavegar = () => {
    if (projeto.equipe_id) {
       router.push(`/equipe/${projeto.equipe_id}/projeto/${projeto.id}`)
    }
  }

  return (
    <div 
      onClick={handleNavegar}
      className={`
        group relative p-4 lg:p-6 rounded-xl border transition-all flex flex-col cursor-pointer
        ${projeto.ativo 
            ? 'bg-surface border-border hover:border-indigo-300 hover:shadow-md' 
            : 'bg-surface border-gray-100 opacity-60 grayscale hover:grayscale-0'
        }
      `}
    >
      <div className="flex justify-between items-start mb-2 lg:mb-4">
        <div onClick={(e) => e.stopPropagation()}>
            <AvatarProjeto 
                projetoId={projeto.id} 
                imagem={projeto.imagem} 
                nome={projeto.nome}
                tamanho="w-16 h-16"
            />
        </div>

        <span className="text-[10px] lg:text-xs font-medium bg-surface/50 text-gray-600 px-2 py-1 rounded-full">
          {projeto._count.tarefas} tarefas
        </span>
        
        {!projeto.ativo && (
            <span className="text-[9px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded ml-2">
                Arquivado
            </span>
        )}
      </div>

      <h3 className="text-base lg:text-lg font-bold text-foreground mb-1 group-hover:text-indigo-600 transition-colors truncate">
        {projeto.nome}
      </h3>
      
      <p className="text-xs lg:text-sm text-gray-500 line-clamp-2">
        {projeto.descricao || 'Sem descrição.'}
      </p>
    </div>
  )
}