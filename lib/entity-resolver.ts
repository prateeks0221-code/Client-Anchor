import { RawResult } from '@/types'

/**
 * Entity Resolver — merges raw results from multiple searchers
 * into deduplicated company entities.
 *
 * Algorithm:
 *  1. Sort by source priority (Apollo > SerpAPI > Google Places > JSearch > Adzuna)
 *  2. Group by root domain (same domain = definitively same company)
 *  3. Fuzzy-match remaining by normalised name (strip legal suffixes, Levenshtein ≤ 2)
 *  4. Merge fields: higher-trust source wins on conflicts
 */

// ── Source trust ranking ──────────────────────────────────────────────────────
const SOURCE_PRIORITY: Record<string, number> = {
  apollo: 10,
  serpapi: 8,
  google_places: 8,
  serpapi_jobs: 6,
  jsearch: 5,
  adzuna: 3,
}

function priority(source: string): number {
  return SOURCE_PRIORITY[source] ?? 2
}

// ── String utilities ──────────────────────────────────────────────────────────

function rootDomain(url?: string): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch { return null }
}

/** Strip legal suffixes + punctuation for fuzzy comparison */
function normName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(pvt\.?|ltd\.?|inc\.?|llc\.?|corp\.?|limited|private|public|gmbh|plc|co\.|technologies|solutions|services|systems|consulting|consultancy|group)\s*$/i, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Classic Levenshtein distance */
function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/** True if two normalised names are similar enough to be the same entity */
function namesSimilar(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 3 || b.length < 3) return false
  if (a.includes(b) || b.includes(a)) return true
  // Only run expensive Levenshtein on names long enough to be distinctive
  return a.length >= 5 && b.length >= 5 && lev(a, b) <= 2
}

// ── Field merging ─────────────────────────────────────────────────────────────

function mergeTwo(primary: RawResult, secondary: RawResult): RawResult {
  // primary = higher-priority source, already in map
  return {
    name: primary.name,
    type: primary.type === 'corporation' || secondary.type === 'corporation'
      ? 'corporation'
      : primary.type,
    description: primary.description || secondary.description,
    website: primary.website || secondary.website,
    email: primary.email || secondary.email,
    phone: primary.phone || secondary.phone,
    address: primary.address || secondary.address,
    city: primary.city || secondary.city,
    country: primary.country || secondary.country,
    source: primary.source,
    sourceUrl: primary.sourceUrl || secondary.sourceUrl,
    linkedinUrl: primary.linkedinUrl || secondary.linkedinUrl
      || primary.rawData?.linkedinUrl || secondary.rawData?.linkedinUrl
      || undefined,
    rawData: {
      // secondary fields first (lower trust), primary overwrites
      ...(secondary.rawData || {}),
      ...(primary.rawData || {}),
      // explicitly merge arrays / cross-source metadata
      linkedinUrl: primary.linkedinUrl || secondary.linkedinUrl
        || primary.rawData?.linkedinUrl || secondary.rawData?.linkedinUrl,
      sources: [...new Set([
        primary.source,
        secondary.source,
        ...(primary.rawData?.sources || []),
        ...(secondary.rawData?.sources || []),
      ])],
      openRoles: [
        ...(primary.rawData?.openRoles || []),
        ...(secondary.rawData?.openRoles || []),
      ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 10),
      apolloContacts: primary.rawData?.apolloContacts || secondary.rawData?.apolloContacts,
    },
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Deduplicate and merge `RawResult[]` from all searchers.
 * Returns one entity per unique company.
 */
export function resolveEntities(results: RawResult[]): RawResult[] {
  if (results.length === 0) return []

  // Sort: highest-trust source first so it becomes the "primary" in merges
  const sorted = [...results].sort((a, b) => priority(b.source) - priority(a.source))

  // domainMap: root domain → merged entity
  const domainMap = new Map<string, RawResult>()
  // nameMap: normalised name → merged entity  (for results without a website)
  const nameMap = new Map<string, RawResult>()

  for (const r of sorted) {
    const domain = rootDomain(r.website)
    const nname = normName(r.name)

    // ── 1. Try domain grouping ─────────────────────────────────────────────
    if (domain) {
      if (domainMap.has(domain)) {
        domainMap.set(domain, mergeTwo(domainMap.get(domain)!, r))
      } else {
        // Before inserting, check if this domain's company name matches a nameMap entry
        let mergedFromName = false
        for (const [key, existing] of nameMap) {
          if (namesSimilar(nname, key)) {
            // Upgrade the nameMap entry to a domainMap entry
            const merged = mergeTwo(existing, r)
            domainMap.set(domain, merged)
            nameMap.delete(key)
            mergedFromName = true
            break
          }
        }
        if (!mergedFromName) domainMap.set(domain, { ...r })
      }
      continue
    }

    // ── 2. No website — match against domain map by name ──────────────────
    let matchedDomain: string | null = null
    for (const [d, existing] of domainMap) {
      if (namesSimilar(nname, normName(existing.name))) {
        matchedDomain = d
        break
      }
    }
    if (matchedDomain) {
      domainMap.set(matchedDomain, mergeTwo(domainMap.get(matchedDomain)!, r))
      continue
    }

    // ── 3. Match / insert into nameMap ────────────────────────────────────
    let matchedName: string | null = null
    for (const [key] of nameMap) {
      if (namesSimilar(nname, key)) { matchedName = key; break }
    }
    if (matchedName) {
      nameMap.set(matchedName, mergeTwo(nameMap.get(matchedName)!, r))
    } else {
      nameMap.set(nname, { ...r })
    }
  }

  const all = [...domainMap.values(), ...nameMap.values()]
  console.log(
    `[EntityResolver] ${results.length} raw → ${all.length} unique entities` +
    ` (${domainMap.size} by domain, ${nameMap.size} by name)`
  )
  return all
}
