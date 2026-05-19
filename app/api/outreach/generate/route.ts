import { NextRequest, NextResponse } from 'next/server'

// ── Free-tier LLM config ──────────────────────────────────────────────────────
// Priority: Groq (fastest free) → OpenRouter free → HuggingFace
const GROQ_KEY = process.env.GROQ_API_KEY
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY

interface GeneratePayload {
  segment: 'pas' | 'partnership' | 'job' | 'custom'
  companyName: string
  companyFacts: string        // free-form intel: industry, news, tech stack, hiring
  senderName: string
  senderRole?: string
  senderCompany?: string
  targetFirstName?: string
  temperature?: number        // 0.3–0.7
  seed?: number               // variation seed for uniqueness
  extraContext?: string       // any extra user-provided context
}

// ── Segment system prompts ─────────────────────────────────────────────────────

const SEGMENT_PROMPTS: Record<string, string> = {
  pas: `You are a B2B cold email specialist writing a PAS (Problem-Agitation-Solution) email.
Tone: Clinical, diagnostic, authoritative — like a doctor presenting a diagnosis.
Structure: (1) Identify a specific pain point the company likely faces, (2) Agitate the cost of inaction with a concrete consequence, (3) Present the sender as the precise remedy.
Rules:
- Weave 2–3 company-specific facts naturally into the email body (NOT mad-libs — contextual synthesis)
- Place the company reference in the allegation: "[Company]'s current approach likely costs them..."
- End with: "Here's exactly how [Company] eliminates this in [timeframe]."
- 50–120 words total body. No fluff. No "I hope this finds you well."
- Spam words FORBIDDEN: guaranteed, free, act now, limited time, no obligation, winner, congratulations`,

  partnership: `You are a strategic partnerships writer crafting a warm, mutually-beneficial outreach email.
Tone: Collaborative, peer-to-peer, respectful of their business.
Structure: (1) Open with shared market/audience overlap, (2) State complementary strengths, (3) Propose a concrete joint value proposition.
Rules:
- Weave 2–3 company-specific facts naturally — place the reference in the value proposition
- End with: "A [Company]–[SenderCompany] integration would unlock [specific metric] for both sides."
- 50–120 words. Sound like a founder-to-founder message, not a sales pitch.
- No buzzwords: synergy, leverage, circle back, bandwidth`,

  job: `You are writing a job interest / talent acquisition outreach email.
Tone: Aspirational, research-backed, value-aligned — passionate but professional.
Structure: (1) Open with genuine, research-backed admiration for the company's specific trajectory, (2) Connect your expertise to their specific initiative, (3) Propose a concrete contribution.
Rules:
- Weave 2–3 company-specific facts naturally — place the reference in the alignment statement
- End with: "I'd like to explore how my [expertise] could accelerate [Company]'s [initiative]."
- 60–130 words. Sound like a peer reaching out, not a job applicant begging.
- No clichés: passionate team player, go-getter, results-driven`,

  custom: `You are writing a custom cold outreach email. Match the tone and structure implied by the context provided.
Rules:
- Keep it between 50–130 words
- Be specific to the company using the facts provided
- No spam words, no clichés`,
}

// ── Build LLM user prompt ──────────────────────────────────────────────────────

function buildUserPrompt(p: GeneratePayload, variantNumber: number): string {
  const recipientLine = p.targetFirstName ? `Recipient first name: ${p.targetFirstName}` : 'Use "Hi there" if no first name.'

  return `Write cold outreach email variant #${variantNumber} (make it distinct from other variants).

SENDER INFO:
- Name: ${p.senderName}
- Role: ${p.senderRole || 'not specified'}
- Company: ${p.senderCompany || 'not specified'}

TARGET COMPANY:
- Name: ${p.companyName}
- Known facts: ${p.companyFacts || 'no specific facts — make reasonable inferences from the company name'}

${recipientLine}
${p.extraContext ? `Extra context: ${p.extraContext}` : ''}
Variation seed: ${p.seed ?? Math.floor(Math.random() * 10000)}

Output format — return ONLY this JSON, no markdown:
{
  "subject": "email subject line",
  "body": "full email body with greeting and sender name signed off, plain text"
}`
}

// ── JSON extractor — LLMs often return malformed JSON ────────────────────────
// Common failures:
//  1. Wrapped in ```json ... ``` fences
//  2. Literal newlines inside string values (JSON spec requires \n)

function sanitizeJsonStrings(json: string): string {
  // Replace literal newlines/carriage-returns inside quoted string values.
  // Regex: match any "quoted string" including those spanning multiple lines.
  // [^"\\] = not a quote, not a backslash
  // \\. = escaped character (skip over it)
  // Use [\s\S] instead of . with /s flag — compatible with ES2017 targets
  return json.replace(/"(?:[^"\\]|\\[\s\S])*"/g, (match) =>
    match
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
  )
}

function extractJson(raw: string): { subject: string; body: string } {
  if (!raw) throw new Error('Empty LLM response')

  // Step 1: Strip markdown code fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const stripped = fenceMatch ? fenceMatch[1].trim() : raw.trim()

  // Step 2: Try direct parse
  try {
    return JSON.parse(stripped)
  } catch { /* fall through */ }

  // Step 3: Sanitize literal newlines in string values, then re-parse
  try {
    return JSON.parse(sanitizeJsonStrings(stripped))
  } catch { /* fall through */ }

  // Step 4: Extract first {...} block and sanitize
  const braceMatch = stripped.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try {
      return JSON.parse(sanitizeJsonStrings(braceMatch[0]))
    } catch { /* fall through */ }
  }

  throw new Error(`Could not parse LLM output as JSON. Raw: ${stripped.slice(0, 300)}`)
}

// ── LLM callers ───────────────────────────────────────────────────────────────

async function callGroq(systemPrompt: string, userPrompt: string, temperature: number): Promise<{ subject: string; body: string }> {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY not set')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: Math.max(0.1, Math.min(1.0, temperature)),
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  console.log('[Generate/Groq] raw content:', content.slice(0, 300))
  return extractJson(content)
}

async function callOpenRouter(systemPrompt: string, userPrompt: string, temperature: number): Promise<{ subject: string; body: string }> {
  if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://clientanchor.app',
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-v4-flash:free',  // reliable free model on OpenRouter
      temperature: Math.max(0.1, Math.min(1.0, temperature)),
      max_tokens: 500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''
  console.log('[Generate/OpenRouter] raw content:', content.slice(0, 300))
  return extractJson(content)
}

// ── Spam word detector ────────────────────────────────────────────────────────

const SPAM_WORDS = [
  'guaranteed', 'free', 'act now', 'limited time', 'no obligation',
  'winner', 'congratulations', 'click here', 'earn money', 'make money',
  'work from home', 'risk-free', 'special offer', 'urgent', 'deal',
]

function detectSpamWords(text: string): string[] {
  const lower = text.toLowerCase()
  return SPAM_WORDS.filter(w => lower.includes(w))
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let payload: GeneratePayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { segment, companyName, temperature = 0.5 } = payload

  if (!segment || !companyName) {
    return NextResponse.json({ error: 'segment and companyName required' }, { status: 422 })
  }

  // Validate keys early — surface clear message to UI
  if (!GROQ_KEY && !OPENROUTER_KEY) {
    return NextResponse.json(
      { error: 'No AI key configured. Add GROQ_API_KEY or OPENROUTER_API_KEY to .env.local and restart.' },
      { status: 503 }
    )
  }

  console.log(`[Generate] segment=${segment} company="${companyName}" groq=${!!GROQ_KEY} openrouter=${!!OPENROUTER_KEY}`)

  const systemPrompt = SEGMENT_PROMPTS[segment] ?? SEGMENT_PROMPTS.custom

  // Generate 3 variants (A, B, C) — sequential to avoid rate limiting
  const variants: Array<{ subject: string; body: string; spamFlags: string[]; wordCount: number }> = []
  const errors: string[] = []

  for (let i = 1; i <= 3; i++) {
    const userPrompt = buildUserPrompt({ ...payload, seed: (payload.seed ?? Date.now()) + i * 17 }, i)

    try {
      // Try Groq first, fall back to OpenRouter
      let result: { subject: string; body: string }
      try {
        result = await callGroq(systemPrompt, userPrompt, temperature + (i - 2) * 0.05)
        console.log(`[Generate] Variant ${i} OK via Groq`)
      } catch (groqErr) {
        const groqMsg = (groqErr as Error).message
        const groqStack = (groqErr as Error).stack?.slice(0, 300) ?? ''
        console.warn(`[Generate] Variant ${i} Groq FAILED: ${groqMsg}\nStack: ${groqStack}`)
        result = await callOpenRouter(systemPrompt, userPrompt, temperature + (i - 2) * 0.05)
        console.log(`[Generate] Variant ${i} OK via OpenRouter`)
      }

      variants.push({
        subject: result.subject ?? '',
        body: result.body ?? '',
        spamFlags: detectSpamWords((result.subject ?? '') + ' ' + (result.body ?? '')),
        wordCount: (result.body ?? '').trim().split(/\s+/).length,
      })
    } catch (err) {
      const msg = (err as Error).message
      console.error(`[Generate] Variant ${i} both providers failed: ${msg}`)
      errors.push(`Variant ${i}: ${msg}`)
    }
  }

  if (variants.length === 0) {
    // Surface first real error so UI shows something actionable
    const firstError = errors[0] ?? 'Unknown error'
    return NextResponse.json(
      { error: firstError, details: errors },
      { status: 502 }
    )
  }

  return NextResponse.json({ variants, partial: errors.length > 0, errors })
}
