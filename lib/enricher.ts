import { prisma } from './prisma'
import * as cheerio from 'cheerio'

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_RE = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g

const EMAIL_BLOCKLIST = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js']
const EMAIL_DOMAIN_BLOCKLIST = ['example.com', 'sentry.io', 'w3.org', 'schema.org', 'google.com', 'cloudflare.com']

function cleanEmails(raw: string[]): string[] {
  return [...new Set(
    raw.filter(e =>
      !EMAIL_BLOCKLIST.some(ext => e.endsWith(ext)) &&
      !EMAIL_DOMAIN_BLOCKLIST.some(d => e.endsWith(d)) &&
      e.includes('@') && e.includes('.')
    )
  )]
}

/** Scrape a URL — extracts emails from mailto: links (precise) + text regex fallback + phones. */
async function scrapeContactsFromUrl(url: string): Promise<{ emails: string[]; phones: string[] }> {
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

    // Priority 1: explicit mailto: links — highest precision
    const mailtoEmails: string[] = []
    $('a[href^="mailto:"]').each((_, el) => {
      const raw = $(el).attr('href')?.replace(/^mailto:/i, '').split('?')[0].trim() || ''
      if (raw && raw.includes('@')) mailtoEmails.push(raw.toLowerCase())
    })

    // Priority 2: text regex — catches obfuscated emails not in links
    const text = $('body').text()
    const textEmails = (text.match(EMAIL_RE) || []).map(e => e.toLowerCase())

    // Priority 3: data attributes / JSON-LD
    const jsonLdEmails: string[] = []
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const obj = JSON.parse($(el).html() || '{}')
        const email = obj.email || obj.contactPoint?.email
        if (email && typeof email === 'string') jsonLdEmails.push(email.toLowerCase())
      } catch { /* ignore */ }
    })

    const emails = cleanEmails([...jsonLdEmails, ...mailtoEmails, ...textEmails])
    const phones = [...new Set(text.match(PHONE_RE) || [])]

    return { emails, phones }
  } catch {
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
  const newContacts: Array<{
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
        const fullName =
          e.first_name && e.last_name
            ? `${e.first_name} ${e.last_name}`.trim()
            : e.first_name || e.last_name || 'Contact'

        newContacts.push({
          name: fullName,
          title: e.position || undefined,
          email: e.value,
          linkedin: e.linkedin || undefined,
          isPrimary: !email,
        })
        if (!email) email = e.value
      }
    } catch (e) {
      console.warn('[Enricher] Hunter.io failed:', (e as Error).message)
    }
  }

  // ── 2. Scrape website ───────────────────────────────────────────────────────
  if (result.website) {
    try {
      // Scrape homepage
      const { emails: homeEmails, phones: homePhones } = await scrapeContactsFromUrl(result.website)
      if (!email && homeEmails[0]) email = homeEmails[0]
      if (!phone && homePhones[0]) phone = homePhones[0]

      // Scrape /contact, /about, /team sub-pages
      const subPages = await findContactPages(result.website)
      for (const pageUrl of subPages) {
        const { emails: subEmails, phones: subPhones } = await scrapeContactsFromUrl(pageUrl)
        if (!email && subEmails[0]) email = subEmails[0]
        if (!phone && subPhones[0]) phone = subPhones[0]

        // Add any new unique emails as contacts (no name, scraped)
        for (const e of subEmails.slice(0, 2)) {
          const alreadyHave =
            newContacts.some((c) => c.email === e) ||
            result.contacts.some((c) => c.email === e)
          if (!alreadyHave) {
            newContacts.push({ name: 'Contact (scraped)', email: e, isPrimary: false })
          }
        }
      }
    } catch (e) {
      console.warn('[Enricher] Scrape failed:', (e as Error).message)
    }
  }

  // ── 3. Persist ──────────────────────────────────────────────────────────────
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
