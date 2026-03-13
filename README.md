# 申论智能评分系统（FastAPI + Vue3）

目录结构：
- `backend/`：FastAPI + SQLite（发验证码、登录、题库、提交、OCR、评分）
- `front/`：Vue3 前端（`front/src/pages/*`）

## 环境变量

分别复制并填写：

```bash
cp backend/.env.example backend/.env
cp front/.env.example front/.env
```

说明：
- `front/.env` 只放 `VITE_*`（会被打包进静态站点）。
- `backend/.env` 放 `LLM_*`、`SMTP_*`、`APP_DB_PATH`（只在后端使用，不能泄露到前端）。

## 本地启动（联调）

### 1) 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

接口文档见：`backend/API.md`

### 2) 启动前端

```bash
cd front
npm install
npm run dev
```

开发模式已在 `vite.config.ts` 配置 `/api` 代理到 `http://127.0.0.1:8000`，因此本地联调时 `VITE_API_BASE_URL` 可以留空（走同源 `/api`）。

## 构建与部署（同服务器）

```bash
cd front
npm run build
```

构建产物在 `dist/`。生产环境建议用 Nginx/反代：
- 静态文件：指向 `dist/`
- `/api/*`：反代到 FastAPI（如 `http://127.0.0.1:8000`）
