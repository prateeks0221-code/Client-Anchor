import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { userId } = await auth()

  // Resolve account — authenticated or guest
  let account = null
  if (userId) {
    account = await prisma.account.findUnique({ where: { userId } })
  } else {
    account = await prisma.account.findUnique({ where: { userId: 'guest' } })
  }

  if (!account) return NextResponse.json({ searches: [] })

  const searches = await prisma.searchQuery.findMany({
    where: { userId: account.id, status: { not: 'archived' } },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { results: true } },
      results: { select: { source: true }, take: 20 },
    },
  })

  const formatted = searches.map((s) => {
    const sources = [...new Set(s.results.map((r) => r.source))].slice(0, 3)
    return {
      id: s.id,
      prompt: s.prompt,
      intent: s.intent,
      status: s.status,
      resultCount: s.resultCount,
      avgScore: s.avgScore,
      filters: s.filters,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      actualCount: s._count.results,
      sources,
    }
  })

  return NextResponse.json({ searches: formatted })
}
