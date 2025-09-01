<div align="center">
  <img src="https://img.116119.xyz/img/2025/06/08/547d9cd9739b8e15a51e510342af3fb0.png" alt="DuckMail Logo" width="120" height="120">

  # DuckMail - 临时邮件服务

  **安全、即时、快速的临时邮箱服务**

  [English](./README.en.md) | 中文

 一个基于 Next.js 和 Mail.tm API 构建的现代化临时邮件服务，提供安全、快速、匿名的一次性邮箱功能。
</div>

### 🚀 Cloudflare Provider 快速部署

- **准备**
  - 安装并登录 Cloudflare（需要已接入的域名）
  - 安装 Wrangler CLI
  - 在项目中进入 `cloudflare-provider`

```bash
cd cloudflare-provider
npm install
wrangler d1 create temp_mail_db
```

- **配置 `wrangler.toml`**（请替换占位符）

```toml
name = "duckmail-cloudflare-provider"
main = "cloudflare-provider/worker.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "TEMP_MAIL_DB"
database_name = "temp_mail_db"
database_id = "<your-d1-id>"

[vars]
MAIL_DOMAIN = "example.com anotherdomain.com"
JWT_TOKEN = "your-secure-jwt-secret"
RESEND_API_KEY = ""
```

- **部署到 Cloudflare**

```bash
wrangler deploy
```

部署后记录 Worker 地址（例如：`https://duckmail-cloudflare-provider.username.workers.dev`）。

- **配置 Email Routing**（Cloudflare 面板 → Email → Email Routing）
  - 启用 Email Routing
  - 创建 Catch-all 规则：匹配 `*` → 动作为 Send to Worker → 选择 `duckmail-cloudflare-provider`

- **在 Duckmail 中选择 Cloudflare 提供商**（或在 `lib/api.ts` 里预设）

```ts
{
  id: "cloudflare",
  name: "Cloudflare",
  baseUrl: "https://duckmail-cloudflare-provider.username.workers.dev",
  mercureUrl: "", // 初期无 SSE，使用轮询
}
```

- **本地调试与快速测试**

```bash
# 运行本地开发
cd cloudflare-provider
wrangler dev

# 获取域名
curl http://localhost:8787/domains

# 创建账号
curl -X POST http://localhost:8787/accounts \
  -H "Content-Type: application/json" \
  -d '{"address": "test@test.local", "password": "password123"}'

# 获取 token
curl -X POST http://localhost:8787/token \
  -H "Content-Type: application/json" \
  -d '{"address": "test@test.local", "password": "password123"}'
```

- **常见问题与安全建议**
  - 仅允许 `MAIL_DOMAIN` 中的域名创建账号
  - 确保 `JWT_TOKEN` 为强随机密钥，且与生产环境一致
  - 若未收到邮件：检查 Email Routing 规则是否指向该 Worker；使用 `wrangler tail` 查看日志

### UI 自动化配置快速测试（Cloudflare）

1) 打开应用 设置 → Cloudflare Integration。首次会自动调用 `GET /api/cf/preflight` 检查 Token、JWT、Worker URL 是否就绪。

```bash
curl http://localhost:3000/api/cf/preflight
```

2) 若未配置 Token，点击“连接 Cloudflare”，按照提示粘贴 API Token。应用通过 `POST /api/cf/connect` 以 httpOnly Cookie 临时保存 Token（仅当前会话）。

```bash
curl -X POST http://localhost:3000/api/cf/connect \
  -H "Content-Type: application/json" \
  -d '{"token":"<your-cloudflare-api-token>"}'
```

3) 成功连接后，页面会加载账户与域名（`GET /api/cf/accounts`）。也可用请求头直接测试：

```bash
curl -H "X-CF-API-Token: <your-cloudflare-api-token>" \
  http://localhost:3000/api/cf/accounts
```

4) 进入 Setup Wizard，选择账户与域名，执行自动化部署（UI 内触发 `POST /api/cf/setup-initial`）：
   - 创建/复用 D1
   - 部署/更新 Worker（绑定 TEMP_MAIL_DB，设置 `MAIL_DOMAIN` / `JWT_TOKEN`）
   - 启用 Email Routing，并确保 Catch‑all 指向该 Worker
   - 返回 `workerUrl`、`scriptName`、`d1` 信息

5) 完成后在设置中将该 Worker 添加为 Provider。验证：

```bash
curl "$NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL/domains"
```

> 注：未配置 Token 时，管理功能以可恢复的 UI 提示处理，不阻塞收信功能。更完整说明见文末“Cloudflare 一体化配置与测试指南”。

## 可选：邮件发送（MX Send / Resend）

- **目的**：为自有域名启用外发邮件能力（与收信配套）。
- **准备**：
  - 在 Resend 控制台验证并配置你的域名（SPF/DKIM 按向导设置）
  - 为 Cloudflare Worker 注入密钥（推荐用 Secret）：

```bash
wrangler secret put RESEND_API_KEY
```

- **当前实现现状**：
  - 代码包含 Resend 发送工具（`cloudflare-provider/emailSender.js`）与发送记录表相关函数（D1）
  - 默认未对外开放 `/send` 接口，避免误用与密钥泄露

- **启用方式（二选一）**：
  - A) 在你的服务器（Next.js API/Edge）直接调用 Resend（服务端保存 API Key，不暴露到浏览器）
  - B) 扩展 `cloudflare-provider/worker.ts`，新增受 JWT 保护的 `POST /send`、`POST /send/batch`，内部调用 `sendEmailWithResend` / `sendBatchWithResend`，并可选记录到 D1

- **示例：直接调用 Resend（用于后端或本地测试）**

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "you@yourdomain.com",
    "to": ["test@example.com"],
    "subject": "Hello from DuckMail",
    "html": "<p>Hi there</p>"
  }'
```

> 安全提示：`RESEND_API_KEY` 不应出现在客户端或仓库中；生产请使用 `wrangler secret` 注入。

## 后续改进

- **发送接口**：在 Cloudflare Worker 中新增受 JWT 保护的 `POST /send`、`POST /send/batch`，内部调用 Resend 并可选写入 D1 记录
- **状态与诊断**：UI 集成 `GET /api/cf/status` 的检查项（Worker、D1、Email Routing、Catch‑all）
- **域名安全**：SPF/DKIM/DMARC 检测与修复建议
- **实时更新**：为 Cloudflare Provider 引入 SSE/长轮询的消息刷新
- **反滥用**：节流、速率限制与可选验证码

## ✨ 特性

- 🔒 **安全可靠** - 使用 Mail.tm 的可靠基础设施
- ⚡ **即时可用** - 立即获得临时邮箱地址
- 🌐 **多语言支持** - 支持中文和英文，自动检测浏览器语言
- 📱 **响应式设计** - 完美适配桌面和移动设备
- 🎨 **现代化界面** - 基于 HeroUI 的精美设计
- 🔄 **实时更新** - 支持 Mercure SSE 实时消息推送
- 🌙 **深色模式** - 支持明暗主题切换
- 📧 **多账户管理** - 支持创建和管理多个临时邮箱
- 🔧 **多API提供商** - 支持 DuckMail API 和 Mail.tm API 切换
- 🎯 **智能错误处理** - 优雅的错误提示和自动重试机制
- 🔗 **开源透明** - 完全开源，支持社区贡献

## 🚀 快速开始

### 本地开发

#### 环境要求

- Node.js 18+
- npm 或 pnpm

#### 安装

```bash
# 克隆项目
git clone https://github.com/syferie/duckmail.git
cd duckmail

# 安装依赖
npm install
# 或
pnpm install
```

### 运行

```bash
# 开发模式
npm run dev
# 或
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建

```bash
# 构建生产版本
npm run build
npm start

# 或
pnpm build
pnpm start
```

## 🛠️ 技术栈

- **前端框架**: Next.js 15
- **UI 组件库**: HeroUI
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **API**: Mail.tm REST API / DuckMail API
- **实时通信**: Mercure SSE
- **语言**: TypeScript

## 📧 API 说明

本项目使用 [Mail.tm](https://mail.tm) 提供的免费 API 服务：

- **账户管理**: 创建、登录临时邮箱账户
- **邮件接收**: 实时接收和查看邮件
- **域名获取**: 获取可用的邮箱域名
- **实时通知**: 通过 Mercure Hub 获取实时消息推送

### API 限制

- 请求频率限制: 8 QPS
- 邮箱有效期: 根据 Mail.tm 政策
- 无密码找回功能

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Mail.tm](https://mail.tm) - 提供免费可靠的临时邮件 API 服务
- [HeroUI](https://heroui.com) - 现代化的 React UI 组件库
- [Next.js](https://nextjs.org) - 强大的 React 框架
- [Tailwind CSS](https://tailwindcss.com) - 实用优先的 CSS 框架

## 📞 联系

如有问题或建议，请通过以下方式联系：

- 创建 [Issue](https://github.com/syferie/duckmail/issues)
- 发送邮件到: syferie@proton.me

### 🧭 Cloudflare 一体化配置与测试指南（合并版）

本节汇总 Cloudflare Worker 部署、Email Routing 配置、应用内连接（含缺省配置的优雅回退）与测试步骤。

#### 1) 环境与变量
- 推荐设置（可在 UI 中临时连接，无需强制 .env）：
  - `NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL`：你的 Worker 基础地址（用于域名/消息等数据访问，不依赖 Cloudflare API）
    - 例如：`https://duckmail-cloudflare-provider.lungw96.workers.dev`