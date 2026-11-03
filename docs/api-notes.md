# API Notes

## 文档边界

记录额度响应的兼容策略；代码入口与设计原因见 [Development Summary](development-summary.md)。

## GET /api/status

只读。服务端继续读取本机 Codex 登录文件，调用现有 usage 与 reset-credits 接口；不新增权限、凭据持久化或兑换动作。响应的 `windows` 现在仅包含当前订阅对应的额度窗口。`planLabel` 继续用于显示账户类型，`errors` 包含未知订阅或目标窗口缺失警告。

## 外部服务边界

`https://chatgpt.com/backend-api/wham/usage`：

- 订阅：`plan_type` / `planType`，去除首尾空白并转小写。`plus` 选择 5H。
- 周窗口计划：`pro`、`prolite`、`promax`、`team`、`business`、`self_serve_business_prolite`、`self_serve_business_usage_based`、`enterprise`、`ent26`、`hc`、`enterprise_cbp_automation`、`enterprise_cbp_usage_based`、`edu`、`education`、`edu_plus`、`edu_pro`。
- 标识参考 [OpenAI Codex PlanType](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/auth.rs)（2026-11-03 查询）。这是按用户需求实施的显示策略，不代表所有计划必定有周窗口；仍以实际返回窗口为准。新的计划标识需显式评估后加入，不能将所有非 Plus 账户归为周额度。
- `rate_limit` / `rateLimit` 中的 `primary_window` / `primaryWindow` 与 `secondary_window` / `secondaryWindow` 都按 `limit_window_seconds` / `limitWindowSeconds` 识别。18000 秒为 `short`（5H），604800 秒为 `weekly`；不按主次位置推断。
- 百分比、倒计时和重置时间延续现有 snake_case/camelCase 及数字字符串兼容。缺失百分比保留未知，不补零；缺失目标窗口返回空 `windows` 和警告。
- 未知、Free、Go、空白或缺失计划不选择窗口。没有真实账号联调数据，本次验证使用合成响应。
