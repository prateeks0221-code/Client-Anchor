import { BaseSearcher } from './base'
import { RawResult } from '@/types'

export class GooglePlacesSearcher extends BaseSearcher {
  name = 'google_places'

  async search(query: string, filters: any): Promise<RawResult[]> {
    const key = process.env.GOOGLE_PLACES_API_KEY
    if (!key || !filters.location) {
      console.warn(filters.location ? 'GOOGLE_PLACES_API_KEY missing' : 'Google Places: location required')
      return []
    }

    try {
      const textQuery = `${query} in ${filters.location}`

      const res = await this.fetchWithTimeout(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': [
              'places.displayName',
              'places.formattedAddress',
              'places.shortFormattedAddress',
              'places.websiteUri',
              'places.internationalPhoneNumber',
              'places.nationalPhoneNumber',
              'places.location',       // lat/lng
              'places.id',             // real place ID (ChIJ...)
              'places.rating',
              'places.userRatingCount',
              'places.businessStatus',
              'places.primaryTypeDisplayName',
            ].join(','),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ textQuery, maxResultCount: 20 }),
        },
        12000
      )

      if (!res.ok) return []
      const data = await res.json()

      return (data.places || []).map((p: any) => {
        const lat: number | undefined = p.location?.latitude
        const lng: number | undefined = p.location?.longitude
        const placeId: string | undefined = p.id          // e.g. ChIJN1t_tDeuEmsRUsoyG83frY4

        // Proper Maps URL: pinned marker at exact place
        const mapsUrl = placeId
          ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
          : lat && lng
          ? `https://maps.google.com/?q=${lat},${lng}`
          : undefined

        return {
          name: p.displayName?.text || 'Unnamed',
          type: 'business' as const,
          description: p.shortFormattedAddress || p.formattedAddress,
          website: p.websiteUri,
          phone: p.internationalPhoneNumber || p.nationalPhoneNumber,
          address: p.formattedAddress,
          source: 'google_places',
          sourceUrl: p.websiteUri || mapsUrl,
          rawData: {
            placeId,
            lat,
            lng,
            mapsUrl,
            rating: p.rating,
            userRatingCount: p.userRatingCount,
            businessStatus: p.businessStatus,              // OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
            category: p.primaryTypeDisplayName?.text,
          },
        }
      })
    } catch (err) {
      console.error('Google Places error:', err)
      return []
    }
  }
}
