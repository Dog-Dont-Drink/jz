import json
import os

try:
    from pathlib import Path
    from dotenv import load_dotenv

    # Always load backend/.env regardless of where uvicorn is started from.
    backend_env = Path(__file__).with_name(".env")
    project_env = Path(__file__).resolve().parents[1] / ".env"
    if backend_env.exists():
        load_dotenv(dotenv_path=str(backend_env), override=False)
    # Also load project root .env (for local dev / compatibility), without overriding existing vars.
    if project_env.exists():
        load_dotenv(dotenv_path=str(project_env), override=False)
    # Fallback: search current working directory and parents.
    load_dotenv(override=False)
except Exception:
    pass

from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.responses import RedirectResponse

from services.db import init_db
from services.seed import seed_questions_if_empty
from services.auth import (
    send_verification_code,
    verify_code_only,
    register_user,
    login_user,
    get_user_by_session,
    check_daily_limit,
    increment_daily_check,
)
from services.questions import list_questions, get_question_by_identifier
from services.submissions import (
    create_submission,
    get_submission,
    list_submissions,
    update_final_text,
    grade_submission,
)
from services.ocr import ocr_via_llm
from services.email_service import test_smtp_connection
from services.admin_panel import setup_admin_panel


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Admin panel (SQLAdmin) mounted at /admin
setup_admin_panel(app)


@app.get("/admin")
async def admin_root_redirect():
    # SQLAdmin is mounted at /admin and expects a trailing slash.
    return RedirectResponse(url="/admin/")


def _json(data=None, status_code: int = 200):
    return JSONResponse(
        status_code=status_code,
        content=data if data is not None else {},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
    )


async def read_json_body(request: Request) -> dict:
    raw = await request.body()
    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return {}


@app.on_event("startup")
def _startup():
    init_db()
    seed_questions_if_empty()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/debug/smtp")
async def api_debug_smtp():
    if str(os.environ.get("SMTP_DEBUG_ENDPOINT", "")).strip() != "1":
        return _json({"success": False, "error": "Disabled. Set SMTP_DEBUG_ENDPOINT=1 to enable."}, 403)
    return _json(test_smtp_connection())


@app.options("/{path:path}")
async def options_handler(path: str):
    return _json({}, 204)


@app.post("/api/send-verification-code")
async def api_send_verification_code(request: Request):
    payload = await read_json_body(request)
    email = str(payload.get("email") or "").strip()
    return _json(send_verification_code(email))


@app.post("/api/verify-code")
async def api_verify_code(request: Request):
    payload = await read_json_body(request)
    email = str(payload.get("email") or "").strip()
    code = str(payload.get("code") or "").strip()
    return _json(verify_code_only(email, code))


@app.post("/api/register")
async def api_register(request: Request):
    payload = await read_json_body(request)
    email = str(payload.get("email") or "").strip()
    password = str(payload.get("password") or "")
    code = str(payload.get("verificationCode") or payload.get("code") or "").strip()
    return _json(register_user(email, password, code))


@app.post("/api/login")
async def api_login(request: Request):
    payload = await read_json_body(request)
    email = str(payload.get("email") or "").strip()
    password = str(payload.get("password") or "")
    return _json(login_user(email, password))


@app.post("/api/me")
async def api_me(request: Request):
    payload = await read_json_body(request)
    token = str(payload.get("sessionToken") or "").strip()
    return _json(get_user_by_session(token))


@app.post("/api/user/check-daily-limit")
async def api_check_daily_limit(request: Request):
    payload = await read_json_body(request)
    token = str(payload.get("sessionToken") or "").strip()
    return _json(check_daily_limit(token))


@app.post("/api/user/increment-daily-check")
async def api_increment_daily_check(request: Request):
    payload = await read_json_body(request)
    token = str(payload.get("sessionToken") or "").strip()
    return _json(increment_daily_check(token))


@app.post("/api/questions/list")
async def api_questions_list(request: Request):
    payload = await read_json_body(request)
    filters = payload.get("filters") or payload
    return _json({"success": True, "data": list_questions(filters or {})})


@app.post("/api/questions/get")
async def api_questions_get(request: Request):
    payload = await read_json_body(request)
    identifier = str(payload.get("identifier") or payload.get("id") or "").strip()
    return _json({"success": True, "data": get_question_by_identifier(identifier)})


@app.post("/api/submissions/create")
async def api_submissions_create(request: Request):
    payload = await read_json_body(request)
    token = str(payload.get("sessionToken") or "").strip()
    qid = str(payload.get("questionIdentifier") or payload.get("questionId") or "").strip()
    return _json({"success": True, "data": create_submission(token, qid)})


@app.post("/api/submissions/get")
async def api_submissions_get(request: Request):
    payload = await read_json_body(request)
    token = str(payload.get("sessionToken") or "").strip()
    sid = str(payload.get("submissionId") or "").strip()
    return _json({"success": True, "data": get_submission(token, sid)})


@app.post("/api/submissions/list")
async def api_submissions_list(request: Request):
    payload = await read_json_body(request)
    token = str(payload.get("sessionToken") or "").strip()
    return _json({"success": True, "data": list_submissions(token)})


@app.post("/api/submissions/update-final")
async def api_submissions_update_final(request: Request):
    payload = await read_json_body(request)
    token = str(payload.get("sessionToken") or "").strip()
    sid = str(payload.get("submissionId") or "").strip()
    final_text = str(payload.get("finalText") or "")
    return _json({"success": True, "data": update_final_text(token, sid, final_text)})


@app.post("/api/submissions/grade")
async def api_submissions_grade(request: Request):
    payload = await read_json_body(request)
    token = str(payload.get("sessionToken") or "").strip()
    sid = str(payload.get("submissionId") or "").strip()
    return _json(grade_submission(token, sid))


@app.post("/api/ocr/llm")
async def api_ocr_llm(file: UploadFile = File(...)):
    text = await ocr_via_llm(file)
    return _json({"success": True, "text": text})


@app.exception_handler(Exception)
async def all_exception_handler(_request: Request, exc: Exception):
    return _json({"success": False, "error": str(exc)}, 500)
