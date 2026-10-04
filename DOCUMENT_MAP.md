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
| 四项优化实施记录 | [docs/progress/PROG-002-optimizations.md](docs/progress/PROG-002-optimizations.md) |
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

- [0.2.0 发布记录](docs/releases/RELEASE-0.2.0.md)：提交、Tag、Release 和回读证据。

- [新资料分类需求](docs/requirements/REQ-009-classification.md) 与 [实施验收](docs/progress/PROG-003-classification.md)：未发布源码范围和证据。

- [0.3.0 发布与安装记录](docs/releases/RELEASE-0.3.0.md)：远端回读、旧版备份、新版校验与恢复边界。

- [分类原生图标需求](docs/requirements/REQ-010-category-icons.md) 与 [实现记录](docs/progress/PROG-004-category-icons.md)：浏览器试点和未发布工作流。

- [终端图标需求](docs/requirements/REQ-011-portable-icons.md)、[实施与试用记录](docs/progress/PROG-005-portable-icons.md)、[WorkBuddy/harness 使用说明](experiments/category-icons/skills/elx-magic-study/references/terminal-icons.md)。

- [读取工具与首次定时引导记录](docs/progress/PROG-006-onboarding.md)（REQ-012）。

- [暂停图标实验归档](experiments/category-icons/README.md)：不随正式Skill安装。

- [0.4.0本地包记录](docs/releases/PACKAGE-0.4.0.md)。

- [0.4.0发布与安装记录](docs/releases/RELEASE-0.4.0.md)：远端附件与安装校验。

- [可选界面图标引导记录](docs/progress/PROG-007-optional-icons.md)（REQ-013）；[Skill流程](skills/elx-magic-study/references/optional-icons.md)。

- [0.4.1发布与安装记录](docs/releases/RELEASE-0.4.1.md)。

- [首次导览与场景提示记录](docs/progress/PROG-008-feature-tour.md)（REQ-014）；[Skill导览](skills/elx-magic-study/references/feature-tour.md)。

- [0.5.0发布与安装记录](docs/releases/RELEASE-0.5.0.md)。
- [REQ-015首次专用知识库](docs/requirements/REQ-015-first-use-library.md)、[实施验收记录](docs/progress/PROG-009-first-use-library.md)及[Skill初始化指引](skills/elx-magic-study/references/library-bootstrap.md)：0.6.0功能与验收边界。
