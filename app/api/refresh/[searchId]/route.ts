import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runAllSearchers } from '@/lib/searchers'
import { SearchFilters } from '@/types'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const { searchId } = await params

  const search = await prisma.searchQuery.findUnique({
    where: { id: searchId },
    include: { results: { select: { name: true, source: true } } },
  })
  if (!search) return NextResponse.json({ error: 'Search not found' }, { status: 404 })
  if (search.status === 'running') {
    return NextResponse.json({ error: 'Refresh already in progress' }, { status: 409 })
  }

  // Mark as running
  await prisma.searchQuery.update({ where: { id: searchId }, data: { status: 'running' } })

  try {
    const filters = (search.filters as unknown as SearchFilters) || {}
    const rawResults = await runAllSearchers(search.prompt, filters)

    // Deduplicate against existing results (by name + source)
    const existingKeys = new Set(search.results.map((r) => `${r.name}::${r.source}`))
    const newResults = rawResults.filter(
      (r) => !existingKeys.has(`${r.name}::${r.source}`)
    )

    if (newResults.length > 0) {
      await prisma.result.createMany({
        data: newResults.map((r) => ({
          searchId,
          name: r.name,
          type: r.type,
          description: r.description?.slice(0, 500),
          website: r.website,
          email: r.email,
          phone: r.phone,
          address: r.address,
          city: r.city,
          country: r.country,
          source: r.source,
          sourceUrl: r.sourceUrl,
          rawData: r.rawData || {},
          matchScore: 0,
        })),
      })
    }

    const totalCount = await prisma.result.count({ where: { searchId } })

    await prisma.searchQuery.update({
      where: { id: searchId },
      data: { status: 'completed', resultCount: totalCount, updatedAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      newResults: newResults.length,
      totalCount,
    })
  } catch (err) {
    await prisma.searchQuery.update({ where: { id: searchId }, data: { status: 'completed' } })
    console.error('[Refresh]', err)
    return NextResponse.json({ error: 'Refresh failed', details: (err as Error).message }, { status: 500 })
  }
}
