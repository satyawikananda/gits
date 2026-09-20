import type { QualifiedLead } from './types'

const columns = [
  'name',
  'category',
  'address',
  'rating',
  'review_count',
  'website',
  'phone',
  'maps_url',
  'priority',
  'qualification_reason',
  'source_query',
]
function cell(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))
    text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
export function leadsToCsv(leads: QualifiedLead[]): string {
  const rows = leads
    .filter(l => l.decision.qualified && l.decision.action === 'save')
    .map(l =>
      [
        l.name,
        l.category,
        l.address,
        l.rating,
        l.reviewCount,
        l.website,
        l.phone,
        l.mapsUrl,
        l.decision.priority,
        l.decision.reason,
        l.sourceQuery,
      ]
        .map(cell)
        .join(','),
    )
  return `\uFEFF${[columns.join(','), ...rows].join('\r\n')}\r\n`
}
