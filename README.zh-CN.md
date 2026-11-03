# Codex Watcher

**语言：** [English](README.md) | 中文

Codex Watcher 是一个面向 Windows 端的 Codex 额度桌面卡片，用于在桌面上持续查看当前订阅的使用额度和可用重置额度。帮助你实时掌握额度情况。

Web 仪表盘也包含在项目中，但它主要作为调试、预览和备用查看入口。

![Codex Watcher 预览图](public/usage-header.png)

## Windows 桌面卡片

桌面卡片使用 Electron 承载使用next制作的页面，并以小窗口形式停留在 Windows 桌面上。

卡片根据额度接口返回的订阅类型自动选择窗口：Plus 显示 5 小时额度；Pro（含 ProLite/ProMax）及已支持的 Business/Enterprise/Edu 等订阅显示周额度。同时展示可用重置数量和最快到期的重置 ticket。未知订阅或所需窗口缺失时会提示，不会改用其他窗口或伪造 0%。

卡片会根据额度余量和重置到期时间给出简短建议，帮助判断是等待自然恢复还是使用储备重置。

卡片支持托盘菜单、显示或隐藏、刷新、置顶、锁定位置、开机启动和背景透明度调整。

窗口位置、尺寸、置顶、锁定、开机启动和透明度设置会保存到本机 Electron 用户数据目录。


## 美国太平洋时钟

桌面卡片和 Web 仪表盘都显示实时美国太平洋时间，采用 12 小时制（例如 `10:30:45 AM PST`），同时显示当地日期与 UTC 偏移。使用 `America/Los_Angeles` 时区，自动切换 PST（UTC−8）与 PDT（UTC−7）。可以用来对照明确标注 PT/PST/PDT 的公告；其他时区仍需另行换算。

时钟读取电脑系统时间，每秒独立更新，不是自动重置倒计时，也不会连接 X 抓取公告。请保持操作系统时间同步。小尺寸卡片可滚动，重置 ticket 和错误信息不会因新增时钟而被截断；拖动顶部标题栏可移动卡片。

## 环境要求

- Windows
- Node.js 22.12.0 或更高版本
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

## GitHub Actions 打包

**Build Windows Installer** 工作流会在修改应用或构建输入的 PR 中自动构建 Windows x64 安装包，也可以在 **Actions → Build Windows Installer → Run workflow** 中选择分支手动运行。

工作流先运行测试和生产构建，再生成安装包。从成功运行页面的 **Artifacts** 下载 `Codex-Watcher-0.3.0-windows-x64`，其中包含 `Codex-Watcher-Setup-0.3.0.exe` 和 SHA256 校验文件。文件名取自 `package.json` 的版本号，产物保留 14 天。

该流程只生成构建产物，不发布 GitHub Release，也不会覆盖旧版安装包。打包命令失败时，即使目录中存在安装包也会将本次运行判定为失败。

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

项目的实现等都是参考上游项目，在此感谢 @jordan-edai

https://github.com/jordan-edai/codex-reset-watcher

## 许可证

本项目使用 MIT 许可证。
