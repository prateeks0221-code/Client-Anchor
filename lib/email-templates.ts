export interface EmailTemplate {
  name: string
  approachType: 'direct' | 'pas' | 'partnership'
  subject: string
  body: string
  variables: string[]
}

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    name: 'Direct Value',
    approachType: 'direct',
    subject: 'Quick win for {{company}} — {{value_prop}}',
    body: `Hi {{first_name}},

I noticed {{company}} is {{company_activity}}. We help {{target_profile}} {{benefit}}.

Worth a brief chat?

Best,
{{my_name}}`,
    variables: ['company', 'first_name', 'company_activity', 'target_profile', 'benefit', 'my_name', 'value_prop'],
  },
  {
    name: 'Problem-Agitation-Solution',
    approachType: 'pas',
    subject: '{{pain_point}} at {{company}}?',
    body: `Hi {{first_name}},

Most {{industry}} companies struggle with {{pain_point}}. It usually costs them {{cost_of_inaction}}.

We solved this for {{similar_company}} and {{result}}.

Open to seeing how it applies to {{company}}?

{{my_name}}`,
    variables: ['company', 'first_name', 'industry', 'pain_point', 'cost_of_inaction', 'similar_company', 'result', 'my_name'],
  },
  {
    name: 'Partnership',
    approachType: 'partnership',
    subject: 'Partnership idea: {{company}} × {{my_company}}',
    body: `Hi {{first_name}},

{{company}} and {{my_company}} serve similar audiences. I see a natural collaboration around {{collaboration_area}}.

Worth exploring?

{{my_name}}`,
    variables: ['company', 'first_name', 'my_company', 'collaboration_area', 'my_name'],
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
