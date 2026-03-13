import { supabase } from '../lib/supabase'
import type { EssaySubmission, SubmissionWithDetails } from '../types'
import { isUuid, parseQuestionIdentifier } from '../utils/questionIdentifier'

async function resolveQuestionId(questionIdentifier: string) {
  const trimmed = questionIdentifier.trim()
  const parsed = parseQuestionIdentifier(trimmed)
  if (parsed.kind === 'uuid') return parsed.id

  if (parsed.kind !== 'composite') {
    throw new Error(`题目标识不合法：${trimmed}（请使用 UUID，或使用如 junzhuan_2026_03_12_05 的格式）`)
  }

  const exNoNum = Number.parseInt(parsed.exerciseNoRaw, 10)
  const exNoCandidates: Array<string | number> = []
  if (Number.isFinite(exNoNum)) exNoCandidates.push(exNoNum)
  exNoCandidates.push(parsed.exerciseNoRaw)
  if (Number.isFinite(exNoNum)) exNoCandidates.push(String(exNoNum))

  for (const exNo of exNoCandidates) {
    const { data, error } = await supabase
      .from('essay_questions')
      .select('id')
      .eq('date_tag', parsed.dateTag)
      .eq('exercise_no', exNo)
      .limit(2)

    if (error) throw error
    if (!data || data.length === 0) continue
    if (data.length > 1) {
      throw new Error(`题目不唯一：date_tag=${parsed.dateTag} exercise_no=${String(exNo)}（请检查数据重复）`)
    }
    const row = data[0] as { id?: string } | undefined
    if (!row?.id) {
      throw new Error(`题目解析失败：date_tag=${parsed.dateTag} exercise_no=${String(exNo)} 未返回 id`)
    }
    const id = String(row.id)
    if (!isUuid(id)) {
      throw new Error(
        `题目表 essay_questions.id 必须是 UUID（当前查到: ${id}）。` +
          `请确认数据库 schema：essay_questions.id 为 uuid（默认 gen_random_uuid()），` +
          `不要把类似 ${trimmed} 这种业务编码写进 id 列。`
      )
    }
    return id
  }

  throw new Error(`找不到题目：date_tag=${parsed.dateTag} exercise_no=${parsed.exerciseNoRaw}`)
}


// LLM-based OCR using Claude Sonnet 4-6
async function performLLMOCR(imageFile: File): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    const apiKey = import.meta.env.VITE_LLM_API_KEY
    const apiUrl = 'https://llm.xiaochisaas.com'

    if (!apiKey) {
      throw new Error('LLM API Key 未配置，请在 .env 中设置 VITE_LLM_API_KEY')
    }

    // Compress image to suitable size (< 3MB base64)
    const base64Image = await compressImageForLLM(imageFile)

    // Call LLM API
    const response = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `你是一名高精度中文手写文本识别助手。请识别图片中的全部手写文字，并忠实转写原文。

要求：
- 只做OCR转写，不做总结、翻译、润色、纠错。
- 保留原始段落、换行、序号、分点、标点。
- 保留原文中的错别字和不规范表达。
- 不确定的字词用【疑似：xxx】标记。
- 完全无法辨认的部分用【无法辨认】标记。
- 不要凭空补写。
- 如果图片中既有印刷体也有手写体，优先识别手写体正文。
- 输出必须是纯文本本身，不要附加解释。

请直接输出识别结果。`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LLM API 错误: ${errorText}`)
    }

    const result = await response.json()
    const recognizedText = result.choices?.[0]?.message?.content?.trim()

    if (!recognizedText) {
      throw new Error('未识别到文字')
    }

    return { success: true, text: recognizedText }
  } catch (error: any) {
    console.error('LLM OCR 错误:', error)
    return { success: false, error: error?.message || 'OCR 识别失败' }
  }
}

// Compress image for LLM API (< 5MB limit)
async function compressImageForLLM(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.src = e.target?.result as string
    }

    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      // Resize if too large
      const maxDimension = 2048
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = (height / width) * maxDimension
          width = maxDimension
        } else {
          width = (width / height) * maxDimension
          height = maxDimension
        }
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('无法创建 canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Try different quality levels to meet size limit
      const tryCompress = (quality: number): string | null => {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const base64 = dataUrl.split(',')[1] || null
        // Check if base64 size is under ~4MB (to leave room for JSON overhead)
        if (base64 && base64.length < 4 * 1024 * 1024 * 0.75) {
          return base64
        }
        return null
      }

      let base64 = tryCompress(0.8) || tryCompress(0.6) || tryCompress(0.4) || tryCompress(0.2)

      if (!base64) {
        // If still too large, reduce dimensions further
        canvas.width = width * 0.7
        canvas.height = height * 0.7
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        base64 = tryCompress(0.5) || ''
      }

      if (!base64) {
        reject(new Error('图片压缩后仍超过大小限制'))
        return
      }

      resolve(base64)
    }

    img.onerror = () => reject(new Error('图片加载失败'))
    reader.onerror = () => reject(new Error('文件读取失败'))

    reader.readAsDataURL(file)
  })
}

export const submissionApi = {
  async performLLMOCRFromFile(file: File) {
    return performLLMOCR(file)
  },

  async createSubmission(questionId: string, userId: string) {
    const resolvedQuestionId = await resolveQuestionId(questionId)
    if (!isUuid(resolvedQuestionId)) {
      throw new Error(
        `question_id 必须是 UUID（解析后得到: ${resolvedQuestionId}）。` +
          `这通常表示你把业务编码写进了 essay_questions.id，或 essay_questions.id 不是 uuid 类型。`
      )
    }
    if (!isUuid(userId)) {
      throw new Error(`userId 必须是 UUID（收到: ${userId}）`)
    }

    const { data, error } = await supabase
      .from('essay_submissions')
      .insert({
        question_id: resolvedQuestionId,
        user_id: userId,
        ocr_status: 'pending',
        grade_status: 'pending',
        final_user_text: '',
      })
      .select()
      .single()

    if (error) throw error
    return data as EssaySubmission
  },

  async createSubmissionWithOCR(questionId: string, userId: string, ocrText: string) {
    const resolvedQuestionId = await resolveQuestionId(questionId)
    if (!isUuid(resolvedQuestionId)) {
      throw new Error(
        `question_id 必须是 UUID（解析后得到: ${resolvedQuestionId}）。` +
          `这通常表示你把业务编码写进了 essay_questions.id，或 essay_questions.id 不是 uuid 类型。`
      )
    }
    if (!isUuid(userId)) {
      throw new Error(`userId 必须是 UUID（收到: ${userId}）`)
    }

    // OCR text is intentionally NOT persisted to DB (only kept client-side / sent to LLM).
    void ocrText

    const { data, error } = await supabase
      .from('essay_submissions')
      .insert({
        question_id: resolvedQuestionId,
        user_id: userId,
        ocr_status: 'completed',
        grade_status: 'pending',
        final_user_text: '',
      })
      .select()
      .single()

    if (error) throw error
    return data as EssaySubmission
  },

  async uploadImage(file: File, submissionId: string) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${submissionId}.${fileExt}`
    const filePath = `submissions/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('essay-images')
      .upload(filePath, file, {
        upsert: true,
      })

    if (uploadError) throw uploadError

    const { error: updateError } = await supabase
      .from('essay_submissions')
      .update({ image_path: filePath })
      .eq('id', submissionId)

    if (updateError) throw updateError

    return filePath
  },

  async updateOCRText(submissionId: string, ocrText: string, status: string) {
    // OCR text is intentionally NOT persisted to DB.
    void ocrText
    const { error } = await supabase
      .from('essay_submissions')
      .update({
        ocr_status: status,
      })
      .eq('id', submissionId)

    if (error) throw error
  },

  async updateFinalText(submissionId: string, finalText: string) {
    const { error } = await supabase
      .from('essay_submissions')
      .update({
        final_user_text: finalText,
      })
      .eq('id', submissionId)

    if (error) throw error
  },

  async getSubmissionById(submissionId: string) {
    const { data, error } = await supabase
      .from('essay_submissions')
      .select(`
        *,
        question:essay_questions(*),
        grade:essay_grades(*)
      `)
      .eq('id', submissionId)
      .single()

    if (error) throw error
    return data as SubmissionWithDetails
  },

  async getUserSubmissions(userId: string) {
    const { data, error } = await supabase
      .from('essay_submissions')
      .select(`
        *,
        question:essay_questions(title, total_score),
        grade:essay_grades(total_score, overall_feedback)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as SubmissionWithDetails[]
  },

  async requestGrading(submissionId: string) {
    // Try Edge Function first
    try {
      const { data, error } = await supabase.functions.invoke('grade-essay', {
        body: { submissionId },
      })

      if (error) throw error
      return data
    } catch (edgeFunctionError) {
      console.warn('Edge Function failed, trying direct grading:', edgeFunctionError)

      // Fallback: Direct AI grading call from frontend
      return await this.performDirectGrading(submissionId)
    }
  },

  async performDirectGrading(submissionId: string) {
    // Get submission with question
    const { data: submission, error: submissionError } = await supabase
      .from('essay_submissions')
      .select(`
        *,
        question:essay_questions(*)
      `)
      .eq('id', submissionId)
      .single()

    if (submissionError) throw submissionError

    if (!submission.final_user_text) {
      throw new Error('用户答案为空')
    }

    // Update status to processing
    await supabase
      .from('essay_submissions')
      .update({ grade_status: 'processing' })
      .eq('id', submissionId)

    const question = submission.question

    // Build prompt
const prompt = `你是一名资深公务员考试申论阅卷助手，请根据"题目要求、材料信息、参考答案、用户答案"对用户答案进行评分。

评分总原则：
1. 不要求用户逐字逐句照抄参考答案。
2. 评分时应优先判断"语义是否等价"，而不是"措辞是否一致"。
3. 只要用户答案与参考答案在核心观点、逻辑含义、关键事实、主要对策上基本一致，即可给分。
4. 允许近义表达、同义改写、概括表达、语序变化、拆分表达、合并表达、不同措辞。
5. 对不影响理解的少量错别字、轻微语病，应适度宽容，不应重扣。
6. 如果答案覆盖关键内容较全、逻辑清晰、表达通顺，应给予较高分。
7. 如果存在偏题、遗漏核心内容、逻辑混乱、空泛套话过多、与材料明显不符，则扣分。
8. 评分要兼顾：内容准确性、要点完整性、逻辑结构、语言表达。
9. 若用户答案明显过短、信息量严重不足、无法支撑完整作答，应据实低分，并明确指出原因。

评分任务要求：
1. 请先基于参考答案，自动提炼出若干"关键作答要点"。
2. 这些关键作答要点应尽量覆盖参考答案的核心信息。
3. 然后根据这些关键作答要点，判断用户答案命中了哪些内容、遗漏了哪些内容。
4. 不得因为用户没有照抄参考答案原句而机械扣分。
5. 若用户答案与参考答案表述不同，但语义等价，应判定为命中要点。
6. 若用户答案只命中了部分要点，可以给部分分数。
7. total_score 不得超过题目满分。
8. content_score、structure_score、expression_score 三项之和必须等于 total_score。
9. 所有评价必须具体、可解释、可用于指导修改。
10. 必须输出严格 JSON，不能输出 Markdown，不能输出额外解释文字。
11. 所有字段必须返回合法 JSON：
   - 数组为空时返回 []
   - 字符串为空时返回 ""
   - 不得返回 null
   - 不得返回 undefined

题目信息：
题目：${question.title}
题干：${question.question_text || ''}
要求：${question.requirements || ''}
字数限制：${question.word_limit ?? ''}
满分：${question.total_score}

材料摘要：
${(question.material_text || '').substring(0, 800)}

参考答案：
${question.standard_answer || question.answer_outline || ''}

用户答案：
${submission.final_user_text}

请严格按以下 JSON 格式输出：
{
  "total_score": 0,
  "content_score": 0,
  "structure_score": 0,
  "expression_score": 0,
  "derived_key_points": [
    {
      "point": "",
      "weight_hint": ""
    }
  ],
  "matched_points": [
    {
      "point": "",
      "reason": "",
      "score": 0
    }
  ],
  "missed_points": [
    {
      "point": "",
      "reason": ""
    }
  ],
  "deduction_points": [
    {
      "issue": "",
      "reason": "",
      "deduct_score": 0
    }
  ],
  "overall_feedback": "",
  "improvement_suggestions": [
    ""
  ]
}

额外注意：
- total_score 不能超过题目满分 ${question.total_score}
- content_score + structure_score + expression_score 必须严格等于 total_score
- 请先从参考答案中提炼关键作答要点，再进行评分
- derived_key_points 应尽量简洁、明确、避免重复
- matched_points / missed_points / deduction_points 必须尽量具体，不要空泛
- 如果用户答案与参考答案表述不同，但语义等价，必须给分
- 不要输出任何 JSON 之外的内容`

    // Call LLM API
    const llmApiKey = import.meta.env.VITE_LLM_API_KEY
    if (!llmApiKey) {
      throw new Error('LLM API Key 未配置')
    }

    const llmResponse = await fetch('https://llm.xiaochisaas.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmApiKey}`,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6-thinking',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
    })

    if (!llmResponse.ok) {
      const errorText = await llmResponse.text()
      throw new Error(`LLM API 错误: ${errorText}`)
    }

    const llmResult = await llmResponse.json()
    const rawOutput = llmResult.choices[0].message.content

    let gradeResult
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      let jsonText = rawOutput.trim()

      // Remove markdown code blocks
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      // Try to find JSON object in the text
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonText = jsonMatch[0]
      }

      gradeResult = JSON.parse(jsonText)

      // Validate required fields
      if (typeof gradeResult.total_score !== 'number') {
        throw new Error('缺少 total_score 字段')
      }
    } catch (parseError) {
      console.error('JSON 解析失败:', parseError)
      console.error('原始输出:', rawOutput)

      // Show more detailed error to user
      const preview = rawOutput.substring(0, 200)
      throw new Error(`AI 返回格式错误：${parseError instanceof Error ? parseError.message : '无法解析 JSON'}。返回内容预览：${preview}...`)
    }

    // Save grade to database
    const { error: gradeError } = await supabase
      .from('essay_grades')
      .insert({
        submission_id: submissionId,
        total_score: gradeResult.total_score,
        content_score: gradeResult.content_score,
        structure_score: gradeResult.structure_score,
        expression_score: gradeResult.expression_score,
        matched_points: gradeResult.matched_points,
        missed_points: gradeResult.missed_points,
        deduction_points: gradeResult.deduction_points,
        overall_feedback: gradeResult.overall_feedback,
        improvement_suggestions: gradeResult.improvement_suggestions,
        raw_model_output: llmResult,
      })

    if (gradeError) throw gradeError

    // Update submission status
    await supabase
      .from('essay_submissions')
      .update({ grade_status: 'completed' })
      .eq('id', submissionId)

    return {
      success: true,
      grade: gradeResult,
    }
  },
}
