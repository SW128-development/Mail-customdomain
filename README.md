<div align="center">
  <img src="https://img.116119.xyz/img/2025/06/08/547d9cd9739b8e15a51e510342af3fb0.png" alt="DuckMail Logo" width="120" height="120">

  # DuckMail - 临时邮件服务

  **安全、即时、快速的临时邮箱服务**

  [English](./README.en.md) | 中文

 一个基于 Next.js 和 Mail.tm API 构建的现代化临时邮件服务，提供安全、快速、匿名的一次性邮箱功能。
</div>

### Cloudflare Provider Deployment

Host your own mail backend on Cloudflare Workers with D1 (SQLite) storage and Email Routing.

#### Prerequisites

- A Cloudflare account with a domain already added to Cloudflare DNS
- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

#### Step 1 — Create the D1 database

```bash
cd cloudflare-provider
npm install
wrangler d1 create temp_mail_db
```

Copy the `database_id` from the output (e.g. `70bece35-d5bf-487b-9730-c7546f0266c3`).

#### Step 2 — Configure `wrangler.toml`

Edit `cloudflare-provider/wrangler.toml` and replace the placeholder values:

```toml
name = "duckmail-cloudflare-provider"
main = "worker.ts"
compatibility_date = "2024-12-01"
account_id = "<your-cloudflare-account-id>"   # Find at dash.cloudflare.com → any domain → Overview sidebar

[[d1_databases]]
binding = "TEMP_MAIL_DB"
database_name = "temp_mail_db"
database_id = "<your-d1-database-id>"         # From Step 1 output

[vars]
MAIL_DOMAIN = "yourdomain.com"                # Space-separated if multiple: "a.com b.com"
JWT_TOKEN = "<random-secret-32-chars-min>"    # Generate with: openssl rand -base64 32
```

> `account_id` is optional if you only have one Cloudflare account, but including it avoids permission issues during deploy.

#### Step 3 — Create an API token

Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) and create a token using the **"Edit Cloudflare Workers"** template. This grants the required permissions:

| Permission | Access |
|---|---|
| Account / Workers Scripts | Edit |
| Account / D1 | Edit |
| Account / Account Settings | Read |
| Zone / Workers Routes | Edit |

Copy the token — it is shown only once.

#### Step 4 — Deploy

```bash
cd cloudflare-provider
CLOUDFLARE_API_TOKEN=<your-token> npx wrangler deploy
```

After deploy, note the Worker URL (e.g. `https://duckmail-cloudflare-provider.yourname.workers.dev`).

#### Step 5 — Configure Email Routing

In the Cloudflare dashboard for your domain:

1. Go to **Email** → **Email Routing** → **Routing Rules**
2. Enable Email Routing if not already enabled
3. Create a **Catch-all** rule: match `*` → action **Send to Worker** → select `duckmail-cloudflare-provider`

This routes all incoming mail for your domain to the Worker for processing.

#### Step 6 — Connect to DuckMail frontend

In the DuckMail app, go to **Settings** (gear icon) and add a **Custom Provider**:

| Field | Value |
|---|---|
| ID | `cloudflare` (or any unique string) |
| Name | Your provider name |
| API Base URL | `https://duckmail-cloudflare-provider.yourname.workers.dev` |
| Mercure URL | *(leave empty — uses polling)* |

Or set it as a preset provider in `contexts/api-provider-context.tsx`.

#### Local development and testing

```bash
cd cloudflare-provider
wrangler dev

# Test endpoints (uses MAIL_DOMAIN = "test.local" from [env.development.vars])
curl http://localhost:8787/domains

curl -X POST http://localhost:8787/accounts \
  -H "Content-Type: application/json" \
  -d '{"address": "test@test.local", "password": "password123"}'

curl -X POST http://localhost:8787/token \
  -H "Content-Type: application/json" \
  -d '{"address": "test@test.local", "password": "password123"}'
```

#### Troubleshooting

| Problem | Fix |
|---|---|
| `Invalid domain` on account creation | The email domain must match one of the domains in `MAIL_DOMAIN` in `wrangler.toml` |
| `Authentication error [code: 10000]` on deploy | Add `account_id` to `wrangler.toml`, or pass `CLOUDFLARE_ACCOUNT_ID` env var |
| `Invalid API Token` on deploy | Regenerate the token at dash.cloudflare.com/profile/api-tokens — use the "Edit Cloudflare Workers" template |
| Not receiving emails | Check Email Routing catch-all rule points to the Worker; run `wrangler tail` to see live logs |
| Database errors on fresh deploy | The Worker auto-creates tables on first request — send a test request to `/domains` to trigger initialization |

#### Security notes

- Only domains listed in `MAIL_DOMAIN` can create accounts — all others are rejected
- Use a strong random string for `JWT_TOKEN` (`openssl rand -base64 32`)
- Tokens expire after 24 hours; the frontend handles re-authentication automatically
- The `.env` file is gitignored — never commit API tokens to the repository

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