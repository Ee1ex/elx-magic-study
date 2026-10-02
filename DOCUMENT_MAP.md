# 文档地图

这里只负责导航；当前产品与技术事实统一在 SPEC，执行状态由 ELX Level 状态文件记录。

| 需要了解什么 | 入口 |
|---|---|
| 用户规则和 Agent 工作边界 | [AGENTS.md](AGENTS.md) |
| 产品、Project Brief、架构、数据、当前能力 | [docs/SPEC.md](docs/SPEC.md) |
| 人类可读当前状态 | [docs/elx-level/STATUS.md](docs/elx-level/STATUS.md) |
| 机器状态与上一个有效状态 | [.elx-level/state.json](.elx-level/state.json)、[备份](.elx-level/state.backup.json) |
| 新用户使用方法 | [README.md](README.md) |
| 开发命令与兼容细节 | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| README 视觉方向 | [docs/README_DESIGN.md](docs/README_DESIGN.md) |
| 需求与范围变化 | [docs/requirements/LEDGER.md](docs/requirements/LEDGER.md) |
| Bug、复现及定位状态 | [docs/bugs/LEDGER.md](docs/bugs/LEDGER.md) |
| 设计取舍 | [docs/decisions/LEDGER.md](docs/decisions/LEDGER.md) |
| 历史过程与当前进度 | [docs/progress/LEDGER.md](docs/progress/LEDGER.md) |
| 本轮建档 Change Record | [docs/progress/PROG-001-level1-spec.md](docs/progress/PROG-001-level1-spec.md) |
| 下一批四项优化的执行卡 | [docs/plans/OPTIMIZATION_PLAN.md](docs/plans/OPTIMIZATION_PLAN.md) |
| 拓展功能与后续体验优化 | [docs/ROADMAP.md](docs/ROADMAP.md) |
| 尚未完成的验证 | [docs/pending-verification.md](docs/pending-verification.md) |
| 版本与变更入口 | [CHANGELOG.md](CHANGELOG.md) |
| 首次公开仓库记录 | [docs/releases/RELEASE-0.1.0.md](docs/releases/RELEASE-0.1.0.md) |
| 实际 Skill 入口 | [skills/elx-magic-study/SKILL.md](skills/elx-magic-study/SKILL.md) |

## 仅本机保留的补充材料

这些路径可能被 Git 忽略，在新克隆中缺失是正常现象，不是让 Agent 重建、下载或上传私人材料的指令：

- `docs/design/`：原始 v0.1 设计书、后续范围变更、八页 HTML 使用图解。
- `docs/DELIVERY_20261003.md`：最初交付时的状态快照，部分事实已被后续绑定与入库更新。
- `artifacts/ingest/`：入库草稿、审批计划引用、回读回执；可能含私人链接。
- `artifacts/rename-20261003/`：更名前备份、README 预览、公开文件检查记录。
- `artifacts/fixes/`、`artifacts/test-runs/`、`artifacts/demo/`：修复备份、测试与演示产物。
- `.skillpick/`：前期调研索引与缓存。
- `.workbuddy/`：其他工具已有的本机记录；本轮未读取或改写其正文。

长期事实已经提炼到上述可版本化文档中；不要把私人文件强制加入 Git。
