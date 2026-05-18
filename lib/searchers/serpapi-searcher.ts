import { BaseSearcher } from './base'
import { RawResult } from '@/types'

export class SerpapiSearcher extends BaseSearcher {
  name = 'serpapi'

  async search(query: string, filters: any): Promise<RawResult[]> {
    const key = process.env.SERPAPI_KEY
    if (!key) {
      console.warn('SERPAPI_KEY missing')
      return []
    }

    try {
      const searchQuery = query + (filters.location ? ` ${filters.location}` : '')
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

      // Organic results
      for (const r of (data.organic_results || []).slice(0, 15)) {
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

      // Knowledge graph (if present) — richer single entity
      const kg = data.knowledge_graph
      if (kg?.title) {
        results.unshift({
          name: kg.title,
          type: kg.type?.toLowerCase().includes('person') ? 'person' : 'business',
          description: kg.description,
          website: kg.website,
          phone: kg.phone,
          address: kg.address,
          source: 'serpapi',
          sourceUrl: kg.website || `https://www.google.com/search?q=${encodeURIComponent(kg.title)}`,
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

      return results
    } catch (err) {
      console.error('SerpAPI error:', err)
      return []
    }
  }
}
