import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


def db_path() -> str:
  raw = str(os.environ.get("APP_DB_PATH", "") or "").strip()

  backend_dir = Path(__file__).resolve().parents[1]  # backend/
  default_path = backend_dir / "data" / "app.db"

  if not raw:
    return str(default_path)

  p = Path(raw).expanduser()
  if p.is_dir() or str(raw).endswith("/") or str(raw).endswith("\\"):
    p = p / "app.db"
  if not p.is_absolute():
    # Treat relative APP_DB_PATH as relative to backend/ (not current working dir)
    p = backend_dir / p
  return str(p)


def init_db() -> None:
  path = db_path()
  os.makedirs(os.path.dirname(path), exist_ok=True)
  with sqlite3.connect(path) as conn:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        daily_check_count INTEGER NOT NULL DEFAULT 0,
        daily_check_limit INTEGER NOT NULL DEFAULT 2,
        last_check_date TEXT,
        created_at TEXT NOT NULL
      );
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS verification_codes (
        email TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS essay_questions (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        date_tag TEXT,
        exercise_no INTEGER,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        question_text TEXT,
        requirements TEXT,
        word_limit INTEGER,
        material_text TEXT,
        standard_answer TEXT,
        answer_outline TEXT,
        scoring_points TEXT NOT NULL DEFAULT '[]',
        total_score INTEGER NOT NULL DEFAULT 100,
        source TEXT,
        source_meta TEXT,
        created_at TEXT NOT NULL
      );
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS essay_submissions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        image_path TEXT,
        ocr_text TEXT,
        final_user_text TEXT NOT NULL DEFAULT '',
        ocr_status TEXT NOT NULL DEFAULT 'pending',
        grade_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(question_id) REFERENCES essay_questions(id) ON DELETE CASCADE
      );
      """
    )

    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS essay_grades (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL UNIQUE,
        total_score INTEGER NOT NULL DEFAULT 0,
        content_score INTEGER NOT NULL DEFAULT 0,
        structure_score INTEGER NOT NULL DEFAULT 0,
        expression_score INTEGER NOT NULL DEFAULT 0,
        matched_points TEXT NOT NULL DEFAULT '[]',
        missed_points TEXT NOT NULL DEFAULT '[]',
        deduction_points TEXT NOT NULL DEFAULT '[]',
        overall_feedback TEXT,
        improvement_suggestions TEXT NOT NULL DEFAULT '[]',
        raw_model_output TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(submission_id) REFERENCES essay_submissions(id) ON DELETE CASCADE
      );
      """
    )

    # Backward-compatible migrations for older DBs.
    try:
      conn.execute("ALTER TABLE essay_questions ADD COLUMN source_meta TEXT;")
    except Exception:
      pass


@contextmanager
def get_conn():
  path = db_path()
  os.makedirs(os.path.dirname(path), exist_ok=True)
  conn = sqlite3.connect(path)
  conn.row_factory = sqlite3.Row
  try:
    conn.execute("PRAGMA foreign_keys=ON;")
    yield conn
    conn.commit()
  finally:
    conn.close()
