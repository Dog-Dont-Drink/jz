import type { EssayQuestion } from '../types'

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizeExerciseNo(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null
  const asNumber = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber
  const raw = String(value).trim()
  return raw ? raw : null
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toSourceKey(source: string | null | undefined) {
  const s = String(source || '')
  if (!s) return null
  if (s.includes('军转')) return 'junzhuan'
  if (s.includes('国考')) return 'guokao'
  return null
}

export function formatQuestionIdentifier(question: Pick<EssayQuestion, 'id' | 'date_tag' | 'exercise_no' | 'source'>) {
  const dateTag = String(question.date_tag || '').trim()
  const exNo = normalizeExerciseNo(question.exercise_no)
  if (!dateTag || !exNo) return question.id

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateTag)
  if (!match) return question.id

  const [, yyyy, mm, dd] = match
  const sourceKey = toSourceKey(question.source)

  const exNoPart =
    typeof exNo === 'number' ? pad2(exNo) : String(exNo).replace(/^0+/, '') || String(exNo)

  if (sourceKey) {
    return `${sourceKey}_${yyyy}_${mm}_${dd}_${exNoPart}`
  }
  return `${yyyy}_${mm}_${dd}_${exNoPart}`
}

export type ParsedQuestionIdentifier =
  | { kind: 'uuid'; id: string }
  | { kind: 'composite'; dateTag: string; exerciseNoRaw: string; sourceCandidates?: string[] }
  | { kind: 'unknown' }

export function parseQuestionIdentifier(identifier: string): ParsedQuestionIdentifier {
  const trimmed = identifier.trim()
  if (!trimmed) return { kind: 'unknown' }
  if (isUuid(trimmed)) return { kind: 'uuid', id: trimmed }

  // junzhuan_2026_03_12_05 / guokao_2024_01_01_01 / <prefix>_YYYY_MM_DD_N
  const withPrefix = /^([a-zA-Z]+)_(\d{4})_(\d{2})_(\d{2})_(\d+)$/.exec(trimmed)
  if (withPrefix) {
    const [, prefixRaw, yyyy, mm, dd, exNo] = withPrefix
    if (!prefixRaw || !yyyy || !mm || !dd || !exNo) return { kind: 'unknown' }
    const prefix = prefixRaw.toLowerCase()
    const sourceCandidates =
      prefix === 'junzhuan'
        ? ['军转', '军转课后作业']
        : prefix === 'guokao'
          ? ['国考']
          : undefined
    return {
      kind: 'composite',
      dateTag: `${yyyy}-${mm}-${dd}`,
      exerciseNoRaw: exNo,
      sourceCandidates,
    }
  }

  // YYYY_MM_DD_N
  const noPrefix = /^(\d{4})_(\d{2})_(\d{2})_(\d+)$/.exec(trimmed)
  if (noPrefix) {
    const [, yyyy, mm, dd, exNo] = noPrefix
    if (!yyyy || !mm || !dd || !exNo) return { kind: 'unknown' }
    return { kind: 'composite', dateTag: `${yyyy}-${mm}-${dd}`, exerciseNoRaw: exNo }
  }

  // YYYY-MM-DD_N
  const dateUnderscore = /^(\d{4})-(\d{2})-(\d{2})_(\d+)$/.exec(trimmed)
  if (dateUnderscore) {
    const [, yyyy, mm, dd, exNo] = dateUnderscore
    if (!yyyy || !mm || !dd || !exNo) return { kind: 'unknown' }
    return { kind: 'composite', dateTag: `${yyyy}-${mm}-${dd}`, exerciseNoRaw: exNo }
  }

  return { kind: 'unknown' }
}
