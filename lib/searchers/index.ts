import { SerpapiSearcher } from './serpapi-searcher'
import { GooglePlacesSearcher } from './google-places-searcher'
import { AdzunaSearcher } from './adzuna-searcher'
import { RawResult } from '@/types'

const searchers = [
  new SerpapiSearcher(),
  new GooglePlacesSearcher(),
  new AdzunaSearcher(),
]

export async function runAllSearchers(
  query: string,
  filters: any
): Promise<RawResult[]> {
  const promises = searchers.map(s =>
    s.search(query, filters).catch(e => {
      console.error(`${s.name} failed:`, e)
      return []
    })
  )

  const results = await Promise.allSettled(promises)
  const allResults: RawResult[] = []

  results.forEach(r => {
    if (r.status === 'fulfilled') {
      allResults.push(...r.value)
    }
  })

  // Deduplicate by name + website domain
  const seen = new Map<string, RawResult>()

  allResults.forEach(r => {
    const domain = r.website ? new URL(r.website).hostname : ''
    const key = `${r.name}|${domain}`

    if (!seen.has(key)) {
      seen.set(key, r)
    }
  })

  return Array.from(seen.values())
}
