import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import path from 'path'
import { prisma } from '@/lib/prisma'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

const FROM = process.env.GMAIL_USER ?? ''

interface OutreachPayload {
  resultId: string
  toEmail: string
  toEmails?: string[]
  cc?: string[]
  subject: string
  body: string
  approachType: string
  segment?: string
  variantIndex?: number
  templateName: string
  docIds?: string[]
}

export async function POST(req: NextRequest) {
  let payload: OutreachPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { resultId, toEmail, toEmails, cc, subject, body, approachType, segment, variantIndex, templateName, docIds } = payload

  if (!resultId || !toEmail || !subject || !body) {
    return NextResponse.json({ error: 'Missing required fields: resultId, toEmail, subject, body' }, { status: 422 })
  }

  // Verify result exists
  const result = await prisma.result.findUnique({ where: { id: resultId }, select: { id: true } })
  if (!result) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 })
  }

  // Collect all recipients (deduped)
  const allRecipients = [...new Set([toEmail, ...(toEmails ?? [])].filter(Boolean))]

  // Save as draft first
  const event = await prisma.outreachEvent.create({
    data: {
      resultId,
      templateId: approachType || segment || 'pas',
      segment: segment || approachType || 'pas',
      variantIndex: variantIndex ?? 0,
      toEmails: allRecipients,
      subject,
      body,
      status: 'draft',
    },
  })

  // Resolve attachments
  const attachments: nodemailer.SendMailOptions['attachments'] = []
  if (docIds && docIds.length > 0) {
    const docs = await prisma.outreachDoc.findMany({ where: { id: { in: docIds } } })
    for (const doc of docs) {
      attachments.push({
        filename: doc.name,
        path: path.join(UPLOAD_DIR, doc.path),
        contentType: doc.mimeType,
      })
    }
  }

  // Send via Gmail SMTP
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to: allRecipients.join(', '),
      cc: cc && cc.length > 0 ? cc.join(', ') : undefined,
      subject,
      text: body,
      attachments,
    })

    // Mark sent
    await prisma.outreachEvent.update({
      where: { id: event.id },
      data: { status: 'sent', sentAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      eventId: event.id,
      messageId: info.messageId,
      to: toEmail,
      subject,
    })
  } catch (err) {
    // Keep draft in DB for retry
    await prisma.outreachEvent.update({
      where: { id: event.id },
      data: { status: 'draft' },
    })
    console.error('[Outreach] Send failed:', err)
    return NextResponse.json(
      { error: 'Send failed', details: (err as Error).message },
      { status: 500 }
    )
  }
}

// GET: fetch outreach history for a result
export async function GET(req: NextRequest) {
  const resultId = req.nextUrl.searchParams.get('resultId')
  if (!resultId) return NextResponse.json({ error: 'resultId required' }, { status: 400 })

  const events = await prisma.outreachEvent.findMany({
    where: { resultId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ events })
}
