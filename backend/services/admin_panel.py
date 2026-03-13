from __future__ import annotations

import os
import secrets
from typing import Any

from fastapi import FastAPI

from .db import db_path
from .admin_models import (
  EssayGrade,
  EssayQuestion,
  EssaySubmission,
  User,
  UserSession,
  VerificationCode,
)


def _env(name: str, default: str = "") -> str:
  return str(os.environ.get(name, default) or "").strip()


def setup_admin_panel(app: FastAPI) -> None:
  enabled = _env("ADMIN_ENABLED", "1").lower() in ("1", "true", "yes", "on")
  if not enabled:
    return

  try:
    from sqladmin import Admin, ModelView
    from sqladmin.authentication import AuthenticationBackend
    from sqlalchemy import create_engine
    from starlette.requests import Request
  except Exception as e:
    # Keep API working even if admin deps are not installed.
    print(f"[ADMIN] disabled (missing deps): {e}")
    return

  admin_user = _env("ADMIN_USER")
  admin_pass = _env("ADMIN_PASSWORD")
  if not admin_user or not admin_pass:
    print("[ADMIN] disabled: set ADMIN_USER and ADMIN_PASSWORD to enable /admin")
    return

  secret_key = _env("ADMIN_SECRET_KEY") or secrets.token_urlsafe(32)

  class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
      form = await request.form()
      username = str(form.get("username") or "")
      password = str(form.get("password") or "")
      if username == admin_user and password == admin_pass:
        request.session.update({"admin": True})
        return True
      return False

    async def logout(self, request: Request) -> bool:
      request.session.clear()
      return True

    async def authenticate(self, request: Request) -> bool:
      return bool(request.session.get("admin"))

  engine = create_engine(f"sqlite:///{db_path()}", connect_args={"check_same_thread": False})

  admin = Admin(
    app,
    engine,
    base_url="/admin",
    title="Essay Admin",
    authentication_backend=AdminAuth(secret_key=secret_key),
  )

  class _BaseView(ModelView):
    page_size = 50
    page_size_options = [25, 50, 100, 200]

  class UserAdmin(_BaseView, model=User):
    column_searchable_list = [User.id, User.email]
    column_sortable_list = [User.email, User.created_at, User.daily_check_count, User.daily_check_limit]
    column_list = [User.id, User.email, User.daily_check_count, User.daily_check_limit, User.last_check_date, User.created_at]

  class SessionAdmin(_BaseView, model=UserSession):
    can_create = False
    column_searchable_list = [UserSession.token, UserSession.user_id]
    column_sortable_list = [UserSession.expires_at, UserSession.created_at]
    column_list = [UserSession.token, UserSession.user_id, UserSession.expires_at, UserSession.created_at]

  class VerificationCodeAdmin(_BaseView, model=VerificationCode):
    column_searchable_list = [VerificationCode.email, VerificationCode.code]
    column_sortable_list = [VerificationCode.expires_at, VerificationCode.created_at]
    column_list = [VerificationCode.email, VerificationCode.code, VerificationCode.expires_at, VerificationCode.created_at]

  class QuestionAdmin(_BaseView, model=EssayQuestion):
    column_searchable_list = [EssayQuestion.id, EssayQuestion.code, EssayQuestion.title, EssayQuestion.category]
    column_sortable_list = [EssayQuestion.date_tag, EssayQuestion.exercise_no, EssayQuestion.total_score, EssayQuestion.created_at]
    column_list = [
      EssayQuestion.id,
      EssayQuestion.code,
      EssayQuestion.date_tag,
      EssayQuestion.exercise_no,
      EssayQuestion.title,
      EssayQuestion.category,
      EssayQuestion.word_limit,
      EssayQuestion.total_score,
      EssayQuestion.created_at,
    ]

  class SubmissionAdmin(_BaseView, model=EssaySubmission):
    column_searchable_list = [EssaySubmission.id, EssaySubmission.user_id, EssaySubmission.question_id]
    column_sortable_list = [EssaySubmission.created_at, EssaySubmission.ocr_status, EssaySubmission.grade_status]
    column_list = [
      EssaySubmission.id,
      EssaySubmission.user_id,
      EssaySubmission.question_id,
      EssaySubmission.ocr_status,
      EssaySubmission.grade_status,
      EssaySubmission.created_at,
    ]

  class GradeAdmin(_BaseView, model=EssayGrade):
    column_searchable_list = [EssayGrade.id, EssayGrade.submission_id]
    column_sortable_list = [EssayGrade.total_score, EssayGrade.created_at]
    column_list = [
      EssayGrade.id,
      EssayGrade.submission_id,
      EssayGrade.total_score,
      EssayGrade.content_score,
      EssayGrade.structure_score,
      EssayGrade.expression_score,
      EssayGrade.created_at,
    ]

  admin.add_view(UserAdmin)
  admin.add_view(SessionAdmin)
  admin.add_view(VerificationCodeAdmin)
  admin.add_view(QuestionAdmin)
  admin.add_view(SubmissionAdmin)
  admin.add_view(GradeAdmin)
