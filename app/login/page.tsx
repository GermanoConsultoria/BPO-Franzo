'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { authenticate } from '@/app/actions'

export default function LoginPage() {
  const [errorMessage, dispatch, isPending] = useActionState(authenticate, undefined)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/50 p-4 overflow-hidden">

      {/* CARD CENTRALIZADO */}
      {/* max-h-full garante que o card nunca seja maior que a tela */}
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full border border-white/5">

        {/* --- MARCA --- */}
        <div
          className="h-36 flex justify-center items-center shrink-0 relative overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at center, #1a4a7a 0%, #0d2d4e 50%, #081c32 100%)' }}
        >
          <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <filter id="noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noise)" style={{ mixBlendMode: 'soft-light' }} />
          </svg>
          <Image
            src="/LOGO-LETICIA-FRAZON.png"
            alt="Letícia Frazon"
            width={500}
            height={500}
            priority
            className="relative z-10 h-24 w-24 object-contain"
          />
        </div>

        {/* FORMULÁRIO (COM SCROLL INTERNO SE NECESSÁRIO) */}
        {/* Se a tela for minúscula (celular deitado), o scroll aparece SÓ AQUI dentro */}
        <form action={dispatch} className="px-8 py-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar-thin">
          
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2" htmlFor="email">
              E-mail
            </label>
            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-gray-500"
              id="email"
              type="email"
              name="email"
              required
              autoFocus
              placeholder="exemplo@gertech.com.br"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2" htmlFor="password">
              Senha
            </label>
            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-gray-500"
              id="password"
              type="password"
              name="password"
              required
              placeholder="••••••••"
            />
          </div>

          {errorMessage && (
            <div className="bg-red-900/20 text-red-400 text-xs p-3 rounded-lg flex items-center gap-2 border border-red-900/50 shrink-0">
              ⚠️ {errorMessage}
            </div>
          )}

          <div className="pt-2">
            <LoginButton />
          </div>
        </form>

        <div className="flex justify-center items-center pb-6 shrink-0">
          <Image
            src="/logo-gtech-sem-fundo.png"
            alt="G-Tech"
            width={800}
            height={800}
            className="h-10 w-10 object-contain opacity-80"
          />
        </div>

      </div>
    </div>
  )
}

function LoginButton() {
  const { pending } = useFormStatus()

  return (
    <button
      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
      aria-disabled={pending}
      disabled={pending}
    >
      {pending ? 'Entrando...' : 'Entrar'}
    </button>
  )
}