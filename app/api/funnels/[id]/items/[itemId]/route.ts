import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { resolveAccount } from '@/lib/resolveAccount'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { userId } = await auth()
  const account = await resolveAccount(userId)

  try {
    const { id, itemId } = await params

    // Verify funnel belongs to this account
    const funnel = await prisma.funnel.findFirst({
      where: { id, userId: account.id },
    })

    if (!funnel) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 })
    }

    await prisma.funnelItem.delete({
      where: { id: itemId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete item error:', error)
    return NextResponse.json({ error: 'Failed to delete item from funnel' }, { status: 500 })
  }
}
