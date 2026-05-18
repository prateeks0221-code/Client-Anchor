import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function formatSalary(min?: number | null, max?: number | null): string {
  if (!min && !max) return ''
  const fmt = (n: number) => `£${Math.round(n / 1000)}k`
  if (min && max) return `${fmt(min)} – ${fmt(max)}`
  if (min) return `from ${fmt(min)}`
  return `up to ${fmt(max!)}`
}

interface Row {
  name: string
  type: string
  source: string
  score: number
  email: string
  phone: string
  address: string
  website: string
  company: string
  salary: string
  category: string
  rating: string
  businessStatus: string
  matchReason: string
  contactName: string
  contactEmail: string
  contactTitle: string
}

async function buildRows(searchId: string): Promise<Row[]> {
  const searchQuery = await prisma.searchQuery.findUnique({
    where: { id: searchId },
    include: {
      results: {
        include: { contacts: true },
        orderBy: { matchScore: 'desc' },
      },
    },
  })
  if (!searchQuery) return []

  return searchQuery.results.map((r) => {
    const raw = (r.rawData && typeof r.rawData === 'object' ? r.rawData : {}) as Record<string, unknown>
    const primary = r.contacts.find((c) => c.isPrimary) ?? r.contacts[0]

    return {
      name: r.name,
      type: r.type,
      source: r.source,
      score: r.matchScore,
      email: r.email || '',
      phone: r.phone || '',
      address: r.address || '',
      website: r.website || r.sourceUrl || '',
      company: safeStr(raw.company),
      salary: formatSalary(raw.salaryMin as number, raw.salaryMax as number),
      category: safeStr(raw.category),
      rating: raw.rating ? String((raw.rating as number).toFixed(1)) : '',
      businessStatus: safeStr(raw.businessStatus),
      matchReason: r.matchReason || '',
      contactName: primary?.name || '',
      contactEmail: primary?.email || '',
      contactTitle: primary?.title || '',
    }
  })
}

const COLUMNS: { header: string; key: keyof Row; width: number }[] = [
  { header: 'Name',           key: 'name',           width: 30 },
  { header: 'Type',           key: 'type',           width: 14 },
  { header: 'Source',         key: 'source',         width: 14 },
  { header: 'Match Score',    key: 'score',          width: 12 },
  { header: 'Email',          key: 'email',          width: 28 },
  { header: 'Phone',          key: 'phone',          width: 18 },
  { header: 'Address',        key: 'address',        width: 34 },
  { header: 'Website',        key: 'website',        width: 34 },
  { header: 'Company',        key: 'company',        width: 22 },
  { header: 'Salary',         key: 'salary',         width: 18 },
  { header: 'Category',       key: 'category',       width: 20 },
  { header: 'Rating',         key: 'rating',         width: 10 },
  { header: 'Status',         key: 'businessStatus', width: 22 },
  { header: 'Match Reason',   key: 'matchReason',    width: 40 },
  { header: 'Contact Name',   key: 'contactName',    width: 22 },
  { header: 'Contact Email',  key: 'contactEmail',   width: 28 },
  { header: 'Contact Title',  key: 'contactTitle',   width: 20 },
]

// ── CSV builder ───────────────────────────────────────────────────────────────

function toCSV(rows: Row[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const header = COLUMNS.map((c) => escape(c.header)).join(',')
  const body = rows.map((r) => COLUMNS.map((c) => escape(r[c.key])).join(','))
  return [header, ...body].join('\n')
}

// ── XLSX builder ──────────────────────────────────────────────────────────────

async function toXLSX(rows: Row[], prompt: string): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ClientAnchor'
  wb.created = new Date()

  const ws = wb.addWorksheet('Results')

  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }))

  // Style header row
  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1525' } }
    cell.font = { bold: true, color: { argb: 'FF38BDF8' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF334155' } } }
  })
  headerRow.height = 22

  // Data rows
  for (const row of rows) {
    const r = ws.addRow(row)

    // Score cell — color by value
    const scoreCell = r.getCell('score')
    const score = Number(row.score)
    const scoreColor =
      score >= 80 ? 'FF059669' :
      score >= 60 ? 'FF0EA5E9' :
      score >= 40 ? 'FFF59E0B' : 'FF64748B'
    scoreCell.font = { color: { argb: scoreColor }, bold: true }

    // Website / email as hyperlinks
    if (row.website) {
      const cell = r.getCell('website')
      cell.value = { text: row.website, hyperlink: row.website }
      cell.font = { color: { argb: 'FF38BDF8' }, underline: true }
    }
    if (row.email) {
      const cell = r.getCell('email')
      cell.value = { text: row.email, hyperlink: `mailto:${row.email}` }
      cell.font = { color: { argb: 'FF38BDF8' }, underline: true }
    }
    if (row.contactEmail) {
      const cell = r.getCell('contactEmail')
      cell.value = { text: row.contactEmail, hyperlink: `mailto:${row.contactEmail}` }
      cell.font = { color: { argb: 'FF38BDF8' }, underline: true }
    }

    r.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: false }
    })
  }

  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + COLUMNS.length)}1` }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // Metadata sheet
  const meta = wb.addWorksheet('Search Info')
  meta.addRow(['Field', 'Value'])
  meta.addRow(['Search Prompt', prompt])
  meta.addRow(['Total Results', rows.length])
  meta.addRow(['Exported At', new Date().toISOString()])
  meta.getRow(1).font = { bold: true }
  meta.getColumn(1).width = 20
  meta.getColumn(2).width = 60

  const raw = await wb.xlsx.writeBuffer()
  // Normalise to ArrayBuffer regardless of ExcelJS generic type
  if (raw instanceof ArrayBuffer) return raw
  return (raw as unknown as Uint8Array).buffer.slice(0) as ArrayBuffer
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const { searchId } = await params
  const format = req.nextUrl.searchParams.get('format') ?? 'csv' // 'csv' | 'xlsx'

  const search = await prisma.searchQuery.findUnique({
    where: { id: searchId },
    select: { prompt: true },
  })
  if (!search) {
    return NextResponse.json({ error: 'Search not found' }, { status: 404 })
  }

  const rows = await buildRows(searchId)
  const slug = search.prompt.slice(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const ts = new Date().toISOString().slice(0, 10)

  if (format === 'xlsx') {
    const buf = await toXLSX(rows, search.prompt)
    const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    const blob = new Blob([buf], { type: XLSX_MIME })
    return new Response(blob, {
      headers: {
        'Content-Type': XLSX_MIME,
        'Content-Disposition': `attachment; filename="clientanchor_${slug}_${ts}.xlsx"`,
      },
    })
  }

  // Default: CSV
  const csv = toCSV(rows)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="clientanchor_${slug}_${ts}.csv"`,
    },
  })
}
