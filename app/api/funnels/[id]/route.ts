import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { resolveAccount } from '@/lib/resolveAccount'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  const account = await resolveAccount(userId)

  try {
    const { id } = await params
    const { name, type, description, position } = await req.json()

    const funnel = await prisma.funnel.update({
      where: { id, userId: account.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(description !== undefined && { description }),
        ...(position !== undefined && { position }),
      },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: { result: true },
        },
      },
    })

    return NextResponse.json(funnel)
  } catch (error) {
    console.error('Update funnel error:', error)
    return NextResponse.json({ error: 'Failed to update funnel' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  const account = await resolveAccount(userId)

  try {
    const { id } = await params

    await prisma.funnel.delete({
      where: { id, userId: account.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete funnel error:', error)
    return NextResponse.json({ error: 'Failed to delete funnel' }, { status: 500 })
  }
}
