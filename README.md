# Codex Watcher

**Language:** English | [中文](#中文)

Codex Watcher is a Windows desktop widget for keeping Codex 5-hour quota, weekly quota, and available reset credits visible at a glance.

The web dashboard is included as a secondary entry for debugging, previewing, and fallback viewing.

![Codex Watcher preview](public/usage-header.png)

## Windows Desktop Card

The desktop card uses Electron to host the compact `/widget` page in a small Windows desktop window.

It shows Codex 5-hour quota, weekly quota, available reset count, and the reset tickets that expire soonest.

It gives short usage guidance based on quota levels and reset expiry times, helping you decide whether to wait or spend a saved reset.

It supports a tray menu, show or hide actions, refresh, always-on-top, position lock, launch at startup, and background transparency control.

Window position, size, always-on-top, lock, startup, and transparency settings are saved in the local Electron user data directory.

## Features

- Windows desktop card first, designed to stay in a corner of the desktop for ongoing quota checks.
- Reads the local Codex login state in read-only mode and never redeems reset credits.
- Refreshes every 5 minutes and can also be refreshed manually from the card or tray.
- Shows reset tickets by expiry time, with reminders for credits that are about to expire.
- Keeps the web dashboard as a fuller browser-based inspection view.

## Requirements

- Windows
- Node.js 20.9.0 or newer
- npm
- Codex Desktop signed in on the same machine

By default, Codex Watcher reads `%USERPROFILE%\.codex\auth.json`.

If your Codex config directory is elsewhere, set `CODEX_HOME`.

```env
CODEX_HOME=C:\path\to\.codex
```

## Run the Desktop Card

Install dependencies.

```powershell
npm install
```

Start the desktop card in production mode.

```powershell
npm run desktop:start
```

Build the Windows installer.

```powershell
npm run desktop:pack
```

The installer is written to `dist`.

## Development

When developing the desktop card, start Next.js first and then start Electron.

```powershell
# terminal 1
npm run dev

# terminal 2
npm run desktop:dev
```

You can also open the web dashboard directly.

```text
http://localhost:3000
```

The compact card page is available at `/widget`.

```text
http://localhost:3000/widget
```

## Checks

Run tests.

```powershell
npm test
```

Run the production build check.

```powershell
npm run build
```

## Privacy and Safety

Codex Watcher only reads the local Codex auth file and calls Codex/ChatGPT quota endpoints.

The project does not store tokens, account IDs, private keys, or `.env*.local` files in the repository.

The project does not redeem reset credits; it only displays quota status and usage guidance.

## Credits

Assets and business rules are based on the MIT-licensed upstream project.

https://github.com/jordan-edai/codex-reset-watcher

## License

This project is licensed under the MIT License.

---

# 中文

**语言：** [English](#codex-watcher) | 中文

Codex Watcher 是一个面向 Windows 的 Codex 额度桌面卡片，用于在桌面上持续查看 5 小时额度、每周额度和可用重置额度。

Web 仪表盘也包含在项目中，但它主要作为调试、预览和备用查看入口。

![Codex Watcher 预览图](public/usage-header.png)

## Windows 桌面卡片

桌面卡片使用 Electron 承载 `/widget` 紧凑页面，并以小窗口形式停留在 Windows 桌面上。

卡片会展示 Codex 5 小时额度、每周额度、当前可用重置数量和最快到期的重置 ticket。

卡片会根据额度余量和重置到期时间给出简短建议，帮助判断是等待自然恢复还是使用储备重置。

卡片支持托盘菜单、显示或隐藏、刷新、置顶、锁定位置、开机启动和背景透明度调整。

窗口位置、尺寸、置顶、锁定、开机启动和透明度设置会保存到本机 Electron 用户数据目录。

## 功能

- Windows 桌面卡片优先，适合长期挂在桌面角落查看额度。
- 只读读取本机 Codex 登录状态，不会兑换重置额度。
- 每 5 分钟自动刷新，也可以从卡片或托盘手动刷新。
- 重置 ticket 会按到期时间展示，并提示快到期额度。
- Web 仪表盘保留为浏览器中的完整信息查看入口。

## 环境要求

- Windows
- Node.js 20.9.0 或更高版本
- npm
- 本机已登录 Codex Desktop

默认读取 `%USERPROFILE%\.codex\auth.json`。

如果 Codex 配置目录不在默认位置，可以设置 `CODEX_HOME`。

```env
CODEX_HOME=C:\path\to\.codex
```

## 运行桌面卡片

安装依赖。

```powershell
npm install
```

生产模式启动桌面卡片。

```powershell
npm run desktop:start
```

构建 Windows 安装包。

```powershell
npm run desktop:pack
```

安装包会输出到 `dist`。

## 开发

开发桌面卡片时需要先启动 Next.js，再启动 Electron。

```powershell
# 终端 1
npm run dev

# 终端 2
npm run desktop:dev
```

也可以直接打开 Web 仪表盘。

```text
http://localhost:3000
```

紧凑卡片页面可通过 `/widget` 访问。

```text
http://localhost:3000/widget
```

## 检查

运行测试。

```powershell
npm test
```

运行生产构建检查。

```powershell
npm run build
```

## 隐私和安全

Codex Watcher 只读取本机 Codex 登录文件并请求 Codex/ChatGPT 额度接口。

项目不会在仓库中保存 token、账号、私钥或 `.env*.local` 文件。

项目不会执行重置兑换操作，只展示额度状态和使用建议。

## 致谢

素材和业务规则参考 MIT 许可的上游项目。

https://github.com/jordan-edai/codex-reset-watcher

## 许可证

本项目使用 MIT 许可证。
