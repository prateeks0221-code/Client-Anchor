export const SOURCE_CONFIG = {
  serpapi: {
    enabled: true,
    maxResults: 20,
    timeout: 10000,
  },
  googlePlaces: {
    enabled: true,
    maxResults: 20,
    timeout: 10000,
  },
  adzuna: {
    enabled: true,
    maxResults: 20,
    timeout: 10000,
  },
  hunter: {
    enabled: true,
    maxResults: 5,
    timeout: 8000,
  },
};

export function getApiKey(name: string): string | undefined {
  const map: Record<string, string> = {
    serpapi: process.env.SERPAPI_KEY!,
    googlePlaces: process.env.GOOGLE_PLACES_API_KEY!,
    adzuna: process.env.ADZUNA_API_KEY!,
    hunter: process.env.HUNTER_API_KEY!,
  };
  return map[name];
}
