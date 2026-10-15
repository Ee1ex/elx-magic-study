# 魔法书屋本地 MCP

本包使用本地 stdio、官方 MCP TypeScript SDK，与原 CLI 共用 `skills/elx-magic-study/scripts/library.mjs`。只需 Node.js 22+；飞书读取和写入继续依赖用户已授权的 `lark-cli`。MarkItDown 文件转换仍是 Skill 的可选 Python 能力，不由 MCP 自动安装。模型由客户端提供，正文会进入该客户端的模型上下文。

## 安装与连接

仅在用户明确选择MCP时执行本节。普通Skill安装默认走CLI，不自动构建／下载本包、注册客户端或启用服务。只介绍MCP的存在不等于用户授权；已有禁用状态保持不变。选择MCP后仍保留下文的写入批准要求，不以减少窗口或确认次数为由绕过。

在源码目录运行 `node mcp/build.mjs` 可生成含固定依赖和 Skill 的独立目录。安装目标由用户选择；复制完整目录后，启动入口是其中的 `mcp/server.mjs`，不依赖开发仓库。`mcp/node_modules` 与 `skills/elx-magic-study` 必须同在包内。已有 Skill-only 安装可继续使用 CLI，不要求启用 MCP。

以下是 Codex CLI 的**配置预览**，把路径换成实际独立包位置后，由用户确认再执行。它会修改 Codex 配置：

```powershell
codex mcp add elx-magic-study -- node "D:\实际安装目录\elx-magic-study-1.0.2\mcp\server.mjs"
codex mcp get elx-magic-study
```

默认沿用 `~/.elx-library` 的现有绑定。需要隔离测试时，可在启动配置中设置 `ELX_MAGIC_STUDY_MCP_HOME`；需要锁定一个已绑定库时设置 `ELX_MAGIC_STUDY_MCP_LIBRARY`。这两个值只由启动者配置，MCP 工具参数不能改写状态目录、执行文件或知识库根。首次使用先运行 `study_doctor`，根据 Skill 的 `references/setup.md` 完成飞书授权和绑定，再 `study_status`、`study_sync`、`study_search`。连接服务器不等于已授权飞书。

## 写入批准

`study_plan` 会生成完整目标和正文预览。它可能更新已配置工作台的机器区域；它不会保存文章。执行任何计划前，在本机交互式终端运行：

```powershell
node "D:\实际安装目录\elx-magic-study-1.0.2\mcp\approve.mjs" <operationId> <digest>
```

终端会显示计划的目标、正文和摘要；核对后按提示手动输入完整批准短语。命令只为这一计划签发一次 `approvalToken`。将三个值交给 `study_apply`，它会再次核对账号、根、版本和计划摘要，并沿用原有写后回读。完成后不能重放；两步计划只有前一步已回读核验、后一步仍待发送时，才能用原批准续行。中断或未知结果先 `study_operation`、`study_recover`，不要再发送一次新增。此入口只能证明本机用户做了交互式批准，不能抵御拥有同一系统账号权限的恶意进程。

首版写入限单条文档增改或个人表格追加；两步计划仅用于新分类及其子文档。首次新建、扩列或多目标操作都需核对具体预览。原 CLI 的其他能力依旧可用；本 MCP 不提供删除、任意文件读取、命令透传或整篇覆盖。

## 验证边界

`cd mcp; npm test` 使用官方客户端和合成资料验证握手、工具发现、参数、索引查询和一次性批准。实际 Codex 连接、飞书正文与表格回读、图片/PDF附件保存和跨平台运行须分别记录；本地合成测试不能代替这些结果。
