import type { EssayQuestion } from '../types'

export function formatQuestionIdentifier(question: Partial<EssayQuestion>): string {
  if (question.id) return String(question.id)

  const dateTag = String(question.date_tag || '').trim()
  const exNo = question.exercise_no
  const source = String(question.source || '').trim()
  if (!dateTag || exNo === null || exNo === undefined) return ''

  const [yyyy, mm, dd] = dateTag.split('-')
  const ex = String(exNo)
  if (source.includes('军转')) return `junzhuan_${yyyy}_${mm}_${dd}_${ex}`
  if (source.includes('国考')) return `guokao_${yyyy}_${mm}_${dd}_${ex}`
  return `${yyyy}_${mm}_${dd}_${ex}`
}

