# 资金渠道追踪仪表盘 (fund-tracker)

一个**纯前端、零后端、零依赖**的单页应用，用于追踪多资金渠道的余额、欠款与资产增长曲线，支持浏览器本地存储、锁屏密码与数据备份/导入。可完全脱离任何平台，**独立运行并部署到 GitHub Pages**。

> 本仓库即原 WorkBuddy 中的 `account-calculator.html` 的**完整可运行源码**。已重构为标准的多文件静态项目（HTML / CSS / JS 分离），并将 Chart.js 本地化（不再依赖外部 CDN），因此**完全离线可用**。

---

## ✨ 功能特性

- 📊 多资金渠道管理（银行卡 / 支付宝 / 微信 / 现金 / 黄金 / 基金 / 股票 / 纳指 / 电子卡 / 自定义）
- 💰 欠款（负债）管理，并与渠道关联
- 📈 资产增长曲线（净资产 / 总资产 / 欠款，总体汇总，非逐渠道）
- 🗓️ 历史数据按「月 / 年 / 逐月增长」查看，含月度与年度曲线图
- 🔒 进入锁屏密码（SHA-256 + 盐，明文不上传，仅存于本机）
- 🌙 黑白（深色 / 浅色）模式切换
- 🕒 每条渠道卡片显示更新时间
- 💾 一键导出 / 导入备份（JSON），导出报表（CSV）
- 🔒 隐私「隐藏金额」与「立即锁定」按钮

## 🧱 技术栈

| 项目 | 说明 |
| --- | --- |
| 前端 | 原生 HTML + CSS + JavaScript（**无框架**） |
| 图表 | [Chart.js 4.4.1](https://www.chartjs.org/)（已本地化到 `vendor/chart.umd.min.js`） |
| 存储 | 浏览器 `localStorage`（**无数据库、无后端、无 API**） |
| 构建 | **无需编译**，仅做静态文件复制（Node 内置模块，零依赖） |

> 因此本项目**不需要环境变量、不需要密钥、不需要云服务**。所有数据保存在你自己的浏览器中。

## 📁 目录结构

```
fund-tracker/
├── index.html              # 应用入口（引用 css / js / vendor）
├── css/
│   └── style.css           # 全部样式（含深浅色主题变量）
├── js/
│   └── app.js              # 全部业务逻辑（锁屏、渠道、快照、图表、备份）
├── vendor/
│   └── chart.umd.min.js    # 本地化的 Chart.js（离线可用）
├── scripts/
│   ├── serve.js            # 零依赖本地静态服务器（npm run dev）
│   └── build.js            # 零依赖构建，输出 dist/（npm run build）
├── .github/
│   └── workflows/
│       └── pages.yml       # GitHub Actions 自动部署到 GitHub Pages
├── .gitignore
├── .nojekyll               # 让 GitHub Pages 不忽略下划线文件
├── package.json            # 仅包含 dev / build / preview 脚本，无任何依赖
└── README.md
```

## 🚀 快速开始

### 方式一：直接打开（最简单）
直接用浏览器打开 `index.html` 即可使用，**无需任何安装或构建**。

### 方式二：本地服务器（推荐，避免个别浏览器对 file:// 的限制）
需要 Node.js 18+（仅用其内置模块，无需安装任何包）：

```bash
npm run dev
# 打开 http://localhost:5173
```

其他等价方式（任选其一）：
```bash
npx serve .                 # 如果你更习惯 serve
python3 -m http.server 5173
```

### 构建（产出可部署的 dist/）
```bash
npm run build               # 生成 dist/ 目录
npm run preview             # 本地预览 dist/ 构建产物 (http://localhost:4173)
```
> 本项目没有编译步骤，`build` 只是把 `index.html / css / js / vendor` 复制到 `dist/`，方便用任意静态服务器或 CI 部署。

## 🌐 部署到 GitHub Pages

### 方法 A：从分支直接发布（最简单，无需构建）
1. 把本仓库推送到 GitHub（`main` 分支）。
2. 仓库 **Settings → Pages → Build and deployment → Source: Deploy from a branch**。
3. Branch 选择 `main`，目录选择 **/ (root)**。
4. 保存后等待片刻，访问 `https://<你的用户名>.github.io/<仓库名>/` 即可。

因为所有资源都用**相对路径**（`css/...`、`js/...`、`vendor/...`），无论部署在根域名还是子路径都能正常工作。

### 方法 B：GitHub Actions 自动部署（推荐用于持续更新）
仓库已包含 `.github/workflows/pages.yml`。只需：
1. 推送代码到 `main` 分支。
2. 仓库 **Settings → Pages → Source: GitHub Actions**。
3. 后续每次 push 到 `main` 都会自动 `npm run build` 并发布 `dist/`。

### 其他静态托管
由于是纯静态文件，你也可以部署到 Netlify / Vercel / Cloudflare Pages / 任意 Nginx：直接把 `dist/`（或整个仓库根目录）作为站点根目录即可。

## 💾 数据迁移（从 WorkBuddy 线上版迁移到自有仓库）

你的数据保存在**浏览器 localStorage**，按域名隔离。因此从 WorkBuddy 域名换到 GitHub Pages 域名后，需要在原页面导出再导入：

1. 在原 WorkBuddy 版本里：点击顶栏 **💾 导出备份**，下载一个 JSON 文件。
2. 在部署好的 GitHub Pages 版本里：点击顶栏 **📂 导入**，选择该 JSON（支持「覆盖导入」或「合并导入」）。

> localStorage 使用的 key：`fund_tracker_data`（账目）、`fund_tracker_pin`（锁屏密码哈希）、`fund_tracker_theme`（主题）。重置数据请使用页面内的「忘记密码」或浏览器清除站点数据。

## 🔧 自定义

- **标题 / 区块名**：在页面内点击标题或区块旁的 ✏️ 即可修改（会随数据一起保存）。
- **配色 / 主题**：编辑 `css/style.css` 顶部的 CSS 变量（`:root` 与 `[data-theme="dark"]`）。
- **Chart.js 版本升级**：替换 `vendor/chart.umd.min.js` 即可（保持 UMD 全局 `Chart` 形态）。

## ❓ 常见问题

- **需要后端 / 数据库吗？** 不需要。全部数据存于浏览器本地。
- **需要配置 .env 吗？** 不需要，项目不使用任何密钥或环境变量。
- **Chart.js 必须联网吗？** 不需要，已本地化在 `vendor/`，完全离线可用。
- **为什么没有 React/Vue/Vite？** 应用本身是原生 JS 单页，无框架反而更轻、更易长期维护与部署。
