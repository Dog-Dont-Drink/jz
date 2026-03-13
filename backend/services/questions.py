import json
import re
from typing import Any, Dict, List

from .db import get_conn
from .utils import is_uuid


def _row_to_question(row):
  scoring_points = []
  try:
    scoring_points = json.loads(row["scoring_points"] or "[]")
  except Exception:
    scoring_points = []

  answer_outline = row["answer_outline"]
  if isinstance(answer_outline, str):
    s = answer_outline.strip()
    if s.startswith("[") or s.startswith("{"):
      try:
        answer_outline = json.loads(s)
      except Exception:
        answer_outline = row["answer_outline"]

  source_meta = None
  try:
    raw_meta = row["source_meta"]
    if raw_meta:
      source_meta = json.loads(raw_meta)
  except Exception:
    source_meta = row["source_meta"] if "source_meta" in row.keys() else None

  return {
    "id": row["id"],
    "date_tag": row["date_tag"],
    "exercise_no": row["exercise_no"],
    "title": row["title"],
    "category": row["category"],
    "question_text": row["question_text"],
    "requirements": row["requirements"],
    "word_limit": row["word_limit"],
    "material_text": row["material_text"],
    "standard_answer": row["standard_answer"],
    "answer_outline": answer_outline,
    "scoring_points": scoring_points,
    "total_score": row["total_score"],
    "source": row["source"],
    "source_meta": source_meta,
    "created_at": row["created_at"],
  }


def list_questions(filters: Dict[str, Any]) -> List[Dict[str, Any]]:
  date_tag = str(filters.get("date_tag") or "").strip()
  source = str(filters.get("source") or "").strip()
  category = str(filters.get("category") or "").strip()
  search = str(filters.get("search") or "").strip()

  where = []
  args = []
  if date_tag:
    where.append("date_tag = ?")
    args.append(date_tag)
  if source:
    where.append("source = ?")
    args.append(source)
  if category:
    where.append("category = ?")
    args.append(category)
  if search:
    where.append("title LIKE ?")
    args.append(f"%{search}%")

  sql = "SELECT * FROM essay_questions"
  if where:
    sql += " WHERE " + " AND ".join(where)
  sql += " ORDER BY created_at DESC"

  with get_conn() as conn:
    rows = conn.execute(sql, tuple(args)).fetchall()
    return [_row_to_question(r) for r in rows]


def _parse_composite(identifier: str):
  # junzhuan_YYYY_MM_DD_N / guokao_YYYY_MM_DD_N / YYYY_MM_DD_N
  m = re.match(r"^([a-zA-Z]+)_(\d{4})_(\d{2})_(\d{2})_(\d+)$", identifier)
  if m:
    prefix, yyyy, mm, dd, ex = m.groups()
    date_tag = f"{yyyy}-{mm}-{dd}"
    ex_no = int(ex)
    source_candidates = None
    p = prefix.lower()
    if p == "junzhuan":
      source_candidates = ["军转", "军转课后作业"]
    elif p == "guokao":
      source_candidates = ["国考"]
    return date_tag, ex_no, source_candidates
  m = re.match(r"^(\d{4})_(\d{2})_(\d{2})_(\d+)$", identifier)
  if m:
    yyyy, mm, dd, ex = m.groups()
    return f"{yyyy}-{mm}-{dd}", int(ex), None
  return None


def get_question_by_identifier(identifier: str) -> Dict[str, Any]:
  if not identifier:
    raise Exception("题目标识不能为空")

  with get_conn() as conn:
    if is_uuid(identifier):
      row = conn.execute("SELECT * FROM essay_questions WHERE id=?", (identifier,)).fetchone()
      if not row:
        raise Exception(f"题目不存在：id={identifier}")
      return _row_to_question(row)

    # Prefer direct code match
    row = conn.execute("SELECT * FROM essay_questions WHERE code=?", (identifier,)).fetchone()
    if row:
      return _row_to_question(row)

    parsed = _parse_composite(identifier)
    if not parsed:
      raise Exception(f"题目标识不合法：{identifier}")
    date_tag, ex_no, source_candidates = parsed

    if source_candidates:
      for s in source_candidates:
        row = conn.execute(
          "SELECT * FROM essay_questions WHERE date_tag=? AND exercise_no=? AND source=? LIMIT 2",
          (date_tag, ex_no, s),
        ).fetchall()
        if len(row) == 1:
          return _row_to_question(row[0])
        if len(row) > 1:
          raise Exception("题目不唯一，请检查数据重复")

    rows = conn.execute(
      "SELECT * FROM essay_questions WHERE date_tag=? AND exercise_no=? LIMIT 2",
      (date_tag, ex_no),
    ).fetchall()
    if len(rows) == 1:
      return _row_to_question(rows[0])
    if len(rows) > 1:
      raise Exception("题目不唯一，请检查数据重复")

  raise Exception("题目不存在")
