import { defineStore } from 'pinia'
import { ref } from 'vue'
import { submissionApi } from '../api/submissions'

export type OcrJobStatus = 'idle' | 'processing' | 'done' | 'error' | 'aborted'

export type OcrJob = {
  submissionId: string
  status: OcrJobStatus
  text: string
  error: string
  startedAt: number
  finishedAt?: number
}

export const useOcrStore = defineStore('ocr', () => {
  const jobs = ref<Record<string, OcrJob>>({})
  const _controllers = new Map<string, AbortController>()

  const start = async (submissionId: string, file: File) => {
    // Cancel existing job for same submissionId
    abort(submissionId)
    const controller = new AbortController()
    _controllers.set(submissionId, controller)

    jobs.value[submissionId] = {
      submissionId,
      status: 'processing',
      text: '',
      error: '',
      startedAt: Date.now(),
    }

    try {
      const res = await submissionApi.performLLMOCRFromFile(file, { signal: controller.signal })
      if (controller.signal.aborted) {
        jobs.value[submissionId] = { ...jobs.value[submissionId], status: 'aborted', finishedAt: Date.now() }
        return jobs.value[submissionId]
      }

      if (res?.success && res.text) {
        jobs.value[submissionId] = {
          ...jobs.value[submissionId],
          status: 'done',
          text: res.text,
          finishedAt: Date.now(),
        }
      } else {
        jobs.value[submissionId] = {
          ...jobs.value[submissionId],
          status: 'error',
          error: 'OCR 无结果',
          finishedAt: Date.now(),
        }
      }
    } catch (err: any) {
      const msg = String(err?.message || err || 'OCR 失败')
      jobs.value[submissionId] = {
        ...jobs.value[submissionId],
        status: controller.signal.aborted ? 'aborted' : 'error',
        error: msg,
        finishedAt: Date.now(),
      }
    } finally {
      _controllers.delete(submissionId)
    }

    return jobs.value[submissionId]
  }

  const abort = (submissionId: string) => {
    const c = _controllers.get(submissionId)
    if (c) c.abort()
    _controllers.delete(submissionId)
    if (jobs.value[submissionId]?.status === 'processing') {
      jobs.value[submissionId] = { ...jobs.value[submissionId], status: 'aborted', finishedAt: Date.now() }
    }
  }

  const clear = (submissionId: string) => {
    abort(submissionId)
    delete jobs.value[submissionId]
  }

  return { jobs, start, abort, clear }
})

