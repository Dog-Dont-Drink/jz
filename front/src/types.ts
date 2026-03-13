export interface EssayQuestion {
  id: string
  date_tag?: string | null
  exercise_no?: number | null
  title: string
  category?: string | null
  question_text?: string | null
  requirements?: string | null
  total_score?: number | null
  word_limit?: number | null
  material_text?: string | null
  standard_answer?: string | null
  answer_outline?: any
  scoring_points?: Array<{ point: string; score: number }>
  source?: string | null
  source_meta?: any
  created_at?: string
}

export interface EssaySubmission {
  id: string
  user_id: string
  question_id: string
  image_path?: string | null
  ocr_text?: string | null
  final_user_text?: string | null
  ocr_status?: string | null
  grade_status?: string | null
  created_at?: string
}

export interface EssayGrade {
  total_score: number
  content_score?: number
  structure_score?: number
  expression_score?: number
  matched_points?: any[]
  missed_points?: any[]
  deduction_points?: any[]
  overall_feedback?: string
  improvement_suggestions?: any[]
  created_at?: string
}

export interface SubmissionWithDetails extends EssaySubmission {
  question?: Partial<EssayQuestion> | null
  grade?: EssayGrade | { total_score?: number; overall_feedback?: string } | any
}
