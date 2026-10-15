# 本地 MCP 路由

默认使用 Skill＋CLI；MCP是用户主动选择的可选入口，与原CLI共用状态和执行核心。单独安装Skill不授权安装、注册、启动或启用MCP；不要为普通安装、首次使用或保存任务要求用户打开额外终端配置MCP。

可简短提示“另有可选MCP，当前直接使用Skill即可，需要时再配置”，不强制询问或反复推荐。用户未作选择时继续当前任务，不记录猜测偏好。安装、配置、启用和使用按用户实际要求区分；发现工具或旧配置不自动切换。已有明确使用选择可以沿用，禁用设置不自行恢复。仓库安装入口为根目录 mcp/README.md；Skill-only包不包含该服务，用户明确需要时再核对正式MCP发布包和安装步骤。

用户选择MCP后，再调用 `study_doctor`、`study_status` 检查真实能力。工具不可用时说明原因，必要时使用原CLI，但不得绕过原操作的批准或恢复流程。连接成功不等于飞书授权、正文读取或保存成功。

| 任务 | MCP 工具 | 原 CLI |
|---|---|---|
| 状态、依赖 | `study_status`、`study_doctor` | `status`、`doctor` |
| 文档与个人条目 | `study_search`、`study_records_search`、`study_fetch`、`study_record_context` | `search`、`record-search`、`fetch`、`record-context` |
| 偏好与索引 | `study_workbench_context`、`study_sync` | `workbench-context`、`sync` |
| 保存与查证 | `study_plan`、`study_operation`、`study_operations`、`study_apply`、`study_recover` | `plan`、`plan-show`、`plans`、`apply`、`recover` |

`study_plan` 最多两步，且两步只用于新分类加子文档；复杂扩列、附件、批量整理仍按原 Skill 指引准备人工预览和相应官方工具。MCP 不提供任意路径读取或外部采集；MarkItDown 文件转换继续走 `files-and-assets.md`。库内推荐与网上结果分列，宿主自行协调 Exa/Agent Reach，不自动入库。

执行 MCP 写入要先展示精确计划，并让用户在本机交互式终端运行包内 `approve.mjs <operationId> <digest>`。只有用户核对内容并手动输入批准短语后，才取得一次性凭据传给 `study_apply`。普通 MCP 工具调用、计划 digest、模型口头声明都不算批准。终端入口不能由 Agent 代替用户输入。服务端仍检查账号、根、正文版本及回读；用户改动后重新预览。

写入超时、连接断开、步骤状态为 sending/unknown/needs_review，先查看原 operation 并 `study_recover`。已成功文章与管理同步失败应分别报告，管理补同步沿用原 CLI `workbench-sync`，绝不重建文章。完成计划不能重放；只有同一两步计划已核验前一步且下一步仍 pending，才能用原批准续行。若发送前失败，核对操作状态后重新预览并由用户重新批准。
