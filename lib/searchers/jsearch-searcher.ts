import { BaseSearcher } from './base'
import { RawResult } from '@/types'

/**
 * JSearch by RapidAPI — structured job search with employer data.
 *
 * Unlike raw job board scraping, JSearch returns typed JSON with:
 *   employer_name, employer_website, employer_linkedin, employer_logo
 *
 * We use it to extract COMPANIES (employers), not job listings.
 * Excellent for India job market (Noida/Delhi/Bangalore etc.).
 *
 * Env: RAPIDAPI_KEY
 * API: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 * Free tier: 200 requests/month
 */

const JOB_BOARD_DOMAINS = new Set([
  'indeed.com', 'naukri.com', 'linkedin.com', 'glassdoor.com',
  'timesjobs.com', 'shine.com', 'foundit.in', 'monster.com',
  'simplyhired.com', 'ziprecruiter.com', 'careerjet.com',
  'techgig.com', 'instahyre.com', 'freshersworld.com',
])

function isJobBoard(url?: string): boolean {
  if (!url) return false
  try {
    return JOB_BOARD_DOMAINS.has(new URL(url).hostname.replace(/^www\./, ''))
  } catch { return false }
}

function isJobQuery(query: string, filters: any): boolean {
  if (filters.opportunityType === 'job') return true
  if (filters.opportunityType === 'business' || filters.opportunityType === 'partnership') return false
  // Heuristic for untyped queries
  return /\b(job|jobs|role|hire|hiring|recruit|engineer|developer|analyst|manager|consultant|cv)\b/i.test(query)
}

export class JSearchSearcher extends BaseSearcher {
  name = 'jsearch'

  async search(query: string, filters: any): Promise<RawResult[]> {
    const key = process.env.RAPIDAPI_KEY
    if (!key) { console.warn('RAPIDAPI_KEY missing — skipping JSearch'); return [] }

    if (!isJobQuery(query, filters)) return []

    try {
      // Avoid double-appending location if query already mentions it
      const locLower = (filters.location || '').toLowerCase()
      const queryHasLocation = locLower && query.toLowerCase().includes(locLower)
      const searchQuery = filters.location && !queryHasLocation
        ? `${query} in ${filters.location}`
        : query

      const params = new URLSearchParams({
        query: searchQuery,
        page: '1',
        num_pages: '1',   // keep to 1 page on free tier (rate limits + speed)
        date_posted: 'month',
      })
      if (filters.workType) {
        const typeMap: Record<string, string> = {
          remote: 'FULLTIME,PARTTIME',
          hybrid: 'FULLTIME,PARTTIME',
          onsite: 'FULLTIME,PARTTIME',
        }
        params.set('employment_types', typeMap[filters.workType] || 'FULLTIME')
      }

      const res = await this.fetchWithTimeout(
        `https://jsearch.p.rapidapi.com/search?${params}`,
        {
          headers: {
            'X-RapidAPI-Key': key,
            'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
          },
        },
        20000
      )

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.warn(`JSearch ${res.status}:`, body.slice(0, 200))
        return []
      }

      const data = await res.json()

      // Extract unique EMPLOYERS — deduplicate by company name
      const companyMap = new Map<string, {
        result: RawResult
        roles: string[]
        minSalary?: number
        maxSalary?: number
      }>()

      for (const j of (data.data || [])) {
        const employerName: string = j.employer_name
        if (!employerName) continue

        const mapKey = employerName.toLowerCase().trim()

        if (companyMap.has(mapKey)) {
          // Accumulate open roles for existing entry
          const entry = companyMap.get(mapKey)!
          if (j.job_title && !entry.roles.includes(j.job_title)) {
            entry.roles.push(j.job_title)
            entry.result.rawData!.openRoles = entry.roles.slice(0, 8)
            entry.result.rawData!.openRoleCount = entry.roles.length
          }
          continue
        }

        // Website: prefer direct company site over job board
        const rawWebsite: string | undefined = j.employer_website
        const website = rawWebsite && !isJobBoard(rawWebsite) ? rawWebsite : undefined

        // Apply link: use if it's a direct company careers page
        const applyLink: string | undefined = j.job_apply_link
        const directApply = applyLink && !isJobBoard(applyLink) ? applyLink : undefined

        const linkedinUrl: string | undefined = j.employer_linkedin || undefined

        companyMap.set(mapKey, {
          result: {
            name: employerName,
            type: 'business',
            description: `Hiring: ${j.job_title}. ${j.job_description?.substring(0, 400) || ''}`,
            website: website || directApply,
            city: j.job_city || filters.location || undefined,
            country: j.job_country || undefined,
            source: 'jsearch',
            sourceUrl: website || applyLink,
            linkedinUrl,
            rawData: {
              employerLogo: j.employer_logo,
              openRoles: [j.job_title].filter(Boolean),
              openRoleCount: 1,
              jobType: j.job_employment_type,
              isRemote: j.job_is_remote,
              salaryMin: j.job_min_salary,
              salaryMax: j.job_max_salary,
              salaryCurrency: j.job_salary_currency,
              posted: j.job_posted_at_datetime_utc,
              qualifications: (j.job_required_skills || []).slice(0, 6),
              highlights: j.job_highlights?.Qualifications?.slice(0, 3),
              applyLink,
            },
          },
          roles: [j.job_title].filter(Boolean),
        })
      }

      return Array.from(companyMap.values()).map(e => e.result)
    } catch (err) {
      console.error('JSearch error:', err)
      return []
    }
  }
}
