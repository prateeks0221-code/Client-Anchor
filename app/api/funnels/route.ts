import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { resolveAccount } from '@/lib/resolveAccount'

export async function GET() {
  const { userId } = await auth()
  const account = await resolveAccount(userId)

  try {
    const funnels = await prisma.funnel.findMany({
      where: { userId: account.id },
      orderBy: { position: 'asc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            result: {
              select: {
                id: true,
                name: true,
                type: true,
                email: true,
                website: true,
                description: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ funnels })
  } catch (error) {
    console.error('Fetch funnels error:', error)
    return NextResponse.json({ error: 'Failed to fetch funnels' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  const account = await resolveAccount(userId)

  try {
    const { name, type, description } = await req.json()

    const maxPosition = await prisma.funnel.findFirst({
      where: { userId: account.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    const funnel = await prisma.funnel.create({
      data: {
        userId: account.id,
        name,
        type,
        description,
        position: (maxPosition?.position ?? -1) + 1,
      },
      include: {
        items: {
          include: { result: true },
        },
      },
    })

    return NextResponse.json(funnel, { status: 201 })
  } catch (error) {
    console.error('Create funnel error:', error)
    return NextResponse.json({ error: 'Failed to create funnel' }, { status: 500 })
  }
}
