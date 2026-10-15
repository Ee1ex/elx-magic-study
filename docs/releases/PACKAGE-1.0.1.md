# 1.0.1 本地包与发布确认清单

日期：2026-10-16。本文件保留发布前清单；用户随后明确“确认发布”，main／Tag／Release及三个附件已发布并下载核验。实际结果见[发布回执](RELEASE-1.0.1.md)。

## 内容与版本

REQ-023调研指引；README、首次导览、Skill界面简介、新知识库首页模板；版本标识统一。README仅改文字与表格行，不改图片和排版。未修改真实飞书首页。ELX Level version-bump dry-run基于当前文档提交建议patch，从1.0.0到1.0.1。根package、MCP package／lock根、CLI help与Skill metadata均为1.0.1。

| 附件 | 字节 | SHA256 |
|---|---:|---|
| elx-magic-study-skill-v1.0.1.zip | 156519 | f9481e365ee664ce245d1d44a8dd7507368b5ee05b2dd9733e97d11bb6540ac9 |
| elx-magic-study-mcp-v1.0.1.zip | 6249685 | a30333fe9493b6049ffb90f87ef8a4d9e78f9d633d851d93846a07de44dc1b4d |

两个ZIP和 `SHA256SUMS-v1.0.1` 位于本机忽略目录 `artifacts/`。分别48／2501文件；CRC、成员字节、解包文件和当前源码逐项核对一致。构建沿既有锁定依赖执行npm ci --omit=dev --ignore-scripts，未升级依赖、未安装到全局。

## 已执行验证

- 工作区现有CLI测试107/107，本轮没有遇到EPERM；不因此宣称历史环境问题已修复。
- MCP专项5/5，解压后的独立MCP入口复测5/5；合成验证不代表真实飞书写入。
- 解包Skill实际help返回1.0.1；新调研指引与功能介绍在包内。
- Skill格式、版本一致性、相对链接及Git差异检查；原始回执在 `artifacts/package-1.0.1/`。
- 平台真实试读使用本轮既有 [PROG-018](../progress/PROG-018-research-workflow.md) 结果，保留TikTok、B站字幕评论、京东评论等未通过项，不重复冒充完整可用。

## 待确认的远端动作

目标为公开仓库 `Ee1ex/elx-magic-study` 的main。只读预检：GitHub插件可访问、具有push/admin权限；本机gh身份Ee1ex；远端main为 `f3ca8da42aef310794639e4d78a96593e6f228b6`，当前无开放PR，main返回protected=false；未找到v1.0.1 Tag或Release。执行前再次核对，若远端发生变化先检查，不强推。

确认后快进推送main（包含REQ-023提交d6a89fc及本次发布准备提交），创建指向发布准备提交的注释Tag `v1.0.1`，创建非草稿、非预发布的正式Release，标题“魔法书屋 1.0.1 · 收集资料时补充调研”，正文使用 [RELEASE-NOTES-1.0.1](RELEASE-NOTES-1.0.1.md)，上传上表两个ZIP及摘要清单。完成后回读main、Tag、Release与下载附件SHA256，再提交并推送仅发布事实的收尾记录；Tag保持指向发布代码。

已连接GitHub插件用于只读预检，当前工具未提供Tag／Release附件上传；本次确认也需覆盖使用本机git／gh完成这些远端动作。不会自动升级本机Skill/MCP，不删除旧包和备份，不改权限、个人状态或飞书内容。出现未知发布结果先查远端，不盲目重发。
