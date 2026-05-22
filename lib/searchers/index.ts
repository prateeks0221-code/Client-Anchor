import { SerpapiSearcher } from './serpapi-searcher'
import { GooglePlacesSearcher } from './google-places-searcher'
import { AdzunaSearcher } from './adzuna-searcher'
import { JSearchSearcher } from './jsearch-searcher'
import { enrichWithApollo } from './apollo-searcher'
import { resolveEntities } from '../entity-resolver'
import { RawResult } from '@/types'

const searchers = [
  new SerpapiSearcher(),         // web + Google Jobs engine
  new GooglePlacesSearcher(),    // local physical businesses
  new JSearchSearcher(),         // structured job data → employer extraction
  new AdzunaSearcher(),          // job market → employer extraction
]

export async function runAllSearchers(
  query: string,
  filters: any
): Promise<RawResult[]> {
  // 1. Run all searchers in parallel
  const promises = searchers.map(s =>
    s.search(query, filters).catch(e => {
      console.error(`[${s.name}] failed:`, e instanceof Error ? e.message : String(e))
      return [] as RawResult[]
    })
  )

  const settled = await Promise.allSettled(promises)
  const allResults: RawResult[] = []

  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`[${searchers[i].name}] returned ${r.value.length} results`)
      allResults.push(...r.value)
    }
  })

  console.log(`[Searchers] ${allResults.length} raw results → entity resolution`)

  // 2. Merge duplicates across sources
  const resolved = resolveEntities(allResults)

  // 3. Apollo enrichment — adds LinkedIn, industry, employees to resolved entities
  const enriched = await enrichWithApollo(resolved)

  console.log(`[Searchers] ${enriched.length} final entities ready`)

  return enriched
}
