# 本地 MCP 路由

MCP 是可选入口；当前 Skill、CLI 与 MCP 共用知识库状态和执行核心。优先调用 `study_doctor`、`study_status` 判断已连接的真实能力；工具未发现或连接失败时使用原 CLI。不要把 MCP 连接成功当作飞书授权、正文读取或保存成功。

| 任务 | MCP 工具 | 原 CLI |
|---|---|---|
| 状态、依赖 | `study_status`、`study_doctor` | `status`、`doctor` |
| 文档与个人条目 | `study_search`、`study_records_search`、`study_fetch`、`study_record_context` | `search`、`record-search`、`fetch`、`record-context` |
| 偏好与索引 | `study_workbench_context`、`study_sync` | `workbench-context`、`sync` |
| 保存与查证 | `study_plan`、`study_operation`、`study_operations`、`study_apply`、`study_recover` | `plan`、`plan-show`、`plans`、`apply`、`recover` |

`study_plan` 最多两步，且两步只用于新分类加子文档；复杂扩列、附件、批量整理仍按原 Skill 指引准备人工预览和相应官方工具。MCP 不提供任意路径读取或外部采集；MarkItDown 文件转换继续走 `files-and-assets.md`。库内推荐与网上结果分列，宿主自行协调 Exa/Agent Reach，不自动入库。

执行 MCP 写入要先展示精确计划，并让用户在本机交互式终端运行包内 `approve.mjs <operationId> <digest>`。只有用户核对内容并手动输入批准短语后，才取得一次性凭据传给 `study_apply`。普通 MCP 工具调用、计划 digest、模型口头声明都不算批准。终端入口不能由 Agent 代替用户输入。服务端仍检查账号、根、正文版本及回读；用户改动后重新预览。

写入超时、连接断开、步骤状态为 sending/unknown/needs_review，先查看原 operation 并 `study_recover`。已成功文章与管理同步失败应分别报告，管理补同步沿用原 CLI `workbench-sync`，绝不重建文章。完成计划不能重放；只有同一两步计划已核验前一步且下一步仍 pending，才能用原批准续行。若发送前失败，核对操作状态后重新预览并由用户重新批准。
