<div align="center">
  <img src="https://img.116119.xyz/img/2025/06/08/547d9cd9739b8e15a51e510342af3fb0.png" alt="DuckMail Logo" width="120" height="120">

  # DuckMail - 临时邮件服务

  **安全、即时、快速的临时邮箱服务**

  [English](./README.en.md) | 中文

  一个基于 Next.js 和 Mail.tm API 构建的现代化临时邮件服务，提供安全、快速、匿名的一次性邮箱功能。

  **🌐 [立即使用 duckmail.sbs](https://duckmail.sbs)**
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

## 📸 应用展示

<div align="center">
  <img src="./img/display1.png" alt="DuckMail 主界面" width="800">
  <p><em>主界面 - 简洁现代的设计</em></p>

  <img src="./img/display2.png" alt="DuckMail 邮件管理" width="800">
  <p><em>邮件管理 - 实时接收和管理临时邮件</em></p>
</div>

## 🚀 快速开始

### 一键部署

#### Netlify 部署（推荐）

点击下面的按钮，一键部署到 Netlify：

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/syferie/duckmail)

> 🎉 **零配置部署** - 点击按钮后，Netlify 会自动 fork 项目到你的 GitHub 账户并开始部署，无需任何额外配置！

#### Vercel 部署

点击下面的按钮，一键部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/syferie/duckmail)

> ⚠️ **注意**：Vercel 部署仅支持 DuckMail API，不支持 Mail.tm API（因为 Mail.tm 屏蔽了 Vercel 的 IP 地址）。部署后请在设置中禁用 Mail.tm 提供商。
>
> 🚀 **零配置**：Vercel 会自动检测 Next.js 项目并使用最佳配置进行部署。

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

## 🌐 部署说明

### 平台兼容性

| 部署平台 | DuckMail API | Mail.tm API | 推荐度 |
|---------|-------------|-------------|--------|
| **Netlify** | ✅ 支持 | ✅ 支持 | ⭐⭐⭐⭐⭐ |
| **Vercel** | ✅ 支持 | ❌ 不支持* | ⭐⭐⭐⭐ |
| **其他平台** | ✅ 支持 | ✅ 支持 | ⭐⭐⭐ |

> *Mail.tm 屏蔽了 Vercel 的 IP 地址，因此 Vercel 部署无法使用 Mail.tm API。

### 部署建议

- **完整功能**：推荐使用 **Netlify**，支持所有 API 提供商
- **快速部署**：可以使用 **Vercel**，但需要在设置中禁用 Mail.tm 提供商

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

## 💖 赞助支持

如果这个项目对你有帮助，欢迎赞助支持开发者继续维护和改进项目：

[![爱发电](https://img.shields.io/badge/%E7%88%B1%E5%8F%91%E7%94%B5-syferie-946ce6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K)](https://afdian.com/a/syferie)

你的支持是项目持续发展的动力！🚀

---

⭐ 如果这个项目对你有帮助，请给它一个星标！

### 🧭 Cloudflare 一体化配置与测试指南（合并版）

本节汇总 Cloudflare Worker 部署、Email Routing 配置、应用内连接（含缺省配置的优雅回退）与测试步骤。

#### 1) 环境与变量
- 推荐设置（可在 UI 中临时连接，无需强制 .env）：
  - `NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL`：你的 Worker 基础地址（用于域名/消息等数据访问，不依赖 Cloudflare API）
    - 例如：`https://duckmail-cloudflare-provider.lungw96.workers.dev`
  - `CLOUDFLARE_JWT_TOKEN`：与 Worker `wrangler.toml` 内的 `JWT_TOKEN` 保持一致
  - `CLOUDFLARE_API_TOKEN`（可选，管理功能用）：一个具备多项权限的 Cloudflare API Token（非 Global API Key）
    - 权限：Account: Workers Scripts(Edit), D1(Edit)；Zone: Zone(Read), Email Routing(Edit)

> 说明：数据访问（/domains、/accounts、/messages 等）只需要 `NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL` 指向已部署的 Worker；Cloudflare API Token 仅用于“在应用内进行 Cloudflare 账户/域名/路由编排”的管理功能。

#### 2) 优雅回退（无 Token 不阻塞）
- 应用在打开 Cloudflare 管理界面时会先调用 `/api/cf/preflight`：
  - 若未配置 Token，UI 显示“连接 Cloudflare”按钮而不是直接请求 Cloudflare（避免 500）
  - 点击后可临时输入 Token，应用将以 httpOnly Cookie 存储该 Token（仅本会话有效）
- 所有 Cloudflare 管理接口（如 `/api/cf/accounts`, `/api/cf/status`）在缺 Token 时返回：
  - `{ success: false, code: 'CONFIG_REQUIRED' }` 或 `{ success: false, code: 'CONFIG_INVALID' }`
  - UI 将引导用户连接或更换 Token，而不会中断已有功能

#### 3) Worker 部署（简要）
1. 进入 `cloudflare-provider` 并创建 D1：
```bash
cd cloudflare-provider
wrangler d1 create temp_mail_db
```
2. 配置 `wrangler.toml` 中的 `MAIL_DOMAIN`、`JWT_TOKEN`、D1 绑定；部署：
```bash
wrangler deploy
```
3. 在 Cloudflare Email Routing 中启用路由并创建 Catch-all → 动作 "Send to Worker" 指向该 Worker。

#### 4) 应用内连接 Cloudflare（管理功能）
- 设置面板 → Cloudflare Integration：
  - 若 `CLOUDFLARE_API_TOKEN` 未配置，点击“连接 Cloudflare”，按提示粘贴 API Token（会话级别存储，不落地浏览器存储）
  - 连接成功后，选择账户/域名，执行 Email Routing 设置与健康检查

#### 5) 快速测试
- Worker 可用性：
```bash
curl "$NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL/domains"
```
- UI 中选择 Cloudflare 作为 Provider 后，`10xco.de` 等域名应可见；
- 在管理界面点击“状态/健康检查”验证：
  - Worker Live、D1 绑定、MAIL_DOMAIN 一致、路由与 Catch-all 正确

#### 6) 常见问题
- “Invalid request headers/Unauthorized”：多为 Token 缺失或权限不足 → 通过 UI 重新连接，或在后台更新 `CLOUDFLARE_API_TOKEN`
- 域名不可见：确认 `NEXT_PUBLIC_CLOUDFLARE_WORKER_BASE_URL` 正确且 Worker `/domains` 返回域名；确认 Email Routing 指向该 Worker
- 生产安全：生产环境下优先使用服务器环境变量，禁用前端提交 Token；仅开发场景允许 UI 临时连接

#### 7) 推荐的 Token 策略
- 创建一个“多权限聚合”的 API Token（非 Global API Key）：
  - Account: Workers Scripts(Edit), D1(Edit)
  - Zone: Zone(Read), Email Routing(Edit)
- 在应用中使用“会话级别的 httpOnly Cookie”存储 Token；提供“断开连接”即可清除

以上流程确保：
- 没有 Cloudflare Token 时，现有 Worker 提供的域名/邮件功能仍然可用；
- 需要 Cloudflare 管理动作时，才提示输入并验证 Token；
- 配置缺失不会引发 500，而是以可恢复的 UI 提示处理。
