# 项目启动说明

## 问题诊断与解决

### 问题原因
项目无法显示页面的根本原因是：**nodemailer 是 Node.js 库，无法在浏览器中运行**。

原来的 `src/api/auth.ts` 直接导入了 nodemailer，导致前端编译失败，页面无法加载。

### 解决方案
创建了独立的后端服务器来处理邮件发送：

1. **后端服务器** (`server/index.js`)
   - 使用 Express 创建 API 服务
   - 处理验证码发送和验证
   - 运行在 `http://localhost:3001`

2. **前端修改** (`src/api/auth.ts`)
   - 移除 nodemailer 导入
   - 改为调用后端 API
   - 使用 fetch 发送 HTTP 请求

## 启动步骤

### 1. 启动后端服务器
```bash
cd server
npm install  # 首次运行需要安装依赖
npm start
```

后端将运行在 `http://localhost:3001`

### 2. 启动前端开发服务器
```bash
# 在项目根目录
npm run dev
```

前端将运行在 `http://localhost:5186` (或其他可用端口)

### 3. 访问应用
打开浏览器访问前端地址，现在页面应该可以正常显示了。

## 环境变量配置

### 前端 `.env`
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_BACKEND_URL=http://localhost:3001
VITE_LLM_API_KEY=your_llm_api_key
VITE_DEEPSEEK_API_KEY=your_deepseek_key
```

### 后端 `server/.env`
```env
VITE_EMAIL_USER=your_163_email@163.com
VITE_EMAIL_PASSWORD=your_163_authorization_code
```

## API 端点

### 后端 API
- `POST /api/send-verification-code` - 发送验证码
- `POST /api/verify-code` - 验证验证码
- `GET /health` - 健康检查

## 测试结果

✅ 后端服务器运行正常 (端口 3001)
✅ 前端页面可以正常显示
✅ 验证码发送功能测试通过
✅ API 调用正常工作

## 生产环境部署建议

1. **后端部署**
   - 部署到云服务器（如阿里云、腾讯云）
   - 使用 PM2 管理进程
   - 配置 Nginx 反向代理
   - 启用 HTTPS

2. **前端配置**
   - 修改 `VITE_BACKEND_URL` 为生产环境后端地址
   - 构建生产版本：`npm run build`
   - 部署到静态托管服务

3. **安全改进**
   - 使用 Redis 存储验证码
   - 添加速率限制
   - 使用 JWT 进行身份验证
   - 密码使用 bcrypt 加密

## 文件结构

```
essay-grading-system/
├── server/                 # 后端服务器
│   ├── index.js           # Express 服务器
│   ├── package.json       # 后端依赖
│   └── .env              # 后端环境变量
├── src/
│   ├── api/
│   │   └── auth.ts       # 前端认证 API（已修改）
│   └── ...
├── .env                   # 前端环境变量
└── DEPLOYMENT.md         # 本文档
```
