import { RawResult } from '@/types'

export abstract class BaseSearcher {
  abstract name: string
  abstract search(query: string, filters: any): Promise<RawResult[]>
  
  protected async fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 10000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), ms)
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal })
      clearTimeout(id)
      return res
    } catch (e) {
      clearTimeout(id)
      throw e
    }
  }
}
