import datetime
import secrets
import uuid


def now_iso() -> str:
  return datetime.datetime.utcnow().replace(tzinfo=datetime.timezone.utc).isoformat()


def today_utc_date_str() -> str:
  return datetime.datetime.utcnow().date().isoformat()


def new_uuid() -> str:
  return str(uuid.uuid4())


def new_token() -> str:
  return secrets.token_urlsafe(32)


def is_uuid(value: str) -> bool:
  import re
  return bool(re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", value or "", re.I))

