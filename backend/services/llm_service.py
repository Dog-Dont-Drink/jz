import json
import os
import httpx
from urllib.parse import urlparse
import time


def _env(name: str, default: str = "") -> str:
  return str(os.environ.get(name, default) or "").strip()


def _build_chat_completions_url(base_url: str) -> str:
  """
  Accept common variants of OpenAI-compatible base URLs:
  - https://api.openai.com
  - https://api.openai.com/v1
  - https://example.com/v1/chat/completions
  """
  base = (base_url or "").strip().rstrip("/")
  if not base:
    base = "https://api.openai.com/v1"

  if base.endswith("/chat/completions"):
    return base
  if base.endswith("/v1"):
    return f"{base}/chat/completions"

  parsed = urlparse(base)
  path = (parsed.path or "").rstrip("/")
  if not path:
    return f"{base}/v1/chat/completions"
  if path.endswith("/v1"):
    return f"{base}/chat/completions"
  return f"{base}/v1/chat/completions"


def chat_completions(
  messages,
  max_tokens: int = 2000,
  temperature: float = 0.2,
  response_format: dict | None = None,
  model: str | None = None,
) -> str:
  base = _env("LLM_BASE_URL", "https://llm.xiaochisaas.com")
  api_key = _env("LLM_API_KEY")
  model = (model or _env("LLM_MODEL", "claude-opus-4-6-thinking")).strip()
  if not api_key:
    raise Exception("LLM_API_KEY not configured")
  print(f"[LLM] Using base URL: {base}")
  url = _build_chat_completions_url(base)
  payload = {
    "model": model,
    "messages": messages,
    "max_tokens": max_tokens,
    "temperature": temperature,
  }
  if response_format is not None:
    payload["response_format"] = response_format

  if _env("LLM_DEBUG") == "1":
    print("[LLM] request", {"url": url, "model": model, "max_tokens": max_tokens, "temperature": temperature})

  timeout = httpx.Timeout(360.0, connect=10.0, read=120.0, write=120.0)
  last_exc: Exception | None = None
  for attempt in (1, 2):
    try:
      with httpx.Client(timeout=timeout) as client:
        resp = client.post(
          url,
          headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "essay-grading-system-backend/1.0",
          },
          json=payload,
        )
      text = resp.text
      if resp.status_code >= 400:
        if resp.status_code == 404 and "Invalid URL" in text:
          raise Exception(
            "LLM_BASE_URL 可能配置错了（OpenAI 兼容接口通常需要 `/v1` 前缀）。"
            f"当前请求 URL：{url}。"
            "请把 `LLM_BASE_URL` 配成类似 `https://api.openai.com/v1` 或你的网关的 `/v1` 前缀。"
          )
        raise Exception(f"LLM API error {resp.status_code}: {text}")
      data = resp.json()
      content = (((data.get("choices") or [])[0] or {}).get("message") or {}).get("content")
      if not content:
        raise Exception(f"LLM response invalid: {text}")
      return str(content)
    except (
      httpx.RemoteProtocolError,
      httpx.ConnectError,
      httpx.ReadError,
      httpx.WriteError,
      httpx.TimeoutException,
    ) as e:
      last_exc = e
      # Retry once for transient disconnects (common behind gateways/nginx).
      if attempt == 1:
        time.sleep(0.25)
        continue
      raise Exception(
        "LLM 服务连接中断（Server disconnected）或网络超时。"
        f"当前请求 URL：{url}。"
        "请确认：1）`LLM_BASE_URL` 正确且可访问；2）模型支持当前请求（OCR 需要支持图片）；"
        "3）如果是大图 OCR，请继续调小 `OCR_IMAGE_MAX_DIM/OCR_IMAGE_MAX_BYTES`。"
        f"原始错误：{type(e).__name__}: {e}"
      )
    except Exception as e:
      # Non-network error, don't retry.
      raise

  # Should not reach here.
  raise last_exc or Exception("LLM request failed")
