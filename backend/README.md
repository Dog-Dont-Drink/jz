# FastAPI + SQLite 后端

功能：
- 用户注册/登录（SQLite session token）
- 邮箱验证码（163 SMTP）
- 题库/提交/评分（调用 OpenAI 兼容大模型 API）

## 运行

```bash
cd essay-grading-system/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export APP_DB_PATH=./data/app.db
export SMTP_HOST=smtp.163.com
export SMTP_PORT=465
export SMTP_USER=your@163.com
export SMTP_PASS=your_smtp_auth_code
export SMTP_FROM=your@163.com
export LLM_BASE_URL=https://api.openai.com/v1
export LLM_API_KEY=...
export LLM_MODEL=gpt-4o-mini

uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

说明：
- `SMTP_PASS` 也支持旧变量名 `SMTP_PASSWORD`（兼容用）。
- `SMTP_HOST` 也支持旧变量名 `SMTP_SERVER`（兼容用）。

## 接口约定（前端使用）

所有 JSON POST 都支持 `Content-Type: text/plain`（避免移动端预检），请求体仍是 JSON 字符串。

- `POST /api/send-verification-code` `{ "email": "..." }`
- `POST /api/verify-code` `{ "email": "...", "code": "123456" }`
- `POST /api/register` `{ "email": "...", "password": "...", "verificationCode": "123456" }`
- `POST /api/login` `{ "email": "...", "password": "..." }`
- `POST /api/me` `{ "sessionToken": "..." }`
- `POST /api/questions/list` `{ filters... }`
- `POST /api/questions/get` `{ "identifier": "uuid or junzhuan_2026_03_12_05" }`
- `POST /api/submissions/create` `{ "sessionToken": "...", "questionIdentifier": "..." }`
- `POST /api/submissions/get` `{ "sessionToken": "...", "submissionId": "..." }`
- `POST /api/submissions/list` `{ "sessionToken": "..." }`
- `POST /api/submissions/update-final` `{ "sessionToken": "...", "submissionId": "...", "finalText": "..." }`
- `POST /api/submissions/grade` `{ "sessionToken": "...", "submissionId": "..." }`
- `POST /api/ocr/llm` multipart/form-data：`file=<image>`

调试：
- `POST /api/debug/smtp`（需设置 `SMTP_DEBUG_ENDPOINT=1`）用于测试 SMTP 连接与登录是否正常，不会发邮件。
