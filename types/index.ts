export type SearchFilters = {
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  opportunityType?: "business" | "job" | "partnership";
  industries?: string[];
  workType?: string;
  roleLevel?: string;
  companySize?: string;
}

export interface RawResult {
  name: string;
  type: "business" | "corporation" | "job" | "person";
  description?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  source: string;
  sourceUrl?: string;
  rawData?: Record<string, any>;
}

export interface SearchRequest {
  prompt: string;
  intent?: "business" | "job" | "partnership" | null;
  filters?: SearchFilters;
}

export interface SearchResult {
  title: string;
  description: string;
  url: string;
  source: string;
  score: number;
  enrichment: Record<string, any>;
}

export interface SearchSession {
  id: string;
  userId: string;
  prompt: string;
  intent: string;
  results: SearchResult[];
  createdAt: Date;
}

// ── Dashboard types ──────────────────────────────────────────────────────────

export interface DashboardContact {
  id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  linkedin?: string | null;
  isPrimary: boolean;
}

export interface DashboardResult {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  score: number;
  matchReason?: string | null;
  enrichment: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    type?: string | null;
    [key: string]: unknown;
  };
  contacts: DashboardContact[];
}

export interface DashboardData {
  id: string;
  prompt: string;
  intent?: string | null;
  resultCount: number;
  avgScore: number;
  createdAt: string;
  results: DashboardResult[];
}
