import json
from .db import get_conn
from .utils import now_iso, new_uuid


SEED_QUESTIONS = [
  {
    "code": "guokao_2024_01_01_01",
    "date_tag": "2024-01-01",
    "exercise_no": 1,
    "title": "归纳概括：概括当前基层治理面临的主要问题",
    "category": "归纳概括",
    "question_text": "根据给定资料，概括当前基层治理面临的主要问题。",
    "requirements": "要求：全面、准确、简明，不超过 200 字。",
    "word_limit": 200,
    "material_text": "（略）",
    "standard_answer": "基层治理面临人员不足、行政事务繁重、居民参与度低、上级层层加码、资源分散、信息化水平低、诉求渠道不畅、人才流失等问题。",
    "answer_outline": None,
    "scoring_points": [
      {"point": "人员配置不足", "score": 2},
      {"point": "行政事务繁重", "score": 2},
      {"point": "居民参与度低", "score": 2},
      {"point": "上级层层加码、考核检查多", "score": 3},
      {"point": "资源分散、缺乏统筹", "score": 2},
      {"point": "信息化水平低、数据孤岛", "score": 2},
      {"point": "诉求渠道不畅、回应不及时", "score": 2},
      {"point": "待遇偏低、人才流失", "score": 2},
    ],
    "total_score": 17,
    "source": "国考",
  },
  {
    "code": "junzhuan_2026_03_10_01",
    "date_tag": "2026-03-10",
    "exercise_no": 1,
    "title": "概括S市建设美丽水系、打造优美环境的主要措施",
    "category": "概括题",
    "question_text": "根据给定资料1，概括S市为建设美丽水系、打造优美环境实施了哪些主要措施？",
    "requirements": "要求：（1）分条归纳概括；（2）表述准确、完整；（3）不超过150字。",
    "word_limit": 150,
    "material_text": "（略）",
    "standard_answer": "提升绿化水平、完善照明设施、完善服务设施、加强安全监管等。",
    "answer_outline": None,
    "scoring_points": [],
    "total_score": 20,
    "source": "军转课后作业",
  },
]


def seed_questions_if_empty():
  with get_conn() as conn:
    row = conn.execute("SELECT COUNT(1) AS c FROM essay_questions").fetchone()
    if row and int(row["c"]) > 0:
      return
    created = now_iso()
    for q in SEED_QUESTIONS:
      qid = new_uuid()
      conn.execute(
        """
        INSERT INTO essay_questions(
          id, code, date_tag, exercise_no, title, category, question_text, requirements, word_limit,
          material_text, standard_answer, answer_outline, scoring_points, total_score, source, created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
          qid,
          q.get("code"),
          q.get("date_tag"),
          q.get("exercise_no"),
          q.get("title"),
          q.get("category"),
          q.get("question_text"),
          q.get("requirements"),
          q.get("word_limit"),
          q.get("material_text"),
          q.get("standard_answer"),
          q.get("answer_outline"),
          json.dumps(q.get("scoring_points") or [], ensure_ascii=False),
          int(q.get("total_score") or 100),
          q.get("source"),
          created,
        ),
      )

