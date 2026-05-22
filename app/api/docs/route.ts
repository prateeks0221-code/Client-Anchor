import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function GET() {
  const docs = await prisma.outreachDoc.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ docs })
}

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename = `${Date.now()}-${safeName}`

  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer)

  const doc = await prisma.outreachDoc.create({
    data: {
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      path: filename,
    },
  })

  return NextResponse.json(doc, { status: 201 })
}
