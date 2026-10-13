# 魔法书屋本地 MCP · AI 开发交接

日期：2026-10-13。状态：开发参考文档已编写，MCP 未实施。

## 1. 接手先看

用户认可“轻量 Skill + 本地 MCP + 复用现有核心”，随后只要求先写计划和交接文件。当前不要实现 MCP、安装依赖、改全局配置、操作真实飞书或发布。收到明确实现指令再按 [开发计划](LOCAL_MCP_PLAN.md) 推进，不重复讨论已确定的产品方向。

本文件不是执行授权。历史发布和私人入库授权各有范围。项目仍为 LEVEL 1，不另建治理系统或真实状态目录。

## 2. 阅读顺序

1. [AGENTS.md](../../AGENTS.md)、[DOCUMENT_MAP.md](../../DOCUMENT_MAP.md)。
2. [STATUS](../elx-level/STATUS.md)、`.elx-level/state.json`、[SPEC](../SPEC.md)。
3. [MCP 开发计划](LOCAL_MCP_PLAN.md)，尤其工具契约、授权和验收。
4. [REQ-020](../requirements/REQ-020-personal-records.md)、[PROG-015](../progress/PROG-015-personal-records.md)、[发布记录](../releases/RELEASE-0.10.0.md)。
5. [Skill](../../skills/elx-magic-study/SKILL.md)及个人记录、写入、工作台参考。
6. 对应源码和测试，再决定最小修改。

开发时使用 ELX Level 和 Skill Creator 的适用流程；不自行启动多个 Agent，除非当时用户或适用规则明确要求。

## 3. 代码定位

下列路径相对项目根目录：

| 文件 | 重点 |
|---|---|
| `package.json` | 正式 0.10.0，Node >=22，原包无 npm 运行依赖 |
| `skills/elx-magic-study/scripts/library.mjs` | `run(argv)`、参数和统一锁、直接执行输出保护 |
| `skills/elx-magic-study/scripts/library-core.mjs` | makePlan/applyPlan/diagnosePlan/recoverPlan、同步读取 |
| `skills/elx-magic-study/scripts/lark.mjs` | spawnSync、身份范围核对、原生表格、超时 |
| `skills/elx-magic-study/scripts/store.mjs` | 原子 JSON 写入、状态目录、单机锁 |
| `skills/elx-magic-study/scripts/records.mjs` | 表头、条目、随机；可能有其他任务修复 |
| `skills/elx-magic-study/scripts/content-areas.mjs` | 分区身份和版本保护 |
| `skills/elx-magic-study/scripts/workbench.mjs` | 管理同步副作用，偏好与文章状态分离 |
| `tests/` | 现有合成测试，不引入真实正文 |
| `scripts/install.mjs` | Skill 安装与逐文件核验，不直接假定适用 MCP 依赖 |

当前不存在本项目 MCP 服务，拟议 `mcp/` 和工具名不代表已实现，不能让用户执行尚不存在的入口。

## 4. 产品决定

- 导航顺序：书屋管理、链接资料、个人记录。
- 名称、品牌、用户备注优先；已有表头优先；其他列按内容建议，不设数量门槛。
- 已有唯一目标单条记录可按当次请求保存；首次新建及扩列先预览。
- 低卡和预算条件需要证据；文本过滤不证明条件成立，随机仅在合格候选池内进行。
- 库内与网上推荐分列。宿主协调 Exa／Agent Reach，MCP 不自动继承插件能力。
- 模型由客户端提供，授权继续通过 lark-cli；本地 MCP 不等于无需依赖或全离线。
- 保留 CLI、同一核心与真实状态，不另维护一套写入规则。

## 5. 工作区交接

文档开始检查时 HEAD 为 `cf1164c`（0.10.0 发布事实收尾）；交接完成前另一个任务已提交 `475330c`（普通表格跨度兼容与个人入库验收）。本文件的文档提交在其后。这些都是快照，接手时以 Git 为准。

本轮最初发现其他任务在修改 `.elx-level/`、AGENTS、CHANGELOG、SPEC、PROG-015、`records.mjs` 和 `tests/records.test.mjs`；这些变更已由其原任务提交。本轮未覆盖或代为提交它们。接手时仍需检查新出现的修改，不 reset、stash 或从旧标签恢复。

交接完成前 STATUS 已记录个人记录导入、目录导航和管理同步 completed；这是原任务的完成记录，MCP 仍未实施。部分旧文档仍提到 0.9.0，版本与能力以最新 SPEC、Release 和证据为准。本轮未改写该任务的机器状态。

真实个人状态、草稿和操作回执不能成为公开测试样本。不得为 MCP 调研额外读取私人正文，不能重复执行既有入库。

## 6. 收到实现指令后的第一步

1. 核对 Git、规则、状态和上述文档，标明已有修改归属。
2. 验证 LEVEL 状态；若仍属于另一进行中任务，不自行覆盖，先协调或仅记录当前切片。
3. 建立对应 REQ/PROG 并链接本计划；编号按届时台账分配，不假定 REQ-021 空闲。
4. 在当前基线上运行适当回归，记录 commit、差异与实际结果，不沿用历史 106 项。
5. 完成 P0：SDK 版本、隔离协议、工具 schema、精确计划确认原型。
6. P0 通过再做 P1 查询；写入满足授权契约后才开放。

只读检查：

```powershell
git status --short
git log -5 --oneline
node skills/elx-magic-study/scripts/library.mjs help
```

收到开发测试授权后：

```powershell
node --test --test-concurrency=1 tests/*.test.mjs
```

LEVEL 验证形式为 `python <ELX_LEVEL_ROOT>/scripts/workflow.py validate --project <项目根目录>`，先确认可用 Python，不为简单检查自动安装运行时。

## 7. 必须先解决的工程点

1. 同步飞书调用隔离到异步 worker，保持协议主进程响应。
2. 不暴露任意 shell、CLI、状态目录、无限制文件路径。
3. digest 不是人类授权证明；P0 验证可信的具体计划确认。无此能力只查询／预览，或走本地人工确认。
4. plan 可能写管理页，逐项审计副作用，不误标只读。
5. 超时／取消可能发生在远端已写后，先查 operation，不自动 apply 重试。
6. BUSY、版本冲突、管理同步失败分别处理。
7. 安装 MCP 不迁移真实状态、不重建库、不重置偏好。

SDK 精确版本、确认入口形式属于 P0 待实测的技术选择。客户端能力不能按品牌猜测。历史工作区 EPERM 未解决，隔离副本通过不等于原环境修复。

## 8. 本轮交付和验收边界

本轮只交付计划、交接及导航／进度入口，检查内部链接、diff 和公开内容；不运行产品功能测试、不改依赖、不操作飞书。LEVEL 状态结构验证有效，不代表入库或 MCP 完成。

实现后必须报告实际工具列表、平台和客户端、测试层级、未验收项、安装发布状态及数据是否变化。握手成功、文件存在和包生成都不等于保存回读通过。

## 9. 可复制的继续开发提示

> 请阅读 AGENTS.md、DOCUMENT_MAP.md、docs/SPEC.md、当前 LEVEL 状态，以及 docs/plans/LOCAL_MCP_PLAN.md 和 LOCAL_MCP_HANDOFF.md。核对当前授权及工作区已有修改，再按 MCP 计划从 P0 实施。保留其他任务修改，使用 stdio、共用核心、保留 CLI；先诊断查询，再受控保存和恢复。真实飞书试点、全局安装和发布按实际范围另行确认，不把本文或历史授权当许可。每个切片提供可复现验收和仅含本次文件的本地提交。
