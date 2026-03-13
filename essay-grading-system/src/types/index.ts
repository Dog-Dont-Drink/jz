// TypeScript types for the application

export interface EssayQuestion {
  id: string
  date_tag: string | null
  exercise_no: number | string | null
  title: string
  category: string
  question_text: string | null
  requirements: string | null
  word_limit: number | null
  material_text: string | null
  standard_answer: string
  answer_outline: string | null
  scoring_points: ScoringPoint[]
  total_score: number
  source: string | null
  created_at: string
}

export interface ScoringPoint {
  point: string
  score: number
  description?: string
}

export interface EssaySubmission {
  id: string
  user_id: string
  question_id: string
  image_path: string | null
  ocr_text: string | null
  final_user_text: string
  ocr_status: 'pending' | 'processing' | 'completed' | 'failed'
  grade_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
}

export interface MatchedPoint {
  point: string
  reason: string
  score: number
}

export interface MissedPoint {
  point: string
  reason: string
}

export interface DeductionPoint {
  issue: string
  reason: string
  deduct_score: number
}

export interface EssayGrade {
  id: string
  submission_id: string
  total_score: number
  content_score: number
  structure_score: number
  expression_score: number
  matched_points: MatchedPoint[]
  missed_points: MissedPoint[]
  deduction_points: DeductionPoint[]
  overall_feedback: string
  improvement_suggestions: string[]
  raw_model_output: any
  created_at: string
}

export interface GradeResult {
  total_score: number
  content_score: number
  structure_score: number
  expression_score: number
  matched_points: MatchedPoint[]
  missed_points: MissedPoint[]
  deduction_points: DeductionPoint[]
  overall_feedback: string
  improvement_suggestions: string[]
}

export interface SubmissionWithDetails extends EssaySubmission {
  question?: EssayQuestion
  grade?: EssayGrade
}
