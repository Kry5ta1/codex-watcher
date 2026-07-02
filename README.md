# Codex Watcher

本地只读的 Codex 额度监控面板，用于查看 5 小时额度、每周额度和可用重置额度。项目提供浏览器仪表盘和 Windows 桌面卡片两种使用方式。

![Codex Watcher preview](public/usage-header.png)

## Features

- 查看 Codex 5 小时额度和每周额度
- 查看可用重置额度数量、状态和到期时间
- 根据额度余量和重置到期情况给出使用建议
- 提供 `/widget` 紧凑卡片页面
- 提供 Windows Electron 桌面卡片、托盘菜单、置顶、锁定、开机启动和透明度设置
- 只读读取本机 Codex 登录状态，不会兑换重置额度

## Tech Stack

- Next.js 16
- React
- Electron
- Node.js built-in test runner

## Requirements

- Node.js 20.9.0 or newer
- npm
- Codex Desktop installed and signed in on the same machine

## Quick Start

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

The app reads Codex login data from `%USERPROFILE%\.codex\auth.json` by default. If your Codex config lives elsewhere, set:

```env
CODEX_HOME=C:\path\to\.codex
```

## Desktop Widget

Start the desktop widget in development mode with two terminals:

```powershell
# terminal 1
npm run dev

# terminal 2
npm run desktop:dev
```

Run the production desktop widget:

```powershell
npm run desktop:start
```

Build a Windows installer:

```powershell
npm run desktop:pack
```

Installer output is written to `dist`.

## Checks

```powershell
npm test
npm run build
```

## Privacy and Safety

Codex Watcher reads the local Codex auth file on your machine and calls Codex/ChatGPT usage endpoints to display quota information. It does not store your token in this repository, does not expose a separate login system, and does not redeem reset credits.

Do not commit real tokens, account IDs, private keys, or `.env*.local` files.

## Project Docs

- Runtime and delivery notes: `README.md`
- Development history and code boundaries: `docs/development-summary.md`
- Local API and upstream interface notes: `docs/api-notes.md`

## Credits

Assets and business rules are based on the MIT-licensed upstream project:

https://github.com/jordan-edai/codex-reset-watcher

## License

MIT
