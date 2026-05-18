import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PATCH /api/searches/[id] — archive or restore
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let body: { status?: string } = {}
  try { body = await req.json() } catch { /* empty body ok */ }

  const allowed = ['archived', 'completed']
  const newStatus = body.status ?? 'archived'
  if (!allowed.includes(newStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 422 })
  }

  const search = await prisma.searchQuery.findUnique({ where: { id }, select: { id: true } })
  if (!search) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.searchQuery.update({ where: { id }, data: { status: newStatus } })
  return NextResponse.json({ success: true, id, status: newStatus })
}
