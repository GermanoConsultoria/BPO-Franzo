import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ equipeId: string }> }
) {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json([], { status: 401 })

    const { equipeId } = await params
    if (!equipeId) return NextResponse.json([])

    const projetos = await prisma.projeto.findMany({
        where: { equipe_id: equipeId, ativo: true },
        orderBy: { dt_acesso: 'desc' },
        take: 9,
    })

    return NextResponse.json(projetos)
}
