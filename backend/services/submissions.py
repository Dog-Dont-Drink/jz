import json
import os
import re
from .db import get_conn
from .utils import now_iso, new_uuid
from .auth import _get_user_by_token, _refresh_daily_if_needed
from .questions import get_question_by_identifier
from .llm_service import chat_completions


def _row_to_submission(row):
  return {
    "id": row["id"],
    "user_id": row["user_id"],
    "question_id": row["question_id"],
    "image_path": row["image_path"],
    "ocr_text": row["ocr_text"],
    "final_user_text": row["final_user_text"],
    "ocr_status": row["ocr_status"],
    "grade_status": row["grade_status"],
    "created_at": row["created_at"],
  }


def _row_to_grade(row):
  def j(field, default="[]"):
    try:
      return json.loads(row[field] or default)
    except Exception:
      return json.loads(default)

  return {
    "id": row["id"],
    "submission_id": row["submission_id"],
    "total_score": row["total_score"],
    "content_score": row["content_score"],
    "structure_score": row["structure_score"],
    "expression_score": row["expression_score"],
    "matched_points": j("matched_points"),
    "missed_points": j("missed_points"),
    "deduction_points": j("deduction_points"),
    "overall_feedback": row["overall_feedback"],
    "improvement_suggestions": j("improvement_suggestions"),
    "raw_model_output": j("raw_model_output", default="{}") if row["raw_model_output"] else None,
    "created_at": row["created_at"],
  }


def create_submission(session_token: str, question_identifier: str):
  if not question_identifier:
    raise Exception("questionIdentifier is required")

  with get_conn() as conn:
    user_row = _get_user_by_token(conn, session_token)
    if not user_row:
      raise Exception("未登录或会话已过期")

    q = get_question_by_identifier(question_identifier)
    sid = new_uuid()
    conn.execute(
      """
      INSERT INTO essay_submissions(id, user_id, question_id, image_path, ocr_text, final_user_text, ocr_status, grade_status, created_at)
      VALUES(?,?,?,?,?,?,?,?,?)
      """,
      (sid, user_row["id"], q["id"], None, None, "", "completed", "pending", now_iso()),
    )
    row = conn.execute("SELECT * FROM essay_submissions WHERE id=?", (sid,)).fetchone()
    return _row_to_submission(row)


def update_final_text(session_token: str, submission_id: str, final_text: str):
  with get_conn() as conn:
    user_row = _get_user_by_token(conn, session_token)
    if not user_row:
      raise Exception("未登录或会话已过期")
    row = conn.execute("SELECT * FROM essay_submissions WHERE id=? AND user_id=?", (submission_id, user_row["id"])).fetchone()
    if not row:
      raise Exception("提交不存在")
    conn.execute("UPDATE essay_submissions SET final_user_text=? WHERE id=?", (final_text, submission_id))
    row2 = conn.execute("SELECT * FROM essay_submissions WHERE id=?", (submission_id,)).fetchone()
    return _row_to_submission(row2)


def get_submission(session_token: str, submission_id: str):
  with get_conn() as conn:
    user_row = _get_user_by_token(conn, session_token)
    if not user_row:
      raise Exception("未登录或会话已过期")
    row = conn.execute("SELECT * FROM essay_submissions WHERE id=? AND user_id=?", (submission_id, user_row["id"])).fetchone()
    if not row:
      raise Exception("提交不存在")
    q = conn.execute("SELECT * FROM essay_questions WHERE id=?", (row["question_id"],)).fetchone()
    g = conn.execute("SELECT * FROM essay_grades WHERE submission_id=?", (submission_id,)).fetchone()
    data = _row_to_submission(row)
    if q:
      from .questions import _row_to_question
      data["question"] = _row_to_question(q)
    if g:
      data["grade"] = _row_to_grade(g)
    return data


def list_submissions(session_token: str):
  with get_conn() as conn:
    user_row = _get_user_by_token(conn, session_token)
    if not user_row:
      raise Exception("未登录或会话已过期")
    rows = conn.execute(
      "SELECT * FROM essay_submissions WHERE user_id=? ORDER BY created_at DESC",
      (user_row["id"],),
    ).fetchall()
    out = []
    for r in rows:
      item = _row_to_submission(r)
      q = conn.execute("SELECT id, title, total_score FROM essay_questions WHERE id=?", (r["question_id"],)).fetchone()
      if q:
        item["question"] = {"id": q["id"], "title": q["title"], "total_score": q["total_score"]}
      g = conn.execute("SELECT total_score, overall_feedback FROM essay_grades WHERE submission_id=?", (r["id"],)).fetchone()
      if g:
        item["grade"] = {"total_score": g["total_score"], "overall_feedback": g["overall_feedback"]}
      out.append(item)
    return out


PROMPT_TEMPLATE = """你是一名资深公务员考试申论阅卷助手，请根据\"题目要求、材料信息、标准答案、参考得分点、用户答案\"对用户答案进行评分。

评分规则：
1. 不要求逐字逐句照抄标准答案。
2. 只要用户答案与标准答案在核心观点、逻辑含义、关键事实、主要对策上基本一致，即可给分。
3. 允许近义表达、同义改写、概括表达、语序变化、不同措辞。
4. 对不影响理解的少量错别字、语病，可适度宽容，不应重扣。
5. 如果答案覆盖关键得分点较全、逻辑清晰、表达通顺，应给予较高分。
6. 如果存在偏题、遗漏核心点、逻辑混乱、空泛套话过多、与材料明显不符，则扣分。
7. 评分要兼顾：内容准确性、要点完整性、逻辑结构、语言表达。
8. 必须输出严格 JSON，不能输出 Markdown，不能输出额外解释文字。
9. 为避免输出过长被截断：每条 reason 控制在 40 字以内；`overall_feedback` 控制在 120 字以内；`improvement_suggestions` 最多 4 条。

题目信息：
题目：{TITLE}
要求：{PROMPT}
满分：{TOTAL_SCORE}

材料：
{MATERIAL}

标准答案：
{STANDARD_ANSWER}

参考得分点：
{SCORING_POINTS}

用户答案：
{USER_ANSWER}

请严格按以下 JSON 格式输出：
{{
  "total_score": 0,
  "content_score": 0,
  "structure_score": 0,
  "expression_score": 0,
  "matched_points": [{{"point":"得分点","score":0,"reason":"命中原因/依据"}}],
  "missed_points": [{{"point":"漏点","reason":"为什么算漏/对应材料"}}],
  "deduction_points": [{{"issue":"扣分问题","deduct_score":0,"reason":"扣分理由"}}],
  "overall_feedback": "",
  "improvement_suggestions": ["建议1","建议2"]
}}
"""


def _strip_markdown_code_fence(text: str) -> str:
  s = (text or "").strip()
  if not s:
    return ""
  m = re.match(r"^```(?:json)?\\s*([\\s\\S]*?)\\s*```$", s, flags=re.IGNORECASE)
  if m:
    return (m.group(1) or "").strip()
  if s.startswith("```"):
    parts = s.split("\n")
    body = "\n".join(parts[1:]) if len(parts) > 1 else ""
    end = body.rfind("```")
    if end != -1:
      body = body[:end]
    return body.strip()
  return s


def _parse_llm_json(text: str) -> dict:
  """
  Be tolerant to common LLM wrappers like ```json code fences``` or extra text.
  """
  raw = (text or "").strip()
  if not raw:
    raise ValueError("empty response")

  try:
    obj = json.loads(raw)
    if isinstance(obj, dict):
      return obj
  except Exception:
    pass

  cleaned = _strip_markdown_code_fence(raw)
  try:
    obj = json.loads(cleaned)
    if isinstance(obj, dict):
      return obj
  except Exception:
    pass

  start = cleaned.find("{")
  end = cleaned.rfind("}")
  if start != -1 and end != -1 and end > start:
    candidate = cleaned[start : end + 1]
    obj = json.loads(candidate)
    if isinstance(obj, dict):
      return obj

  raise ValueError("not a json object")


def _request_grade_json(prompt: str, grade_model: str | None) -> tuple[dict | None, str]:
  attempts = [
    {
      "prompt": prompt,
      "max_tokens": 2200,
    },
    {
      "prompt": (
        prompt
        + "\n\n上一轮输出可能过长或被截断。请重新输出更精简版本："
        + "每个数组最多 5 项，reason 尽量短，overall_feedback 不超过 100 字，"
        + "improvement_suggestions 最多 4 条。只能输出 JSON 对象本身。"
      ),
      "max_tokens": 1600,
    },
  ]

  last_raw = ""
  for attempt in attempts:
    raw = chat_completions(
      [{"role": "user", "content": attempt["prompt"]}],
      max_tokens=attempt["max_tokens"],
      temperature=0.2,
      response_format={"type": "json_object"},
      model=grade_model,
    )
    last_raw = raw
    try:
      return _parse_llm_json(raw), raw
    except Exception:
      continue

  return None, last_raw


def grade_submission(session_token: str, submission_id: str):
  with get_conn() as conn:
    user_row = _get_user_by_token(conn, session_token)
    if not user_row:
      return {"success": False, "error": "未登录或会话已过期"}

    count, limit = _refresh_daily_if_needed(conn, user_row["id"])
    if count >= limit:
      return {"success": False, "error": "兄弟不要内卷，每天就做两道题！"}

    sub = conn.execute("SELECT * FROM essay_submissions WHERE id=? AND user_id=?", (submission_id, user_row["id"])).fetchone()
    if not sub:
      return {"success": False, "error": "提交不存在"}
    if not (sub["final_user_text"] or "").strip():
      return {"success": False, "error": "用户答案为空"}

    q = conn.execute("SELECT * FROM essay_questions WHERE id=?", (sub["question_id"],)).fetchone()
    if not q:
      return {"success": False, "error": "题目不存在"}

    conn.execute("UPDATE essay_submissions SET grade_status='processing' WHERE id=?", (submission_id,))

    scoring_points = q["scoring_points"] or "[]"
    try:
      scoring_points_json = json.dumps(json.loads(scoring_points), ensure_ascii=False)
    except Exception:
      scoring_points_json = "[]"

    prompt = PROMPT_TEMPLATE.format(
      TITLE=q["title"],
      PROMPT=q["requirements"] or q["question_text"] or "",
      TOTAL_SCORE=q["total_score"],
      MATERIAL=q["material_text"] or "",
      STANDARD_ANSWER=q["standard_answer"] or "",
      SCORING_POINTS=scoring_points_json,
      USER_ANSWER=sub["final_user_text"],
    )

  grade_model = str(os.environ.get("GRADE_LLM_MODEL", "") or "").strip() or None
  result, content = _request_grade_json(prompt, grade_model)
  if result is None:
    return {"success": False, "error": "模型返回非 JSON", "raw": content}

  # Persist grade
  with get_conn() as conn:
    conn.execute("UPDATE users SET daily_check_count = daily_check_count + 1 WHERE id=?", (user_row["id"],))
    gid = new_uuid()
    conn.execute(
      """
      INSERT INTO essay_grades(
        id, submission_id, total_score, content_score, structure_score, expression_score,
        matched_points, missed_points, deduction_points, overall_feedback, improvement_suggestions, raw_model_output, created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(submission_id) DO UPDATE SET
        total_score=excluded.total_score,
        content_score=excluded.content_score,
        structure_score=excluded.structure_score,
        expression_score=excluded.expression_score,
        matched_points=excluded.matched_points,
        missed_points=excluded.missed_points,
        deduction_points=excluded.deduction_points,
        overall_feedback=excluded.overall_feedback,
        improvement_suggestions=excluded.improvement_suggestions,
        raw_model_output=excluded.raw_model_output
      """,
      (
        gid,
        submission_id,
        int(result.get("total_score") or 0),
        int(result.get("content_score") or 0),
        int(result.get("structure_score") or 0),
        int(result.get("expression_score") or 0),
        json.dumps(result.get("matched_points") or [], ensure_ascii=False),
        json.dumps(result.get("missed_points") or [], ensure_ascii=False),
        json.dumps(result.get("deduction_points") or [], ensure_ascii=False),
        str(result.get("overall_feedback") or ""),
        json.dumps(result.get("improvement_suggestions") or [], ensure_ascii=False),
        json.dumps(result, ensure_ascii=False),
        now_iso(),
      ),
    )
    conn.execute("UPDATE essay_submissions SET grade_status='completed' WHERE id=?", (submission_id,))

  return {"success": True, "data": result}
