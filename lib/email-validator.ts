/**
 * Email validation + authenticity scoring
 * Filters junk, detects Gmail, validates domain, returns confidence score
 */

// Domains that are never real email sources (CDNs, frameworks, services)
const DOMAIN_BLOCKLIST = new Set([
  'sentry.io',
  'w3.org',
  'schema.org',
  'cloudflare.com',
  'amazonaws.com',
  'azure.microsoft.com',
  'heroku.com',
  'vercel.com',
  'netlify.com',
  'firebase.google.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'confluence.atlassian.net',
  'jira.atlassian.net',
  'slack.com',
  'discord.com',
  'telegram.org',
  'example.com',
  'test.com',
  'localhost',
  'invalid',
  'example.org',
  'example.net',
  'google.com', // internal, not contact
  'wikipedia.org',
  'reddit.com',
  'twitter.com',
  'facebook.com',
  'linkedin.com',
  'youtube.com',
  'instagram.com',
  'wordpress.com',
  'medium.com',
  'substack.com',
  'notion.so',
  'airtable.com',
])

// Email format regex (loose, catches most real emails)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validate email format
 * Returns true if looks like valid email
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  email = email.trim().toLowerCase()
  if (email.length > 254) return false // RFC 5321
  if (!EMAIL_REGEX.test(email)) return false
  return true
}

/**
 * Extract domain from email
 */
export function extractDomain(email: string): string | null {
  const match = email.toLowerCase().match(/@(.+)$/)
  return match ? match[1] : null
}

/**
 * Check if domain is blocklisted
 */
export function isBlocklistedDomain(domain: string): boolean {
  if (!domain) return true
  const normalized = domain.toLowerCase().trim()
  return DOMAIN_BLOCKLIST.has(normalized)
}

/**
 * Detect if email is Gmail
 */
export function isGmail(email: string): boolean {
  const domain = extractDomain(email)
  return domain === 'gmail.com' || domain === 'googlemail.com'
}

/**
 * Score email confidence 0-100
 * Based on source + format + domain authenticity
 */
export function scoreEmailConfidence(
  email: string,
  source: 'json_ld' | 'mailto' | 'hunter' | 'regex'
): number {
  if (!isValidEmailFormat(email)) return 0

  const domain = extractDomain(email)
  if (!domain || isBlocklistedDomain(domain)) return 0

  // Base score by source (authenticity tier)
  const sourceScores = {
    json_ld: 95,    // structured data = high trust
    hunter: 90,     // Hunter.io verified
    mailto: 80,     // href link = deliberate
    regex: 60,      // text match = lowest trust
  }

  let score = sourceScores[source]

  // Gmail boost
  if (isGmail(email)) score = Math.min(100, score + 5)

  // Domain with strong TLD boost
  if (domain.endsWith('.co.uk') || domain.endsWith('.de') || domain.endsWith('.fr')) {
    score = Math.min(100, score + 3)
  }

  return score
}

/**
 * Validate + score batch of emails
 * Returns array of {email, source, score} sorted by score desc
 */
export function validateAndScoreEmails(
  emails: Array<{ email: string; source: 'json_ld' | 'mailto' | 'hunter' | 'regex' }>
): Array<{ email: string; source: string; score: number }> {
  // Score all valid emails
  const scored = emails
    .filter(({ email }) => isValidEmailFormat(email))
    .map(({ email, source }) => ({
      email: email.toLowerCase().trim(),
      source,
      score: scoreEmailConfidence(email, source),
    }))
    .filter(({ score }) => score > 0) // Remove blocklisted/invalid

  // Deduplicate by email, keep highest score per address
  const deduped: Record<string, { email: string; source: string; score: number }> = {}
  for (const item of scored) {
    if (!deduped[item.email] || item.score > deduped[item.email].score) {
      deduped[item.email] = item
    }
  }

  // Sort: highest score first, Gmail wins ties
  return Object.values(deduped).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return isGmail(b.email) ? 1 : -1
  })
}

/**
 * Pick top N emails, prioritizing Gmail + highest score
 */
export function pickTopEmails(
  emails: Array<{ email: string; source: string; score: number }>,
  limit: number = 3
): string[] {
  // Gmail emails first
  const gmailEmails = emails.filter((e) => isGmail(e.email)).slice(0, limit)
  if (gmailEmails.length >= limit) return gmailEmails.map((e) => e.email)

  // Fill remaining with highest score
  const others = emails
    .filter((e) => !isGmail(e.email))
    .slice(0, limit - gmailEmails.length)

  return [...gmailEmails, ...others].map((e) => e.email)
}
