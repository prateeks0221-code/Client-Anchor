import { BaseSearcher } from './base'
import { RawResult } from '@/types'

export class AdzunaSearcher extends BaseSearcher {
  name = 'adzuna'

  async search(query: string, filters: any): Promise<RawResult[]> {
    const key = process.env.ADZUNA_API_KEY
    const appId = process.env.ADZUNA_APP_ID || '4f2dd3b3'
    if (!key) {
      console.warn('ADZUNA_API_KEY missing')
      return []
    }

    // Only run for job searches
    const isJob =
      filters.opportunityType === 'job' ||
      /job|role|position|hire|recruit|engineer|developer|analyst|manager/i.test(query)
    if (!isJob) return []

    try {
      // Detect country from location (default gb)
      const loc = (filters.location || '').toLowerCase()
      const country =
        loc.includes('india') || loc.includes(' in') ? 'in' :
        loc.includes('us') || loc.includes('united states') || loc.includes('usa') ? 'us' :
        loc.includes('au') || loc.includes('australia') ? 'au' :
        loc.includes('ca') || loc.includes('canada') ? 'ca' :
        'gb'

      const params = new URLSearchParams({
        app_id: appId,
        app_key: key,
        what: query,
        where: filters.location || '',
        results_per_page: '20',
        sort_by: 'relevance',
      })

      if (filters.workType) {
        params.set('full_time', filters.workType === 'remote' || filters.workType === 'hybrid' ? '0' : '1')
      }

      const res = await this.fetchWithTimeout(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
        {},
        12000
      )

      if (!res.ok) return []
      const data = await res.json()

      return (data.results || []).map((j: any) => {
        const salaryMin: number | undefined = j.salary_min
        const salaryMax: number | undefined = j.salary_max
        const companyName: string | undefined = j.company?.display_name

        return {
          name: j.title,
          type: 'job' as const,
          description: j.description?.substring(0, 600),
          website: undefined,           // company website not available from Adzuna
          address: j.location?.display_name,
          source: 'adzuna',
          sourceUrl: j.redirect_url,    // = apply URL
          rawData: {
            company: companyName,
            applyUrl: j.redirect_url,
            salaryMin,
            salaryMax,
            salaryIsPredicted: j.salary_is_predicted === '1',
            contractType: j.contract_type,        // permanent | contract
            contractTime: j.contract_time,        // full_time | part_time
            posted: j.created,
            category: j.category?.label,
            locationArea: j.location?.area?.join(', '),
          },
        }
      })
    } catch (err) {
      console.error('Adzuna error:', err)
      return []
    }
  }
}
