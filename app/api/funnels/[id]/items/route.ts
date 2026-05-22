import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { resolveAccount } from '@/lib/resolveAccount'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  const account = await resolveAccount(userId)

  try {
    const { id } = await params
    const { resultId } = await req.json()

    // Verify funnel belongs to this account
    const funnel = await prisma.funnel.findFirst({
      where: { id, userId: account.id },
    })

    if (!funnel) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 })
    }

    const maxPos = await prisma.funnelItem.findFirst({
      where: { funnelId: id },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const item = await prisma.funnelItem.create({
      data: {
        funnelId: id,
        resultId,
        position: (maxPos?.position ?? -1) + 1,
      },
      include: { result: true },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Result already in funnel' }, { status: 409 })
    }
    console.error('Add item error:', error)
    return NextResponse.json({ error: 'Failed to add item to funnel' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  const account = await resolveAccount(userId)

  try {
    const { id } = await params
    const { items } = await req.json()

    const funnel = await prisma.funnel.findFirst({
      where: { id, userId: account.id },
    })

    if (!funnel) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 })
    }

    await Promise.all(
      items.map((item: { id: string; position: number }) =>
        prisma.funnelItem.update({
          where: { id: item.id },
          data: { position: item.position },
        })
      )
    )

    const updatedFunnel = await prisma.funnel.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { result: true },
        },
      },
    })

    return NextResponse.json(updatedFunnel)
  } catch (error) {
    console.error('Reorder items error:', error)
    return NextResponse.json({ error: 'Failed to reorder items' }, { status: 500 })
  }
}
