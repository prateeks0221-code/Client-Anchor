import { BaseSearcher } from './base'
import { RawResult } from '@/types'

function detectCountry(location: string): string {
  const loc = location.toLowerCase()
  if (/india|noida|delhi|mumbai|bangalore|bengaluru|pune|hyderabad|chennai|kolkata|gurgaon|gurugram/.test(loc)) return 'in'
  if (/\bus\b|united states|usa|new york|san francisco|chicago|seattle|austin/.test(loc)) return 'us'
  if (/australia|sydney|melbourne/.test(loc)) return 'au'
  if (/canada|toronto|vancouver|montreal/.test(loc)) return 'ca'
  return 'gb'
}

export class AdzunaSearcher extends BaseSearcher {
  name = 'adzuna'

  async search(query: string, filters: any): Promise<RawResult[]> {
    const key = process.env.ADZUNA_API_KEY
    const appId = process.env.ADZUNA_APP_ID || '4f2dd3b3'
    if (!key) { console.warn('ADZUNA_API_KEY missing'); return [] }

    const isJob =
      filters.opportunityType === 'job' ||
      /\b(job|jobs|role|position|hire|hiring|recruit|engineer|developer|analyst|manager|consultant)\b/i.test(query)
    if (!isJob) return []

    try {
      const country = detectCountry(filters.location || '')

      const params = new URLSearchParams({
        app_id: appId,
        app_key: key,
        what: query,
        where: filters.location || '',
        results_per_page: '50', // fetch more to surface more unique companies
        sort_by: 'relevance',
      })

      const res = await this.fetchWithTimeout(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
        {},
        12000
      )
      if (!res.ok) return []
      const data = await res.json()

      // ── Extract unique COMPANIES from job listings ─────────────────────────
      // Company is the entity we care about; the job is just evidence of activity.
      const companyMap = new Map<string, {
        name: string
        jobs: any[]
        salaries: number[]
        locations: Set<string>
      }>()

      for (const j of (data.results || [])) {
        const companyName: string | undefined = j.company?.display_name
        if (!companyName || companyName.trim().length < 2) continue

        const mapKey = companyName.toLowerCase().trim()
        if (!companyMap.has(mapKey)) {
          companyMap.set(mapKey, {
            name: companyName.trim(),
            jobs: [],
            salaries: [],
            locations: new Set(),
          })
        }
        const entry = companyMap.get(mapKey)!
        entry.jobs.push(j)
        if (j.salary_min) entry.salaries.push(j.salary_min)
        if (j.location?.display_name) entry.locations.add(j.location.display_name)
      }

      const results: RawResult[] = []

      for (const [, co] of companyMap) {
        const rep = co.jobs[0]                 // representative job
        const avgSalary = co.salaries.length
          ? Math.round(co.salaries.reduce((a, b) => a + b, 0) / co.salaries.length)
          : undefined
        const jobTitles = [...new Set(co.jobs.map((j: any) => j.title as string))]
          .slice(0, 5)

        results.push({
          name: co.name,
          type: 'business',
          description: `Actively hiring: ${jobTitles.slice(0, 3).join(', ')}. ${rep.description?.substring(0, 300) || ''}`,
          address: rep.location?.display_name,
          city: filters.location || undefined,
          source: 'adzuna',
          sourceUrl: rep.redirect_url,   // Adzuna apply page (best we have without website)
          rawData: {
            openRoleCount: co.jobs.length,
            openRoles: jobTitles,
            avgSalary,
            contractType: rep.contract_type,
            contractTime: rep.contract_time,
            category: rep.category?.label,
            locations: Array.from(co.locations),
            applyUrls: co.jobs.map((j: any) => j.redirect_url as string).slice(0, 5),
          },
        })
      }

      return results
    } catch (err) {
      console.error('Adzuna error:', err)
      return []
    }
  }
}
