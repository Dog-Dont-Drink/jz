import os


def _get_int(name: str, default: int) -> int:
    raw = str(os.environ.get(name, "") or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except Exception:
        return default


def get_daily_check_limit() -> int:
    """
    Per-user daily grading limit.
    - Controlled via env: DAILY_CHECK_LIMIT
    - Default: 5
    """
    limit = _get_int("DAILY_CHECK_LIMIT", 5)
    # Safety: avoid non-positive values causing weird logic.
    return max(1, limit)

