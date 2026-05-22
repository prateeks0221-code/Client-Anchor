import { prisma } from './prisma'
import * as cheerio from 'cheerio'
import {
  isValidEmailFormat,
  isBlocklistedDomain,
  extractDomain,
  validateAndScoreEmails,
  pickTopEmails,
  isGmail,
} from './email-validator'

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g

/** Scrape URL — extract emails with source tracking + phones */
async function scrapeContactsFromUrl(url: string): Promise<{
  emails: Array<{ email: string; source: 'json_ld' | 'mailto' | 'regex' }>
  phones: string[]
}> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ClientAnchor/1.0; +https://clientanchor.app)' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return { emails: [], phones: [] }

    const html = await res.text()
    const $ = cheerio.load(html)
    const body = $('body').text()

    // ── Tier 1: JSON-LD structured data (highest trust) ──
    const jsonLdEmails: string[] = []
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const obj = JSON.parse($(el).html() || '{}')
        const email = obj.email || obj.contactPoint?.email || obj.contact_point?.email
        if (email && typeof email === 'string' && isValidEmailFormat(email)) {
          jsonLdEmails.push(email.toLowerCase())
        }
      } catch {
        /* ignore parse errors */
      }
    })

    // ── Tier 2: mailto: href links (explicit contact intent) ──
    const mailtoEmails: string[] = []
    $('a[href^="mailto:"]').each((_, el) => {
      const raw = $(el).attr('href')?.replace(/^mailto:/i, '').split('?')[0].trim() || ''
      if (isValidEmailFormat(raw)) mailtoEmails.push(raw.toLowerCase())
    })

    // ── Tier 3: Regex text scan (lowest trust) ──
    const regexEmails: string[] = []
    const matches = body.match(EMAIL_RE) || []
    for (const m of matches) {
      const email = m.toLowerCase()
      if (
        isValidEmailFormat(email) &&
        !isBlocklistedDomain(extractDomain(email) || '')
      ) {
        regexEmails.push(email)
      }
    }

    // Collect with source metadata
    const emailsWithSource = [
      ...jsonLdEmails.map((email) => ({ email, source: 'json_ld' as const })),
      ...mailtoEmails.map((email) => ({ email, source: 'mailto' as const })),
      ...regexEmails.map((email) => ({ email, source: 'regex' as const })),
    ]

    // Extract phones
    const phones = [...new Set(body.match(PHONE_RE) || [])]

    return { emails: emailsWithSource, phones }
  } catch (err) {
    console.warn('[Enricher] Scrape error:', err instanceof Error ? err.message : String(err))
    return { emails: [], phones: [] }
  }
}

/** Find /contact, /about, /team sub-pages to scrape deeper. */
async function findContactPages(baseUrl: string): Promise<string[]> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(baseUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ClientAnchor/1.0)' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return []

    const html = await res.text()
    const $ = cheerio.load(html)
    const origin = new URL(baseUrl).origin
    const paths = new Set<string>()

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (/\/(contact|about|team|people|staff)/i.test(href)) {
        const full = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`
        paths.add(full)
      }
    })

    return Array.from(paths).slice(0, 3)
  } catch {
    return []
  }
}

// ── Main enricher ─────────────────────────────────────────────────────────────

export async function enrichResult(resultId: string) {
  const result = await prisma.result.findUnique({
    where: { id: resultId },
    include: { contacts: true },
  })
  if (!result) return null

  let email = result.email
  let phone = result.phone

  // Accumulate ALL emails across all sources — scored + deduped at end
  const allEmails: Array<{ email: string; source: 'json_ld' | 'mailto' | 'hunter' | 'regex' }> = []

  // Named contacts seeded from searchers (Apollo pre-populates these)
  const seededContacts: Array<{
    name: string
    title?: string
    email?: string
    linkedin?: string
    isPrimary: boolean
  }> = []

  // ── 0. Seed contacts from Apollo rawData (already have structured data) ────
  const raw = result.rawData as Record<string, any> | null
  if (raw?.apolloContacts?.length) {
    for (const c of raw.apolloContacts) {
      if (!c.name) continue
      seededContacts.push({
        name: c.name,
        title: c.title,
        linkedin: c.linkedinUrl,
        isPrimary: false,
      })
    }
  }

  // Named contacts from Hunter (we keep metadata separate)
  const hunterContacts: Array<{
    name: string
    title?: string
    email?: string
    linkedin?: string
    isPrimary: boolean
  }> = []

  // ── 1. Hunter.io domain search ──────────────────────────────────────────────
  const hunterKey = process.env.HUNTER_API_KEY
  if (hunterKey && result.website) {
    try {
      const domain = new URL(result.website).hostname.replace(/^www\./, '')
      const res = await fetch(
        `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterKey}&limit=5`,
        { signal: AbortSignal.timeout(8000) }
      )
      const data = await res.json()
      const emails: any[] = data.data?.emails || []

      for (const e of emails.slice(0, 3)) {
        if (e.value) allEmails.push({ email: e.value, source: 'hunter' })

        const fullName =
          e.first_name && e.last_name
            ? `${e.first_name} ${e.last_name}`.trim()
            : e.first_name || e.last_name || 'Contact'

        hunterContacts.push({
          name: fullName,
          title: e.position || undefined,
          email: e.value || undefined,
          linkedin: e.linkedin || undefined,
          isPrimary: false,
        })
      }
    } catch (e) {
      console.warn('[Enricher] Hunter.io failed:', (e as Error).message)
    }
  }

  // ── 2. Scrape website ───────────────────────────────────────────────────────
  if (result.website) {
    try {
      // Homepage
      const { emails: homeEmails, phones: homePhones } = await scrapeContactsFromUrl(result.website)
      allEmails.push(...homeEmails)
      if (!phone && homePhones[0]) phone = homePhones[0]

      // Sub-pages: /contact, /about, /team
      const subPages = await findContactPages(result.website)
      for (const pageUrl of subPages) {
        const { emails: subEmails, phones: subPhones } = await scrapeContactsFromUrl(pageUrl)
        allEmails.push(...subEmails)
        if (!phone && subPhones[0]) phone = subPhones[0]
      }
    } catch (e) {
      console.warn('[Enricher] Scrape failed:', (e as Error).message)
    }
  }

  // ── 3. Score + dedupe — Gmail gets priority ─────────────────────────────────
  const scored = validateAndScoreEmails(allEmails)
  const topEmails = pickTopEmails(scored, 3)

  console.log(
    `[Enricher] ${resultId}: ${allEmails.length} raw → ${scored.length} unique → top: [${topEmails.join(', ')}]`
  )

  // Primary email = highest confidence (Gmail wins ties via pickTopEmails)
  if (!email && topEmails[0]) email = topEmails[0]

  // ── 4. Build contacts list ──────────────────────────────────────────────────
  const newContacts: Array<{
    name: string
    title?: string
    email?: string
    linkedin?: string
    isPrimary: boolean
  }> = []

  // Apollo seeded contacts (LinkedIn POCs) — add first if not already saved
  for (const c of seededContacts) {
    const alreadySaved = result.contacts.some(
      (rc) => rc.name === c.name || (c.linkedin && rc.linkedin === c.linkedin)
    )
    if (!alreadySaved) newContacts.push({ ...c, isPrimary: false })
  }

  // Hunter contacts carry real names + titles — add them
  for (const c of hunterContacts) {
    const alreadyAdded = newContacts.some((nc) => nc.email === c.email && c.email)
    if (!alreadyAdded) newContacts.push({ ...c, isPrimary: c.email === email })
  }

  // Remaining top emails not already covered
  for (const e of topEmails) {
    const inHunter = hunterContacts.some((c) => c.email === e)
    const inExisting = result.contacts.some((c) => c.email === e)
    const inNew = newContacts.some((c) => c.email === e)
    if (!inHunter && !inExisting && !inNew) {
      const scoreEntry = scored.find((s) => s.email === e)
      const sourceName = scoreEntry?.source ?? 'scraped'
      newContacts.push({
        name: `Contact (${sourceName})`,
        email: e,
        isPrimary: e === email,
      })
    }
  }

  // ── 5. Persist ──────────────────────────────────────────────────────────────
  await prisma.result.update({
    where: { id: resultId },
    data: {
      email: email ?? undefined,
      phone: phone ?? undefined,
      enriched: true,
      refreshedAt: new Date(),
    },
  })

  for (const c of newContacts) {
    await prisma.contact.create({ data: { resultId, ...c } })
  }

  return prisma.result.findUnique({
    where: { id: resultId },
    include: { contacts: true },
  })
}
