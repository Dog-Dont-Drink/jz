import base64
import io
import os

from .llm_service import chat_completions


def _env_int(name: str, default: int) -> int:
  try:
    return int(str(os.environ.get(name, default)).strip())
  except Exception:
    return default


def _maybe_compress_image(raw: bytes, mime: str) -> tuple[bytes, str]:
  """
  Reduce payload size for LLM vision (avoid 413 from upstream proxies).
  Converts to JPEG and resizes if needed.
  """
  # Many OpenAI-compatible gateways sit behind nginx with 1MB body limit.
  # Base64 adds ~33% overhead, plus JSON wrapper, so keep image bytes small.
  max_bytes = _env_int("OCR_IMAGE_MAX_BYTES", 600_000)  # ~0.6MB default
  max_dim = _env_int("OCR_IMAGE_MAX_DIM", 1280)
  debug = str(os.environ.get("OCR_DEBUG", "")).strip() == "1"
  if len(raw) <= max_bytes:
    return raw, mime

  try:
    from PIL import Image, ImageOps  # type: ignore
  except Exception:
    # If pillow isn't installed, fallback to original bytes.
    return raw, mime

  try:
    img = Image.open(io.BytesIO(raw))
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
      img = img.convert("RGB")

    w, h = img.size
    scale = min(1.0, float(max_dim) / float(max(w, h)))
    if scale < 1.0:
      img = img.resize((int(w * scale), int(h * scale)))

    # Encode as JPEG with decreasing quality until under threshold.
    for quality in (80, 70, 60, 50, 40):
      buf = io.BytesIO()
      img.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
      out = buf.getvalue()
      if len(out) <= max_bytes:
        if debug:
          print("[OCR] compressed image", {"from": len(raw), "to": len(out), "quality": quality, "max_bytes": max_bytes, "max_dim": max_dim})
        return out, "image/jpeg"

    # Still too big: try grayscale which is often smaller yet OK for handwriting OCR.
    try:
      gray = img.convert("L")
      for quality in (70, 60, 50, 40, 30):
        buf = io.BytesIO()
        gray.save(buf, format="JPEG", quality=quality, optimize=True, progressive=True)
        out2 = buf.getvalue()
        if len(out2) <= max_bytes:
          if debug:
            print("[OCR] compressed image (gray)", {"from": len(raw), "to": len(out2), "quality": quality, "max_bytes": max_bytes, "max_dim": max_dim})
          return out2, "image/jpeg"
      out = out2  # smallest attempt
    except Exception:
      pass

    # Still too big, keep the smallest we got.
    if debug:
      print("[OCR] compressed image still large", {"from": len(raw), "to": len(out), "max_bytes": max_bytes, "max_dim": max_dim})
    return out, "image/jpeg"
  except Exception:
    return raw, mime


async def ocr_via_llm(file) -> str:
  raw = await file.read()
  if not raw:
    return ""
  mime = file.content_type or "image/jpeg"
  raw2, mime2 = _maybe_compress_image(raw, mime)
  # If still huge, fail fast to avoid 413 from upstream.
  max_bytes = _env_int("OCR_IMAGE_MAX_BYTES", 600_000)
  if len(raw2) > max_bytes:
    raise Exception(f"OCR 图片过大（{len(raw2)} bytes），请换更小的图片或在 backend/.env 调小 OCR_IMAGE_MAX_DIM / OCR_IMAGE_MAX_BYTES")
  b64 = base64.b64encode(raw2).decode("utf-8")

  messages = [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": (
            "你是一名高精度中文手写文本识别助手。请识别图片中的全部手写文字，并忠实转写原文。\n"
            "要求：只做OCR转写，不做总结、翻译、润色、纠错；保留段落、换行、序号、标点；不确定用【疑似：xxx】；无法辨认用【无法辨认】；输出纯文本。"
          ),
        },
        {"type": "image_url", "image_url": {"url": f"data:{mime2};base64,{b64}"}},
      ],
    }
  ]
  # OCR should return plain text; don't force JSON output format.
  try:
    ocr_model = str(os.environ.get("OCR_LLM_MODEL", "") or "").strip() or "gemini-3-flash"
    return chat_completions(messages, max_tokens=2000, temperature=0.1, response_format=None, model=ocr_model)
  except Exception as e:
    msg = str(e)
    if "LLM API error 413" in msg or "413 Request Entity Too Large" in msg:
      raise Exception(
        "OCR 请求体过大被上游拒绝（413）。请在 `backend/.env` 调小 `OCR_IMAGE_MAX_DIM` / `OCR_IMAGE_MAX_BYTES`，"
        "或上传更小/更清晰的图片（建议单页、裁掉空白边）。"
      )
    # Some gateways/models are text-only and reject image parts.
    if "unknown variant `image_url`" in msg or "unknown variant \"image_url\"" in msg:
      fallback = str(os.environ.get("OCR_FALLBACK_LLM_MODEL", "") or "").strip()
      if fallback:
        return chat_completions(messages, max_tokens=2000, temperature=0.1, response_format=None, model=fallback)
      raise Exception(
        "当前 OCR_LLM_MODEL 可能不支持图片输入（image_url），上游返回不兼容错误。"
        "你可以在 `backend/.env` 设置 `OCR_FALLBACK_LLM_MODEL` 为图片模型（例如 `gemini-3-pro-image`），"
        "或直接把 `OCR_LLM_MODEL` 换成图片模型。"
      )
    raise
