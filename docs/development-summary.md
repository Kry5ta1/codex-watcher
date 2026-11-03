# Development Summary

## 2026-11-03 按订阅选择额度窗口

- 功能：Plus 展示 5 小时窗口，已知 Pro 系列及组织订阅展示周窗口。卡片与 Web 仪表盘一致；每次刷新重新判断，账号切换不沿用旧的窗口选择。
- 主要入口：`lib/codex.js` 的 `decodeUsageResponse` 将上游数据归一化并选择窗口；`loadStatus` 将未识别订阅或窗口缺失警告放入 `errors`；`makeNudge` 为 5 小时窗口提供独立建议。`app/page.jsx` 和 `app/widget/page.jsx` 显示 `5H` 或 `W`。
- 数据边界：只信任 usage 响应的订阅类型和窗口时长，不从窗口位置猜测订阅、不读取额外凭据。只有 18000 秒和 604800 秒分别视为 5H 与周窗口。缺失或未知订阅不自动视为高阶订阅；缺失目标窗口不回退到另一窗口；缺失使用率仍为未知。
- 技术决策：显式维护支持的高阶计划标识，避免把 Free、Go 或未来未知计划误分类。Plus 建议不套用周额度刷新时间或储备重置建议，因为未验证其兑换适用性。保留现有只读重置展示和周额度建议。
- 相关接口字段及来源见 [API Notes](api-notes.md)。未改动认证、兑换、发布流程或依赖版本。
- 验证：`npm test` 的 20 项测试通过，覆盖大小写、camelCase、窗口互换、未知订阅、缺失字段、计划切换及 Plus 建议。`npm run build` 通过（含 standalone 准备），本地服务成功启动，但当前环境中的 HTTP 冒烟请求未连通（HTTP 000）。Playwright 页面交互验证未能执行：当前运行环境禁止 Chromium 创建本地 socket，即使请求提升后仍失败。因此实际自动刷新、账号切换交互和 Windows 原生卡片及真实账号接口未实测。

## 2026-11-03 0.3.0 Windows 构建交付

- `package.json` 与锁文件根包版本同步为 0.3.0，依赖版本不变。
- `.github/workflows/release-windows.yml` 保留文件路径，工作流名称改为 Build Windows Installer。PR 或手动运行只生成 Windows x64 NSIS 安装包与 SHA256 校验文件，不发布 Release。
- 移除旧版默认 v0.2.0 及覆盖上传动作，令牌权限降为只读。安装包版本与名称由 package.json 决定，产物保留 14 天。
- 打包失败必须失败，不能仅凭残留 exe 判定成功；上传前验证唯一且非空的安装包。
- 入口与边界：版本清单 → Windows 构建 → artifacts 目录 → GitHub Actions artifact；没有业务 API 或认证逻辑变化。运行步骤见 README。
- 验证：本地 20 项测试、生产构建、YAML 解析、版本一致性和 diff 检查通过；Windows 安装包以远程 Actions 结果为准。
