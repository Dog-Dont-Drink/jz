import { supabase } from '../lib/supabase'
import type { EssayQuestion } from '../types'
import { parseQuestionIdentifier } from '../utils/questionIdentifier'

// 转换数据库返回的数据格式
function normalizeQuestion(raw: any): EssayQuestion {
  // 处理 answer_outline
  let answerOutline: string | null = null
  if (raw.answer_outline) {
    if (typeof raw.answer_outline === 'string') {
      answerOutline = raw.answer_outline.trim() || null
    } else if (Array.isArray(raw.answer_outline)) {
      const joined = raw.answer_outline
        .filter((item: any) => item && typeof item === 'string')
        .join('\n')
        .trim()
      answerOutline = joined || null
    }
  }

  // 处理 scoring_points
  let scoringPoints: any[] = []
  if (raw.scoring_points) {
    if (Array.isArray(raw.scoring_points)) {
      scoringPoints = raw.scoring_points.filter((item: any) =>
        item && typeof item === 'object' && item.point
      )
    } else if (typeof raw.scoring_points === 'object') {
      scoringPoints = Object.values(raw.scoring_points).filter((item: any) =>
        item && typeof item === 'object' && item.point
      )
    }
  }

  // 处理 source
  let source: string | null = null
  if (raw.source) {
    if (typeof raw.source === 'string') {
      source = raw.source
    } else if (typeof raw.source === 'object') {
      source = raw.source.name || raw.source.source || null
    }
  }

  return {
    ...raw,
    answer_outline: answerOutline,
    scoring_points: scoringPoints,
    source: source,
  }
}

export const questionApi = {
  async getQuestions(filters?: {
    date_tag?: string
    source?: string
    category?: string
    search?: string
  }) {
    let query = supabase
      .from('essay_questions')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.date_tag) {
      query = query.eq('date_tag', filters.date_tag)
    }
    if (filters?.source) {
      query = query.eq('source', filters.source)
    }
    if (filters?.category) {
      query = query.eq('category', filters.category)
    }
    if (filters?.search) {
      query = query.ilike('title', `%${filters.search}%`)
    }

    const { data, error } = await query

    if (error) throw error
    return (data || []).map(normalizeQuestion)
  },

  async getQuestionById(id: string) {
    return this.getQuestionByIdentifier(id)
  },

  async getQuestionByIdentifier(identifier: string) {
    const trimmed = identifier.trim()
    const parsed = parseQuestionIdentifier(trimmed)
    const baseQuery = supabase.from('essay_questions').select('*')

    if (parsed.kind === 'uuid') {
      const { data, error } = await baseQuery.eq('id', parsed.id).maybeSingle()
      if (error) throw error
      if (!data) throw new Error(`题目不存在：id=${trimmed}`)
      return normalizeQuestion(data)
    }

    if (parsed.kind !== 'composite') {
      throw new Error(`题目标识不合法：${trimmed}（请使用 UUID，或使用如 junzhuan_2026_03_12_05 的格式）`)
    }

    const exNoNum = Number.parseInt(parsed.exerciseNoRaw, 10)
    const exNoCandidates: Array<string | number> = []
    if (Number.isFinite(exNoNum)) exNoCandidates.push(exNoNum)
    exNoCandidates.push(parsed.exerciseNoRaw)
    if (Number.isFinite(exNoNum)) exNoCandidates.push(String(exNoNum))

    for (const exNo of exNoCandidates) {
      // Avoid using `in()` for Chinese values due to occasional PostgREST filter parsing issues.
      const { data, error } = await baseQuery
        .eq('date_tag', parsed.dateTag)
        .eq('exercise_no', exNo)
        .limit(2)

      if (error) throw error
      if (data && data.length === 1) return normalizeQuestion(data[0])
      if (data && data.length > 1) {
        throw new Error(`题目不唯一：date_tag=${parsed.dateTag} exercise_no=${String(exNo)}（请检查数据重复）`)
      }
    }

    throw new Error(`题目不存在：date_tag=${parsed.dateTag} exercise_no=${parsed.exerciseNoRaw}`)
  },
}
