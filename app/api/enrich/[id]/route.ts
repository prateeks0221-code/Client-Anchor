import { NextRequest, NextResponse } from 'next/server'
import { enrichResult } from '@/lib/enricher'
import { prisma } from '@/lib/prisma'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Verify result exists
  const exists = await prisma.result.findUnique({ where: { id }, select: { id: true } })
  if (!exists) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 })
  }

  try {
    const enriched = await enrichResult(id)
    if (!enriched) {
      return NextResponse.json({ error: 'Enrichment skipped (no website)' }, { status: 422 })
    }

    return NextResponse.json({
      id: enriched.id,
      email: enriched.email,
      phone: enriched.phone,
      enriched: enriched.enriched,
      contacts: enriched.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        title: c.title,
        email: c.email,
        linkedin: c.linkedin,
        isPrimary: c.isPrimary,
      })),
    })
  } catch (err) {
    console.error('[Enrich API]', err)
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}
