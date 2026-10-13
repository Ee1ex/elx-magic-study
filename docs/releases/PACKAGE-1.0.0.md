# 1.0.0 本地包与发布预览

日期：2026-10-14。当前仅完成本地版本与打包；GitHub main、Tag、Release 和本机全局 MCP 配置尚未执行。范围：[REQ-022](../requirements/REQ-022-local-mcp.md)、[PROG-017](../progress/PROG-017-local-mcp.md)。版本源 `package.json`、MCP 包、CLI help 均为 `1.0.0`。ELX Level 的自动版本 dry-run 建议 `0.11.0`；用户明确指定 1.0，采用三段格式 `1.0.0`。

| 附件 | SHA256 | 内容 |
|---|---|---|
| `elx-magic-study-skill-v1.0.0.zip` | `217901938ee37f7b252409254195bc1c4534726e7b7d94554ba52efd2c47ea49` | 155816字节；Skill-only，47个文件 |
| `elx-magic-study-mcp-v1.0.0.zip` | `d457b1f7d773e0bddd07bdd67383d674acb2a541da80db5ccb923151c9734396` | 6269041字节；独立本地MCP、固定运行依赖与同版Skill，2500个文件 |

摘要清单：`artifacts/SHA256SUMS-v1.0.0`。两个 ZIP 解包后逐文件 SHA256 与源码／构建目录一致。独立 MCP 解包入口通过官方 SDK 客户端合成握手、工具发现和状态／检索测试；MCP专项5项通过。旧 CLI 107项在系统临时同源码副本通过；工作区基线1项旧EPERM不记作功能失败修复。

发布计划：只将本轮源码、锁文件、测试、Skill 指引和公开文档提交到 `Ee1ex/elx-magic-study` 的 `main`；创建 `v1.0.0` Tag/Release，附上述两个 ZIP 与摘要清单。发布后回读 main 提交、Tag、Release、附件大小和下载摘要。不得强推、改写历史、上传本机状态或自动更改飞书／Codex全局配置。发布前需再次确认此完整范围。

真实飞书文档／表格闭环、实际 Codex 全局连接、图片/PDF附件上传、macOS/Linux 与其他客户端尚未验收，Release 说明必须保留这些限制。本机 Skill/MCP 安装若要进行，需另外列出目标路径、备份和客户端配置差异，再次确认。
