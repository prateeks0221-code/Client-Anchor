export interface EmailTemplate {
  name: string
  approachType: 'pas' | 'partnership' | 'job' | 'custom'
  segment: 1 | 2 | 3 | 4
  description: string  // shown in segment selector
  toneLabel: string    // e.g. "Diagnostic & Urgent"
  defaultTemperature: number  // 0.3–0.7
  subject: string
  body: string
  variables: string[]
  closingHook: string  // shown as tooltip
}

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    name: 'PAS — Direct Value',
    approachType: 'pas',
    segment: 1,
    description: 'Identify pain → validate severity → present remedy',
    toneLabel: 'Diagnostic & Urgent',
    defaultTemperature: 0.4,
    closingHook: "Here's exactly how {{company}} eliminates this in {{timeframe}}",
    subject: '{{pain_point}} at {{company}}?',
    body: `Hi {{first_name}},

Most {{industry}} companies struggle with {{pain_point}}. Left unaddressed, it costs them {{cost_of_inaction}}.

We fixed this for {{similar_company}} — {{result}}.

Here's exactly how {{company}} eliminates this in {{timeframe}}.

Worth 15 minutes?

{{my_name}}`,
    variables: ['company', 'first_name', 'industry', 'pain_point', 'cost_of_inaction', 'similar_company', 'result', 'timeframe', 'my_name'],
  },
  {
    name: 'Partnership',
    approachType: 'partnership',
    segment: 2,
    description: 'Shared audience overlap → joint value proposition',
    toneLabel: 'Collaborative & Strategic',
    defaultTemperature: 0.5,
    closingHook: 'A {{company}}–{{my_company}} integration would unlock {{metric}} for both sides',
    subject: 'Partnership idea: {{company}} × {{my_company}}',
    body: `Hi {{first_name}},

{{company}} and {{my_company}} serve overlapping audiences in {{collaboration_area}}.

A {{company}}–{{my_company}} integration would unlock {{metric}} for both sides — I have a concrete idea on what this could look like.

Open to a quick call this week?

{{my_name}}`,
    variables: ['company', 'first_name', 'my_company', 'collaboration_area', 'metric', 'my_name'],
  },
  {
    name: 'Job Interest',
    approachType: 'job',
    segment: 3,
    description: 'Research-backed admiration → skill fit → contribution proposal',
    toneLabel: 'Aspirational & Value-Aligned',
    defaultTemperature: 0.6,
    closingHook: "I'd like to explore how my {{expertise}} could accelerate {{company}}'s {{initiative}}",
    subject: "Excited about {{company}}'s work in {{initiative}}",
    body: `Hi {{first_name}},

I've been following {{company}}'s push into {{initiative}} — {{specific_admiration}}.

My background in {{expertise}} maps directly to what you're building. I'd like to explore how I could accelerate {{company}}'s {{initiative}}.

Is there room for a conversation?

{{my_name}}`,
    variables: ['company', 'first_name', 'initiative', 'specific_admiration', 'expertise', 'my_name'],
  },
  {
    name: 'Custom',
    approachType: 'custom',
    segment: 4,
    description: 'User-defined segment — write your own structure',
    toneLabel: 'Custom',
    defaultTemperature: 0.5,
    closingHook: 'Define your own closing hook',
    subject: '{{subject_line}}',
    body: `Hi {{first_name}},

{{opening}}

{{body_paragraph}}

{{closing}}

{{my_name}}`,
    variables: ['subject_line', 'first_name', 'opening', 'body_paragraph', 'closing', 'my_name'],
  },
]

/** Replace all {{var}} tokens in a string with values map. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/** Extract all {{var}} tokens from a string. */
export function extractVars(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]
}

/** Auto-seed variable values from result data. */
export function seedVarsFromResult(result: {
  title: string
  enrichment: Record<string, unknown>
  contacts: Array<{ name: string; email?: string | null; title?: string | null }>
}): Record<string, string> {
  const e = result.enrichment
  const primary = result.contacts?.[0]
  const firstName = primary?.name?.split(' ')[0] || ''

  const company =
    (e.company as string) ||                // job enrichment
    (result.title ?? '')                     // business/corp name IS the company

  return {
    company,
    first_name: firstName,
    industry: (e.category as string) || (e.type as string) || '',
    my_name: '',                             // user fills
    my_company: '',                          // user fills
    value_prop: '',
    company_activity: (e.businessStatus as string) === 'OPERATIONAL' ? 'actively operating' : '',
    target_profile: '',
    benefit: '',
    pain_point: '',
    cost_of_inaction: '',
    similar_company: '',
    result: '',
    collaboration_area: '',
  }
}
