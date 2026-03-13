import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const isUuid = (value: string) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

const GRADING_PROMPT_TEMPLATE = `你是一名资深公务员考试申论阅卷助手，请根据"题目要求、材料信息、标准答案、参考得分点、用户答案"对用户答案进行评分。

评分规则：
1. 不要求逐字逐句照抄标准答案。
2. 只要用户答案与标准答案在核心观点、逻辑含义、关键事实、主要对策上基本一致，即可给分。
3. 允许近义表达、同义改写、概括表达、语序变化、不同措辞。
4. 对不影响理解的少量错别字、语病，可适度宽容，不应重扣。
5. 如果答案覆盖关键得分点较全、逻辑清晰、表达通顺，应给予较高分。
6. 如果存在偏题、遗漏核心点、逻辑混乱、空泛套话过多、与材料明显不符，则扣分。
7. 评分要兼顾：内容准确性、要点完整性、逻辑结构、语言表达。
8. 必须输出严格 JSON，不能输出 Markdown，不能输出额外解释文字。

题目信息：
题目：{{TITLE}}
要求：{{PROMPT}}
满分：{{TOTAL_SCORE}}

材料摘要：
{{MATERIAL}}

标准答案：
{{STANDARD_ANSWER}}

参考得分点：
{{SCORING_POINTS}}

用户答案：
{{USER_ANSWER}}

请严格按以下 JSON 格式输出：
{
  "total_score": 0,
  "content_score": 0,
  "structure_score": 0,
  "expression_score": 0,
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

注意：
- total_score 不能超过题目满分 {{TOTAL_SCORE}}
- 各项分数应逻辑一致
- matched_points / missed_points / deduction_points 必须尽量具体，不要空泛`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { submissionId } = await req.json()

    if (!submissionId) {
      throw new Error('submissionId is required')
    }
    if (typeof submissionId !== 'string' || !isUuid(submissionId)) {
      throw new Error(`submissionId must be a UUID (got: ${String(submissionId)})`)
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get submission with question
    const { data: submission, error: submissionError } = await supabaseClient
      .from('essay_submissions')
      .select(`
        *,
        question:essay_questions(*)
      `)
      .eq('id', submissionId)
      .single()

    if (submissionError) throw submissionError

    if (!submission.final_user_text) {
      throw new Error('User answer is empty')
    }

    // Update status to processing
    await supabaseClient
      .from('essay_submissions')
      .update({ grade_status: 'processing' })
      .eq('id', submissionId)

    const question = submission.question

    // Build prompt
    const scoringPointsText = (Array.isArray(question.scoring_points) ? question.scoring_points : [])
      .map((p: any, i: number) => `${i + 1}. ${p.point} (${p.score}分)`)
      .join('\n')

    let prompt = GRADING_PROMPT_TEMPLATE
      .replace('{{TITLE}}', question.title)
      .replace(
        '{{PROMPT}}',
        [question.question_text, question.requirements].filter(Boolean).join('\n') || ''
      )
      .replace(/{{TOTAL_SCORE}}/g, question.total_score.toString())
      .replace('{{MATERIAL}}', (question.material_text || '').substring(0, 500))
      .replace('{{STANDARD_ANSWER}}', question.standard_answer || question.answer_outline || '')
      .replace('{{SCORING_POINTS}}', scoringPointsText)
      .replace('{{USER_ANSWER}}', submission.final_user_text)

    // Call DeepSeek API
    const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY not configured')
    }

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    })

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text()
      throw new Error(`DeepSeek API error: ${errorText}`)
    }

    const deepseekResult = await deepseekResponse.json()
    const rawOutput = deepseekResult.choices[0].message.content

    let gradeResult
    try {
      gradeResult = JSON.parse(rawOutput)
    } catch (parseError) {
      // Retry once if JSON parsing fails
      console.error('First parse failed, retrying...')

      const retryResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekApiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'user',
              content: prompt + '\n\n请确保输出严格的 JSON 格式，不要包含任何其他文字。',
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
      })

      const retryResult = await retryResponse.json()
      const retryOutput = retryResult.choices[0].message.content
      gradeResult = JSON.parse(retryOutput)
    }

    // Save grade to database
    const { error: gradeError } = await supabaseClient
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
        raw_model_output: deepseekResult,
      })

    if (gradeError) throw gradeError

    // Update submission status
    await supabaseClient
      .from('essay_submissions')
      .update({ grade_status: 'completed' })
      .eq('id', submissionId)

    return new Response(
      JSON.stringify({
        success: true,
        grade: gradeResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Grading error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
