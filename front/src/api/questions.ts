import { apiPost } from './http'
import type { EssayQuestion } from '../types'

export const questionApi = {
  async getQuestions(filters: Record<string, any> = {}): Promise<EssayQuestion[]> {
    const res: any = await apiPost('/api/questions/list', filters)
    if (!res?.success) throw new Error(res?.error || '加载题目失败')
    return (res.data || []) as EssayQuestion[]
  },

  async getQuestionByIdentifier(identifier: string): Promise<EssayQuestion> {
    const res: any = await apiPost('/api/questions/get', { identifier })
    if (!res?.success) throw new Error(res?.error || '加载题目失败')
    return res.data as EssayQuestion
  },
}

