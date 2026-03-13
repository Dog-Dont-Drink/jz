from __future__ import annotations

from sqlalchemy import Boolean, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
  pass


class User(Base):
  __tablename__ = "users"

  id: Mapped[str] = mapped_column(Text, primary_key=True)
  email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
  password_salt: Mapped[str] = mapped_column(Text, nullable=False)
  password_hash: Mapped[str] = mapped_column(Text, nullable=False)
  daily_check_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
  daily_check_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
  last_check_date: Mapped[str | None] = mapped_column(Text, nullable=True)
  created_at: Mapped[str] = mapped_column(Text, nullable=False)


class UserSession(Base):
  __tablename__ = "sessions"

  token: Mapped[str] = mapped_column(Text, primary_key=True)
  user_id: Mapped[str] = mapped_column(Text, nullable=False)
  expires_at: Mapped[str] = mapped_column(Text, nullable=False)
  created_at: Mapped[str] = mapped_column(Text, nullable=False)


class VerificationCode(Base):
  __tablename__ = "verification_codes"

  email: Mapped[str] = mapped_column(Text, primary_key=True)
  code: Mapped[str] = mapped_column(Text, nullable=False)
  expires_at: Mapped[str] = mapped_column(Text, nullable=False)
  created_at: Mapped[str] = mapped_column(Text, nullable=False)


class EssayQuestion(Base):
  __tablename__ = "essay_questions"

  id: Mapped[str] = mapped_column(Text, primary_key=True)
  code: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
  date_tag: Mapped[str | None] = mapped_column(Text, nullable=True)
  exercise_no: Mapped[int | None] = mapped_column(Integer, nullable=True)
  title: Mapped[str] = mapped_column(Text, nullable=False)
  category: Mapped[str] = mapped_column(Text, nullable=False)
  question_text: Mapped[str | None] = mapped_column(Text, nullable=True)
  requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
  word_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
  material_text: Mapped[str | None] = mapped_column(Text, nullable=True)
  standard_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
  answer_outline: Mapped[str | None] = mapped_column(Text, nullable=True)
  scoring_points: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
  total_score: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
  source: Mapped[str | None] = mapped_column(Text, nullable=True)
  source_meta: Mapped[str | None] = mapped_column(Text, nullable=True)
  created_at: Mapped[str] = mapped_column(Text, nullable=False)


class EssaySubmission(Base):
  __tablename__ = "essay_submissions"

  id: Mapped[str] = mapped_column(Text, primary_key=True)
  user_id: Mapped[str] = mapped_column(Text, nullable=False)
  question_id: Mapped[str] = mapped_column(Text, nullable=False)
  image_path: Mapped[str | None] = mapped_column(Text, nullable=True)
  ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
  final_user_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
  ocr_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
  grade_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
  created_at: Mapped[str] = mapped_column(Text, nullable=False)


class EssayGrade(Base):
  __tablename__ = "essay_grades"

  id: Mapped[str] = mapped_column(Text, primary_key=True)
  submission_id: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
  total_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
  content_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
  structure_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
  expression_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
  matched_points: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
  missed_points: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
  deduction_points: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
  overall_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
  improvement_suggestions: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
  raw_model_output: Mapped[str | None] = mapped_column(Text, nullable=True)
  created_at: Mapped[str] = mapped_column(Text, nullable=False)

