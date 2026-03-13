# Backend API（FastAPI + SQLite）

统一约定：
- Base URL：`http://127.0.0.1:8000`
- 绝大多数接口使用 `POST`，请求体是 JSON 字符串；前端可用 `Content-Type: text/plain;charset=UTF-8` 发送（避免部分移动端 CORS 预检）。
- 登录态：后端返回 `sessionToken`，前端后续请求需要携带 `sessionToken`（放在 JSON body 里）。

## Health

- `GET /api/health`
  - Resp：`{ "ok": true }`

## 邮箱验证码

- `POST /api/send-verification-code`
  - Body：`{ "email": "xxx@xx.com" }`
  - Resp：`{ "success": true, "message": "验证码已发送" }`

- `POST /api/verify-code`
  - Body：`{ "email": "xxx@xx.com", "code": "123456" }`
  - Resp：`{ "success": true, "message": "验证成功" }`

## 注册 / 登录 / 会话

- `POST /api/register`
  - Body：`{ "email": "xxx@xx.com", "password": "******", "verificationCode": "123456" }`
  - Resp：`{ "success": true, "user": { ... }, "sessionToken": "..." }`

- `POST /api/login`
  - Body：`{ "email": "xxx@xx.com", "password": "******" }`
  - Resp：`{ "success": true, "user": { ... }, "sessionToken": "..." }`

- `POST /api/me`
  - Body：`{ "sessionToken": "..." }`
  - Resp：`{ "success": true, "user": { ... } }`

## 每日使用限制

- `POST /api/user/check-daily-limit`
  - Body：`{ "sessionToken": "..." }`
  - Resp：`{ "success": true, "allowed": true }`

- `POST /api/user/increment-daily-check`
  - Body：`{ "sessionToken": "..." }`
  - Resp：`{ "success": true, "count": 1, "limit": 2 }`

## 题库

- `POST /api/questions/list`
  - Body（可选 filters）：`{ "date_tag": "2026-03-12", "source": "军转", "category": "概括题", "search": "空巢" }`
  - Resp：`{ "success": true, "data": [ { question... } ] }`

- `POST /api/questions/get`
  - Body：`{ "identifier": "<uuid 或 code/composite>" }`
  - 说明：支持 `uuid` / `code` / 组合标识（如 `junzhuan_2026_03_12_05`）。
  - Resp：`{ "success": true, "data": { question... } }`

## 作答 / 评分

- `POST /api/submissions/create`
  - Body：`{ "sessionToken": "...", "questionIdentifier": "<uuid 或 code/composite>" }`
  - Resp：`{ "success": true, "data": { submission... } }`

- `POST /api/submissions/get`
  - Body：`{ "sessionToken": "...", "submissionId": "<uuid>" }`
  - Resp：`{ "success": true, "data": { submission..., question?: {...}, grade?: {...} } }`

- `POST /api/submissions/list`
  - Body：`{ "sessionToken": "..." }`
  - Resp：`{ "success": true, "data": [ { submission..., question?: {...}, grade?: {...} } ] }`

- `POST /api/submissions/update-final`
  - Body：`{ "sessionToken": "...", "submissionId": "<uuid>", "finalText": "..." }`
  - Resp：`{ "success": true, "data": { submission... } }`

- `POST /api/submissions/grade`
  - Body：`{ "sessionToken": "...", "submissionId": "<uuid>" }`
  - Resp：`{ "success": true, "data": { grade-json... } }` 或 `success:false`（含每日限制/答案为空等）

## OCR（大模型识图）

- `POST /api/ocr/llm`
  - Content-Type：`multipart/form-data`
  - Form：`file=<image>`
  - Resp：`{ "success": true, "text": "..." }`

## 调试

- `POST /api/debug/smtp`
  - 需要设置：`SMTP_DEBUG_ENDPOINT=1`
  - Resp：`{ "success": true, "message": "SMTP connect+login OK", "smtp": {...} }`

## 后台管理（数据库面板）

- `GET /admin`
  - 说明：SQLAdmin 管理面板，可对 `users / sessions / verification_codes / essay_questions / essay_submissions / essay_grades` 做增删改查，支持搜索、勾选批量删除。
  - 配置：在 `backend/.env` 设置
    - `ADMIN_ENABLED=1`
    - `ADMIN_USER=...`
    - `ADMIN_PASSWORD=...`
    - `ADMIN_SECRET_KEY=...`（用于会话签名，生产建议随机长串）
