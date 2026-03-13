import os
import smtplib
from email.mime.text import MIMEText


def _env_bool(value: str, default: bool) -> bool:
  if value is None:
    return default
  v = str(value).strip().lower()
  if v in ("1", "true", "yes", "y", "on"):
    return True
  if v in ("0", "false", "no", "n", "off"):
    return False
  return default


def _mask_email(email: str) -> str:
  if not email or "@" not in email:
    return ""
  name, domain = email.split("@", 1)
  if len(name) <= 2:
    return f"{name[:1]}***@{domain}"
  return f"{name[:2]}***@{domain}"


def _read_smtp_config():
  host = (os.environ.get("SMTP_HOST") or os.environ.get("SMTP_SERVER") or "smtp.163.com").strip()
  port = int(str(os.environ.get("SMTP_PORT") or "465").strip())
  secure_default = port in (465, 994)
  secure = _env_bool(os.environ.get("SMTP_SECURE"), secure_default)
  user = (os.environ.get("SMTP_USER") or os.environ.get("VITE_EMAIL_USER") or "").strip()
  password = (os.environ.get("SMTP_PASS") or os.environ.get("SMTP_PASSWORD") or os.environ.get("VITE_EMAIL_PASSWORD") or "").strip()
  sender = (os.environ.get("SMTP_FROM") or user).strip()
  debug = str(os.environ.get("SMTP_DEBUG", "")).strip() == "1"
  return {"host": host, "port": port, "secure": secure, "user": user, "password": password, "sender": sender, "debug": debug}


def test_smtp_connection() -> dict:
  if str(os.environ.get("SMTP_DISABLED", "")).strip() == "1":
    return {"success": False, "error": "SMTP_DISABLED=1"}

  cfg = _read_smtp_config()
  if not cfg["user"] or not cfg["password"] or not cfg["sender"]:
    return {
      "success": False,
      "error": "SMTP not configured (missing user/password/sender)",
      "smtp": {"host": cfg["host"], "port": cfg["port"], "secure": cfg["secure"], "user": _mask_email(cfg["user"])},
    }

  try:
    if cfg["secure"]:
      with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=20) as smtp:
        if cfg["debug"]:
          smtp.set_debuglevel(1)
        smtp.login(cfg["user"], cfg["password"])
        smtp.noop()
    else:
      with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as smtp:
        smtp.ehlo()
        smtp.starttls()
        if cfg["debug"]:
          smtp.set_debuglevel(1)
        smtp.login(cfg["user"], cfg["password"])
        smtp.noop()
    return {"success": True, "message": "SMTP connect+login OK", "smtp": {"host": cfg["host"], "port": cfg["port"], "secure": cfg["secure"], "user": _mask_email(cfg["user"])}}
  except Exception as e:
    return {"success": False, "error": str(e), "smtp": {"host": cfg["host"], "port": cfg["port"], "secure": cfg["secure"], "user": _mask_email(cfg["user"])}}


def send_code_email(to_email: str, code: str) -> None:
  if str(os.environ.get("SMTP_DISABLED", "")).strip() == "1":
    # Local dev / debugging: skip SMTP send.
    return

  cfg = _read_smtp_config()
  host, port, secure, user, password, sender, debug = (
    cfg["host"],
    cfg["port"],
    cfg["secure"],
    cfg["user"],
    cfg["password"],
    cfg["sender"],
    cfg["debug"],
  )
  if not user or not password or not sender:
    raise Exception(
      "SMTP not configured: set SMTP_USER + SMTP_PASS (or SMTP_PASSWORD) + SMTP_FROM (optional). "
      "Also accepts VITE_EMAIL_USER/VITE_EMAIL_PASSWORD for compatibility (not recommended for production)."
    )

  html = f"""
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>申论批改系统 - 验证码</h2>
    <p>您的验证码是：</p>
    <div style="font-size: 32px; letter-spacing: 6px; font-weight: 700;">{code}</div>
    <p style="color: #666;">验证码有效期为 5 分钟，请尽快使用。</p>
    <p style="color: #999; font-size: 12px;">如果这不是您的操作，请忽略此邮件。</p>
  </div>
  """.strip()

  msg = MIMEText(html, "html", "utf-8")
  msg["Subject"] = "申论批改系统 - 验证码"
  msg["From"] = sender
  msg["To"] = to_email

  if secure:
    with smtplib.SMTP_SSL(host, port, timeout=20) as smtp:
      if debug:
        smtp.set_debuglevel(1)
      smtp.login(user, password)
      refused = smtp.sendmail(sender, [to_email], msg.as_string())
      if refused:
        raise Exception(f"SMTP refused recipients: {refused}")
  else:
    with smtplib.SMTP(host, port, timeout=20) as smtp:
      smtp.ehlo()
      smtp.starttls()
      if debug:
        smtp.set_debuglevel(1)
      smtp.login(user, password)
      refused = smtp.sendmail(sender, [to_email], msg.as_string())
      if refused:
        raise Exception(f"SMTP refused recipients: {refused}")

  if debug:
    print(
      "[SMTP] sent verification code email",
      {"host": host, "port": port, "secure": secure, "from": _mask_email(sender), "to": _mask_email(to_email)},
    )
