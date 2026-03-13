import { apiPost, apiUpload } from './http'
import { authApi } from './auth'
import type { EssaySubmission, SubmissionWithDetails } from '../types'

function requireSessionToken() {
  const token = authApi.getSessionToken()
  if (!token) throw new Error('未登录或会话已过期')
  return token
}

export const submissionApi = {
  async createSubmission(questionIdentifier: string, _userId?: string): Promise<EssaySubmission> {
    const sessionToken = requireSessionToken()
    const res: any = await apiPost('/api/submissions/create', { sessionToken, questionIdentifier })
    if (!res?.success) throw new Error(res?.error || '创建提交失败')
    return res.data as EssaySubmission
  },

  async getSubmissionById(submissionId: string): Promise<SubmissionWithDetails> {
    const sessionToken = requireSessionToken()
    const res: any = await apiPost('/api/submissions/get', { sessionToken, submissionId })
    if (!res?.success) throw new Error(res?.error || '加载失败')
    return res.data as SubmissionWithDetails
  },

  async getUserSubmissions(_userId?: string): Promise<SubmissionWithDetails[]> {
    const sessionToken = requireSessionToken()
    const res: any = await apiPost('/api/submissions/list', { sessionToken })
    if (!res?.success) throw new Error(res?.error || '加载失败')
    return (res.data || []) as SubmissionWithDetails[]
  },

  async updateFinalText(submissionId: string, finalText: string) {
    const sessionToken = requireSessionToken()
    const res: any = await apiPost('/api/submissions/update-final', { sessionToken, submissionId, finalText })
    if (!res?.success) throw new Error(res?.error || '保存失败')
    return res.data
  },

  async requestGrading(submissionId: string) {
    const sessionToken = requireSessionToken()
    return await apiPost('/api/submissions/grade', { sessionToken, submissionId })
  },

  async performLLMOCRFromFile(file: File, opts?: { signal?: AbortSignal }) {
    const form = new FormData()
    form.append('file', file)
    const res: any = await apiUpload('/api/ocr/llm', form, { signal: opts?.signal })
    return { success: !!res?.success, text: String(res?.text || '') }
  },
}
