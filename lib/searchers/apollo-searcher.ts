import { RawResult } from '@/types'

/**
 * Apollo.io enrichment layer.
 *
 * Free tier only allows `/v1/organizations/enrich` (by domain), NOT search.
 * So Apollo runs as a POST-PROCESSING enrichment step:
 *   given domains already discovered by other searchers, enrich each with
 *   LinkedIn URL, industry, employee count, phone, tech stack, etc.
 *
 * Env: APOLLO_API_KEY
 */

export async function enrichWithApollo(results: RawResult[]): Promise<RawResult[]> {
  const key = process.env.APOLLO_API_KEY
  if (!key) return results

  // Collect unique domains to enrich (skip results without website)
  const domainMap = new Map<string, number[]>()  // domain → indices in results array

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (!r.website) continue
    try {
      const domain = new URL(r.website).hostname.replace(/^www\./, '')
      if (!domain || domain === 'google.com') continue
      if (!domainMap.has(domain)) domainMap.set(domain, [])
      domainMap.get(domain)!.push(i)
    } catch { /* skip invalid URLs */ }
  }

  // Limit to 15 enrichments per search (free tier has daily limits)
  const domains = Array.from(domainMap.keys()).slice(0, 15)

  console.log(`[Apollo] Enriching ${domains.length} domains`)

  // Run enrichments in parallel (batches of 5 to respect rate limits)
  const enriched = [...results]

  for (let batch = 0; batch < domains.length; batch += 5) {
    const batchDomains = domains.slice(batch, batch + 5)

    const promises = batchDomains.map(async (domain) => {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000)

        const res = await fetch(
          `https://api.apollo.io/api/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`,
          {
            headers: { 'X-Api-Key': key },
            signal: controller.signal,
          }
        )
        clearTimeout(timer)

        if (!res.ok) return null

        const data = await res.json()
        const org = data.organization
        if (!org) return null

        return { domain, org }
      } catch (e) {
        console.warn(`[Apollo] ${domain} failed:`, (e as Error).message)
        return null
      }
    })

    const batchResults = await Promise.all(promises)

    for (const item of batchResults) {
      if (!item) continue
      const { domain, org } = item
      const indices = domainMap.get(domain)
      if (!indices) continue

      for (const idx of indices) {
        const r = enriched[idx]

        // Merge Apollo data into existing result
        enriched[idx] = {
          ...r,
          phone: r.phone || org.primary_phone?.number || undefined,
          linkedinUrl: r.linkedinUrl || org.linkedin_url || undefined,
          rawData: {
            ...(r.rawData || {}),
            linkedinUrl: r.rawData?.linkedinUrl || org.linkedin_url || undefined,
            industry: r.rawData?.industry || org.industry || undefined,
            subIndustry: r.rawData?.subIndustry || org.subindustry || undefined,
            employees: r.rawData?.employees || org.estimated_num_employees || undefined,
            employeeRange: r.rawData?.employeeRange || org.employee_count || undefined,
            fundingTotal: r.rawData?.fundingTotal || org.total_funding || undefined,
            fundingStage: r.rawData?.fundingStage || org.latest_funding_stage || undefined,
            technologies: r.rawData?.technologies || (org.current_technologies || [])
              .map((t: any) => t.name as string).filter(Boolean).slice(0, 8),
            twitterUrl: r.rawData?.twitterUrl || org.twitter_url || undefined,
            facebookUrl: r.rawData?.facebookUrl || org.facebook_url || undefined,
            logoUrl: r.rawData?.logoUrl || org.logo_url || undefined,
            shortDescription: r.rawData?.shortDescription || org.short_description || undefined,
            foundedYear: org.founded_year || undefined,
            apolloEnriched: true,
          },
        }
      }
    }
  }

  const enrichedCount = enriched.filter(r => r.rawData?.apolloEnriched).length
  console.log(`[Apollo] Enriched ${enrichedCount}/${results.length} results`)

  return enriched
}
