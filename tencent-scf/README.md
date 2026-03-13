# Tencent Cloud SCF 邮箱验证码（163 SMTP）

目标：不用 Supabase Auth，改为 **腾讯云云函数（SCF）** 通过 **163 SMTP** 发送 6 位验证码，并把验证码存到 Supabase 的 `verification_codes` 表里用于校验。

## 你需要准备

1) 163 邮箱 **SMTP 授权码/客户端授权码**
- 不是登录密码
- 在 163 邮箱后台开启 SMTP/IMAP 后生成

2) Supabase（仅用于存验证码，不走 Auth）
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 数据表（Supabase SQL）

在 Supabase SQL Editor 执行：

```sql
create table if not exists public.verification_codes (
  email text primary key,
  code text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
```

## 部署方式（最简单：控制台上传 ZIP）

云函数运行时：Node.js 18/20

### A. send-verification-code
- 代码目录：`tencent-scf/send-verification-code`
- 入口：`index.main_handler`

### B. verify-code
- 代码目录：`tencent-scf/verify-code`
- 入口：`index.main_handler`

两者都需要把 `tencent-scf/shared` 一起打进 zip（因为会 `require('../shared/...')`）。

### 打包

在仓库根目录执行：

```bash
cd tencent-scf
npm i

# 打包 send-verification-code
rm -f send-verification-code.zip
zip -r send-verification-code.zip send-verification-code shared node_modules package.json

# 打包 verify-code
rm -f verify-code.zip
zip -r verify-code.zip verify-code shared node_modules package.json
```

然后分别在 SCF 控制台上传 zip。

### 环境变量（两支函数都要配置）

- `SMTP_HOST=smtp.163.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=medicode@163.com`
- `SMTP_PASS=<你的163 SMTP授权码>`
- `SMTP_FROM=medicode@163.com`
- `SUPABASE_URL=https://xxxx.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<service_role key>`

### 触发器（API 网关）

给两支函数都配置 API 网关触发器：
- 方法：`POST`（并开启 `OPTIONS` 以支持 CORS）
- 开启 CORS

## 前端接入

在 `essay-grading-system` 构建时配置：

- `VITE_VERIFICATION_API_BASE_URL=<你的 API 网关 base url>`

例：
- `https://service-xxxx-12345.apigw.tencentcs.com/release`

前端会请求：
- `${base}/send-verification-code`
- `${base}/verify-code`

