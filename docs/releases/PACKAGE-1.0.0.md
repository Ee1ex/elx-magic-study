# 1.0.0 本地包与发布预览

日期：2026-10-14。本文件为发布前的本地包与执行预览；main／Tag／Release已按确认发布并回读，实际结果见[发布回执](RELEASE-1.0.0.md)。本机全局 MCP 配置尚未执行。范围：[REQ-022](../requirements/REQ-022-local-mcp.md)、[PROG-017](../progress/PROG-017-local-mcp.md)。版本源 `package.json`、MCP 包、CLI help 均为 `1.0.0`。ELX Level 的自动版本 dry-run 建议 `0.11.0`；用户明确指定 1.0，采用三段格式 `1.0.0`。

| 附件 | SHA256 | 内容 |
|---|---|---|
| `elx-magic-study-skill-v1.0.0.zip` | `217901938ee37f7b252409254195bc1c4534726e7b7d94554ba52efd2c47ea49` | 155816字节；Skill-only，47个文件 |
| `elx-magic-study-mcp-v1.0.0.zip` | `d457b1f7d773e0bddd07bdd67383d674acb2a541da80db5ccb923151c9734396` | 6269041字节；独立本地MCP、固定运行依赖与同版Skill，2500个文件 |

摘要清单：`artifacts/SHA256SUMS-v1.0.0`。两个 ZIP 解包后逐文件 SHA256 与源码／构建目录一致。独立 MCP 解包入口通过官方 SDK 客户端合成握手、工具发现和状态／检索测试；MCP专项5项通过。旧 CLI 107项在系统临时同源码副本通过；工作区基线1项旧EPERM不记作功能失败修复。

发布目标为公开仓库 `Ee1ex/elx-magic-study` 的 `main`。只读检查时远端 main 是 `cf1164c`，本地已有 `475330c`（表格兼容）、`7af31d3`（MCP计划）、`f7f02b6`（文件读取）及 `0cff712`（MCP实现）四个未推送提交；本预览的本地收尾提交也会包含在快进序列。正式发布前将再次核对远端 HEAD 与本地 SHA，不强推或改写历史。无同名 `v1.0.0` Tag/Release，当前无开放 PR，GitHub 插件身份 `Ee1ex` 对仓库有管理权限；main 当前无分支保护。插件没有 Tag/Release 附件上传工具，若用户明确同意，将以本机 `git`/`gh` 执行发布并逐项远端回读，不能静默降级。

拟发布：推送上述本地提交到 main，创建指向最终发布提交的 `v1.0.0` Tag 和公开正式 Release，附上述两个 ZIP 与摘要清单。Release 标题与完整正文见[发布说明草稿](RELEASE-NOTES-1.0.0.md)。发布后回读 main、Tag、Release及附件摘要。不会上传个人状态，不自动更改飞书或Codex配置。

真实飞书文档／表格闭环、实际 Codex 全局连接、图片/PDF附件上传、macOS/Linux 与其他客户端尚未验收，Release 说明必须保留这些限制。本机 Skill/MCP 安装若要进行，需另外列出目标路径、备份和客户端配置差异，再次确认。
