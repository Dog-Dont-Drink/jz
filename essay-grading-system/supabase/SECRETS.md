# Supabase Edge Functions 环境变量配置指南

## 设置 Edge Functions 的环境变量

在部署 Edge Functions 后，需要设置以下环境变量：

### 1. 百度 OCR API Key / Secret Key

```bash
supabase secrets set BAIDU_OCR_API_KEY=your_baidu_ocr_api_key
supabase secrets set BAIDU_OCR_SECRET_KEY=your_baidu_ocr_secret_key
```

获取方式：
1. 访问百度智能云 AI 开放平台
2. 创建应用并开通文字识别能力
3. 获取 API Key / Secret Key

### 2. DeepSeek API Key

```bash
supabase secrets set DEEPSEEK_API_KEY=your_deepseek_api_key
```

获取方式：
1. 访问 https://platform.deepseek.com
2. 注册账号
3. 在 API Keys 页面创建新的 API Key

### 3. 验证环境变量

```bash
supabase secrets list
```

## 本地开发

如果需要在本地测试 Edge Functions，创建 `.env` 文件：

```bash
# supabase/functions/.env
BAIDU_OCR_API_KEY=your_baidu_ocr_api_key
BAIDU_OCR_SECRET_KEY=your_baidu_ocr_secret_key
DEEPSEEK_API_KEY=your_deepseek_api_key
```

然后使用：

```bash
supabase functions serve --env-file supabase/functions/.env
```

## 注意事项

- 百度 OCR 的额度与计费以百度控制台为准（建议设置限额/告警）
- DeepSeek API 按 token 计费，建议设置使用限额
- 不要将 API Keys 提交到 Git 仓库
