import re
import datetime
import os
import secrets

from .db import get_conn
from .utils import now_iso, today_utc_date_str, new_uuid, new_token
from .security import new_salt, hash_password, verify_password
from .email_service import send_code_email
from config import get_daily_check_limit


EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _ok(**kwargs):
  return {"success": True, **kwargs}


def _fail(msg: str):
  return {"success": False, "error": msg}


def _require_email(email: str):
  if not email:
    raise Exception("邮箱不能为空")
  if not EMAIL_RE.match(email):
    raise Exception("请输入有效的邮箱地址")


def _get_user_by_token(conn, token: str):
  if not token:
    return None
  row = conn.execute(
    "SELECT s.token, s.expires_at, u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?",
    (token,),
  ).fetchone()
  if not row:
    return None
  expires_at = row["expires_at"]
  try:
    if datetime.datetime.fromisoformat(expires_at.replace("Z", "+00:00")) < datetime.datetime.now(datetime.timezone.utc):
      conn.execute("DELETE FROM sessions WHERE token=?", (token,))
      return None
  except Exception:
    # If parsing fails, consider invalid.
    conn.execute("DELETE FROM sessions WHERE token=?", (token,))
    return None
  return row


def send_verification_code(email: str):
  _require_email(email)
  code = f"{secrets.randbelow(900000) + 100000:06d}"
  expires = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)).isoformat()
  created = now_iso()

  if str(os.environ.get("SMTP_DISABLED", "")).strip() == "1":
    return _fail("SMTP_DISABLED=1：后端已禁用真实发信（请在 backend/.env 里改为 0）")

  with get_conn() as conn:
    conn.execute(
      "INSERT INTO verification_codes(email, code, expires_at, created_at) VALUES(?,?,?,?) "
      "ON CONFLICT(email) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, created_at=excluded.created_at",
      (email, code, expires, created),
    )

  send_code_email(email, code)
  # Local dev helper: return code directly (avoid email deliverability issues while debugging).
  if str(os.environ.get("DEV_RETURN_CODE", "")).strip() == "1":
    return _ok(message="验证码已发送", code=code)
  return _ok(message="验证码已发送")


def verify_code_only(email: str, code: str):
  _require_email(email)
  if not code:
    return _fail("验证码不能为空")

  with get_conn() as conn:
    row = conn.execute("SELECT * FROM verification_codes WHERE email=?", (email,)).fetchone()
    if not row:
      return _fail("验证码不存在或已过期")

    expires_at = row["expires_at"]
    try:
      if datetime.datetime.fromisoformat(expires_at.replace("Z", "+00:00")) < datetime.datetime.now(datetime.timezone.utc):
        conn.execute("DELETE FROM verification_codes WHERE email=?", (email,))
        return _fail("验证码已过期")
    except Exception:
      conn.execute("DELETE FROM verification_codes WHERE email=?", (email,))
      return _fail("验证码已过期")

    if str(row["code"]) != str(code):
      return _fail("验证码错误")

  return _ok(message="验证成功")


def _create_session(conn, user_id: str):
  token = new_token()
  expires = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)).isoformat()
  conn.execute(
    "INSERT INTO sessions(token, user_id, expires_at, created_at) VALUES(?,?,?,?)",
    (token, user_id, expires, now_iso()),
  )
  return token


def register_user(email: str, password: str, code: str):
  _require_email(email)
  if not password or len(password) < 6:
    return _fail("密码至少需要 6 位")

  v = verify_code_only(email, code)
  if not v.get("success"):
    return v

  with get_conn() as conn:
    existed = conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
    if existed:
      return _fail("该邮箱已被注册")

    salt = new_salt()
    pw_hash = hash_password(password, salt)
    user_id = new_uuid()
    daily_limit = get_daily_check_limit()
    conn.execute(
      "INSERT INTO users(id, email, password_salt, password_hash, daily_check_count, daily_check_limit, last_check_date, created_at) "
      "VALUES(?,?,?,?,?,?,?,?)",
      (user_id, email, salt, pw_hash, 0, daily_limit, today_utc_date_str(), now_iso()),
    )
    conn.execute("DELETE FROM verification_codes WHERE email=?", (email,))
    session_token = _create_session(conn, user_id)

    user = conn.execute(
      "SELECT id, email, daily_check_count, daily_check_limit, last_check_date, created_at FROM users WHERE id=?",
      (user_id,),
    ).fetchone()

  return _ok(message="注册成功", user=dict(user), sessionToken=session_token)


def login_user(email: str, password: str):
  _require_email(email)
  if not password:
    return _fail("密码不能为空")

  with get_conn() as conn:
    user = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user:
      return _fail("用户不存在")
    if not verify_password(password, user["password_salt"], user["password_hash"]):
      return _fail("密码错误")
    configured_limit = get_daily_check_limit()
    try:
      if int(user["daily_check_limit"] or 0) != configured_limit:
        conn.execute("UPDATE users SET daily_check_limit=? WHERE id=?", (configured_limit, user["id"]))
        user = conn.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
    except Exception:
      pass
    session_token = _create_session(conn, user["id"])
    info = {
      "id": user["id"],
      "email": user["email"],
      "daily_check_count": user["daily_check_count"],
      "daily_check_limit": user["daily_check_limit"],
      "last_check_date": user["last_check_date"],
      "created_at": user["created_at"],
    }

  return _ok(message="登录成功", user=info, sessionToken=session_token)


def get_user_by_session(session_token: str):
  with get_conn() as conn:
    row = _get_user_by_token(conn, session_token)
    if not row:
      return _fail("未登录或会话已过期")
    configured_limit = get_daily_check_limit()
    try:
      if int(row["daily_check_limit"] or 0) != configured_limit:
        conn.execute("UPDATE users SET daily_check_limit=? WHERE id=?", (configured_limit, row["id"]))
        row = conn.execute("SELECT * FROM users WHERE id=?", (row["id"],)).fetchone()
    except Exception:
      pass
    user = {
      "id": row["id"],
      "email": row["email"],
      "daily_check_count": row["daily_check_count"],
      "daily_check_limit": row["daily_check_limit"],
      "last_check_date": row["last_check_date"],
      "created_at": row["created_at"],
    }
    return _ok(user=user)


def _refresh_daily_if_needed(conn, user_id: str):
  today = today_utc_date_str()
  row = conn.execute("SELECT daily_check_count, daily_check_limit, last_check_date FROM users WHERE id=?", (user_id,)).fetchone()
  if not row:
    raise Exception("用户不存在")
  configured_limit = get_daily_check_limit()
  last_date = row["last_check_date"] or ""
  if last_date != today:
    conn.execute(
      "UPDATE users SET daily_check_count=0, daily_check_limit=?, last_check_date=? WHERE id=?",
      (configured_limit, today, user_id),
    )
    return 0, configured_limit

  current_limit = int(row["daily_check_limit"] or 0)
  if current_limit != configured_limit:
    conn.execute("UPDATE users SET daily_check_limit=? WHERE id=?", (configured_limit, user_id))
    current_limit = configured_limit

  return int(row["daily_check_count"]), current_limit


def check_daily_limit(session_token: str):
  with get_conn() as conn:
    row = _get_user_by_token(conn, session_token)
    if not row:
      return _fail("未登录或会话已过期")
    count, limit = _refresh_daily_if_needed(conn, row["id"])
    return _ok(allowed=(count < limit))


def increment_daily_check(session_token: str):
  with get_conn() as conn:
    row = _get_user_by_token(conn, session_token)
    if not row:
      return _fail("未登录或会话已过期")
    count, limit = _refresh_daily_if_needed(conn, row["id"])
    if count >= limit:
      return _ok(allowed=False, message="超过每日限制")
    conn.execute("UPDATE users SET daily_check_count = daily_check_count + 1 WHERE id=?", (row["id"],))
    user = conn.execute(
      "SELECT id, email, daily_check_count, daily_check_limit, last_check_date, created_at FROM users WHERE id=?",
      (row["id"],),
    ).fetchone()
    return _ok(allowed=True, user=dict(user))
