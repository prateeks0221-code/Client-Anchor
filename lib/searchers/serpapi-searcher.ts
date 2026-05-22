import { BaseSearcher } from './base'
import { RawResult } from '@/types'

// ── Known aggregator / job-board domains — never return these as company entities ──
const AGGREGATOR_BLOCKLIST = new Set([
  // Global job boards
  'indeed.com', 'naukri.com', 'linkedin.com', 'glassdoor.com',
  'timesjobs.com', 'shine.com', 'foundit.in', 'apna.co',
  'internshala.com', 'monster.com', 'simplyhired.com', 'ziprecruiter.com',
  'careerjet.com', 'totaljobs.com', 'reed.co.uk', 'cwjobs.co.uk',
  'techgig.com', 'instahyre.com', 'hirist.tech', 'freshersworld.com',
  'iimjobs.com', 'updazz.com', 'naukrigulf.com', 'bayt.com',
  'wellfound.com', 'angel.co', 'dice.com', 'careerbuilder.com',
  'snagajob.com', 'jobsearch.com', 'jobs.com', 'theladders.com',
  'remoteok.com', 'weworkremotely.com', 'remotive.io', 'workatastartup.com',
  // India-specific aggregators + classifieds
  'simplyhired.co.in', 'jobrapido.com', 'cutshort.io', 'weekday.works',
  'justdial.com', 'olx.in', 'quikr.com', 'sulekha.com', 'urbanpro.com',
  'glassdoor.co.in', 'in.indeed.com',
  // ATS platforms (apply links, not company sites)
  'greenhouse.io', 'lever.co', 'workable.com', 'breezy.hr',
  'smartrecruiters.com', 'recruitee.com', 'jobs.ashbyhq.com',
])

function isAggregator(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    // Exact match
    if (AGGREGATOR_BLOCKLIST.has(hostname)) return true
    // Subdomain match: "in.indeed.com" → check "indeed.com"
    for (const blocked of AGGREGATOR_BLOCKLIST) {
      if (hostname.endsWith('.' + blocked)) return true
    }
    return false
  } catch { return false }
}

function isJobQuery(query: string, filters: any): boolean {
  return (
    filters.opportunityType === 'job' ||
    /\b(job|jobs|role|position|hire|hiring|recruit|vacancy|vacancies|engineer|developer|analyst|manager|consultant)\b/i.test(query)
  )
}

export class SerpapiSearcher extends BaseSearcher {
  name = 'serpapi'

  async search(query: string, filters: any): Promise<RawResult[]> {
    const key = process.env.SERPAPI_KEY
    if (!key) { console.warn('SERPAPI_KEY missing'); return [] }

    try {
      const results: RawResult[] = []
      // Avoid double-appending location if query already mentions it
      const locLower = (filters.location || '').toLowerCase()
      const queryHasLoc = locLower && query.toLowerCase().includes(locLower)
      const loc = filters.location && !queryHasLoc ? ` ${filters.location}` : ''

      // ── Path A: Google Jobs engine — structured employer data ──────────────
      if (isJobQuery(query, filters)) {
        const jobResults = await this._searchGoogleJobs(query, filters, key)
        results.push(...jobResults)
      }

      // ── Path B: Organic search, aggregators stripped ───────────────────────
      const orgResults = await this._searchOrganic(query + loc, key)
      results.push(...orgResults)

      return results
    } catch (err) {
      console.error('SerpAPI error:', err)
      return []
    }
  }

  // ── Google Jobs engine: returns structured jobs with employer_name + link ──
  private async _searchGoogleJobs(query: string, filters: any, key: string): Promise<RawResult[]> {
    const loc = filters.location || ''
    const locLower = loc.toLowerCase()
    const queryHasLoc = locLower && query.toLowerCase().includes(locLower)
    const q = queryHasLoc ? query : `${query}${loc ? ' ' + loc : ''}`
    const params = new URLSearchParams({
      engine: 'google_jobs',
      q,
      api_key: key,
      hl: 'en',
    })
    if (loc) params.set('location', loc)

    const res = await this.fetchWithTimeout(
      `https://serpapi.com/search.json?${params}`,
      {},
      14000
    )
    if (!res.ok) return []
    const data = await res.json()

    // Extract unique COMPANIES from job listings — one entity per employer
    const companyMap = new Map<string, RawResult>()

    for (const j of (data.jobs_results || [])) {
      const companyName: string = j.company_name
      if (!companyName) continue

      const mapKey = companyName.toLowerCase().trim()
      if (companyMap.has(mapKey)) continue

      // Prefer direct company apply link over job board
      let website: string | undefined
      for (const opt of (j.apply_options || [])) {
        const link: string = opt.link || ''
        if (link && !isAggregator(link)) {
          website = link
          break
        }
      }

      // Thumbnail is often company logo domain
      const thumbDomain = j.thumbnail
        ? (() => { try { return new URL(j.thumbnail).hostname } catch { return undefined } })()
        : undefined

      // Build a search URL as last resort (not a job board link)
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(companyName + ' company website ' + (filters.location || ''))}`

      companyMap.set(mapKey, {
        name: companyName,
        type: 'business',
        description: `Hiring: ${j.title}. ${j.description?.substring(0, 400) || ''}`,
        website,
        address: j.location,
        city: filters.location || undefined,
        source: 'serpapi_jobs',
        sourceUrl: website || googleSearchUrl,
        rawData: {
          jobTitle: j.title,
          jobVia: j.via,
          extensions: j.extensions,
          thumbnail: j.thumbnail,
          thumbnailDomain: thumbDomain,
          applyOptions: (j.apply_options || []).map((o: any) => ({ title: o.title, link: o.link })),
          needsWebsiteResolution: !website,
        },
      })
    }

    return Array.from(companyMap.values())
  }

  // ── Standard organic search: strip job boards, keep actual company sites ──
  private async _searchOrganic(searchQuery: string, key: string): Promise<RawResult[]> {
    const params = new URLSearchParams({
      q: searchQuery,
      api_key: key,
      num: '20',
      hl: 'en',
    })

    const res = await this.fetchWithTimeout(
      `https://serpapi.com/search.json?${params}`,
      {},
      12000
    )
    if (!res.ok) return []
    const data = await res.json()

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
    const results: RawResult[] = []

    // Knowledge graph — highest confidence named entity
    const kg = data.knowledge_graph
    if (kg?.title) {
      results.push({
        name: kg.title,
        type: kg.type?.toLowerCase().includes('person') ? 'person' : 'corporation',
        description: kg.description,
        website: kg.website,
        phone: kg.phone,
        address: kg.address,
        source: 'serpapi',
        sourceUrl: kg.website || `https://google.com/search?q=${encodeURIComponent(kg.title)}`,
        rawData: {
          kgEntityType: kg.type,
          headquarters: kg.headquarters,
          founded: kg.founded,
          employees: kg.employees,
          ceo: kg.ceo,
          revenue: kg.revenue,
        },
      })
    }

    // Organic — skip any aggregators / job boards
    for (const r of (data.organic_results || []).slice(0, 15)) {
      if (!r.link || isAggregator(r.link)) continue
      const emails = (r.snippet?.match(emailRegex) || []) as string[]
      const phones = (r.snippet?.match(phoneRegex) || []) as string[]
      results.push({
        name: r.title,
        type: 'business',
        description: r.snippet,
        website: r.link,
        email: emails[0],
        phone: phones[0],
        source: 'serpapi',
        sourceUrl: r.link,
        rawData: {
          domain: r.displayed_link,
          position: r.position,
          favicon: r.favicon,
        },
      })
    }

    return results
  }
}
