const NUMERO_WHATSAPP = '5519997012163'
const MENSAGEM_WHATSAPP = 'Olá boa tarde, gostaria de um suporte no sistema BPO, pode me ajudar?'

export default function WhatsAppButton() {
  const href = `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(MENSAGEM_WHATSAPP)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Suporte via WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-110 hover:shadow-xl"
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8 fill-white">
        <path d="M16.001 3C9.373 3 4 8.373 4 15.001c0 2.377.694 4.594 1.885 6.457L4 29l7.72-1.844a11.94 11.94 0 0 0 4.281.783h.005c6.627 0 12-5.373 12-12.001C28.006 8.373 22.633 3 16.001 3Zm0 21.99a9.93 9.93 0 0 1-5.06-1.386l-.363-.216-4.583 1.095 1.12-4.464-.237-.375a9.93 9.93 0 0 1-1.523-5.643c0-5.507 4.482-9.99 9.993-9.99 5.508 0 9.99 4.483 9.99 9.99 0 5.51-4.483 9.99-9.99 9.99Zm5.478-7.477c-.3-.15-1.774-.876-2.05-.976-.276-.1-.477-.15-.678.15-.2.3-.777.976-.953 1.176-.176.2-.351.226-.652.075-.3-.15-1.266-.467-2.412-1.487-.892-.795-1.494-1.777-1.669-2.077-.176-.3-.019-.462.132-.611.135-.135.3-.351.451-.527.15-.176.2-.3.3-.5.1-.2.05-.375-.025-.526-.075-.15-.678-1.635-.929-2.24-.245-.588-.494-.508-.678-.518-.176-.008-.376-.01-.577-.01a1.107 1.107 0 0 0-.803.375c-.276.3-1.053 1.03-1.053 2.514 0 1.484 1.079 2.918 1.229 3.118.15.2 2.123 3.24 5.146 4.544.719.31 1.28.495 1.718.634.722.23 1.379.198 1.899.12.579-.087 1.774-.725 2.025-1.425.25-.7.25-1.3.176-1.425-.075-.125-.276-.2-.577-.35Z" />
      </svg>
    </a>
  )
}
