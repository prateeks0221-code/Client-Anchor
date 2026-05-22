import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const doc = await prisma.outreachDoc.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await fs.unlink(path.join(UPLOAD_DIR, doc.path)).catch(() => {})
  await prisma.outreachDoc.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
