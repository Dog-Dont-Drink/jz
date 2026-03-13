# 腾讯 EdgeOne 部署修复说明

## 问题描述
项目打包后在腾讯 EdgeOne 部署时不显示界面，原因是资源路径配置问题。

## 问题原因
Vite 默认使用绝对路径（`/assets/`）引用资源文件，这在某些部署环境（如腾讯 EdgeOne）中会导致资源加载失败。

### 修复前的路径
```html
<script type="module" crossorigin src="/assets/index-DoBo7yyB.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-DUFdUhm5.css">
```

### 修复后的路径
```html
<script type="module" crossorigin src="./assets/index-doLC5MR6.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-DUFdUhm5.css">
```

## 解决方案

在 `vite.config.ts` 中添加 `base: './'` 配置：

```typescript
export default defineConfig({
  plugins: [vue()],
  base: './', // 使用相对路径，适配各种部署环境
  server: {
    // ... 其他配置
  },
})
```

## 重新构建

```bash
npm run build
```

## 部署步骤

1. 将 `dist` 目录下的所有文件上传到腾讯 EdgeOne
2. 确保上传了以下内容：
   - `index.html`
   - `assets/` 目录（包含所有 JS 和 CSS 文件）
   - `vite.svg`（可选，网站图标）
   - `getword.html`（如果需要）

## 验证

部署后访问网站，应该能正常显示界面。如果仍有问题，检查：

1. **浏览器控制台**：查看是否有资源加载失败的错误
2. **网络面板**：检查资源请求的 URL 是否正确
3. **文件结构**：确保 `assets` 目录与 `index.html` 在同一级别

## 其他部署环境

此配置适用于：
- ✅ 腾讯 EdgeOne
- ✅ 阿里云 OSS
- ✅ 七牛云
- ✅ GitHub Pages
- ✅ Vercel
- ✅ Netlify
- ✅ 任何静态文件托管服务

## 注意事项

- 如果需要部署到子目录（如 `https://example.com/app/`），将 `base` 改为 `base: '/app/'`
- 如果使用自定义域名的根目录，`base: './'` 是最佳选择
- 修改 `base` 后需要重新构建项目

## 构建结果

```
dist/
├── index.html          (入口文件，使用相对路径)
├── assets/
│   ├── index-*.js     (主应用代码)
│   ├── index-*.css    (样式文件)
│   └── *.js           (其他代码分片)
├── vite.svg
└── getword.html
```

## 已修复

✅ 路径配置已更新
✅ 项目已重新构建
✅ 可以直接部署到腾讯 EdgeOne
