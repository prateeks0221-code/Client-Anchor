import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'

const resend = new Resend(process.env.RESEND_API_KEY)

// Sender — must be a verified domain in Resend prod; onboarding@resend.dev works in dev/test
const FROM = process.env.RESEND_FROM_EMAIL || 'ClientAnchor <onboarding@resend.dev>'

interface OutreachPayload {
  resultId: string
  toEmail: string
  toEmails?: string[]     // multi-recipient (primary + extras)
  subject: string
  body: string            // rendered (vars substituted)
  approachType: string    // 'pas' | 'partnership' | 'job' | 'custom'
  segment?: string        // alias for approachType
  variantIndex?: number   // 0=A, 1=B, 2=C
  templateName: string
}

export async function POST(req: NextRequest) {
  let payload: OutreachPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { resultId, toEmail, toEmails, subject, body, approachType, segment, variantIndex, templateName } = payload

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

  // Send via Resend
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: allRecipients,
      subject,
      text: body,
    })

    if (error) throw new Error(error.message)

    // Mark sent
    await prisma.outreachEvent.update({
      where: { id: event.id },
      data: { status: 'sent', sentAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      eventId: event.id,
      resendId: data?.id,
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
