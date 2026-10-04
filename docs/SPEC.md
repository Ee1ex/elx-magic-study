# 魔法书屋 项目 SPEC

更新日期：2026-10-05。当前版本0.7.0，包含REQ-016精细短标题和表格化首页说明书；发布安装进行中，结果见本轮记录。0.6.0发布事实见 [Release Record](releases/RELEASE-0.6.0.md)。责任模式：**LEVEL 1，用户明确指定**。

本文件是当前产品与技术事实入口，兼任 LEVEL 1 Project Brief。历史演变见进度与决策台账；未来功能见路线图；方案不代表已实现。

## 1. 项目简报

**名称**：魔法书屋 / Magic Study；Skill 标识 `elx-magic-study`；交流简称 `elx-ms`，不是另一个可独立调用的 Skill。

**用户与目标**：面向在飞书积累资料、希望在不同项目中复用知识的个人用户。减少“存过但找不到、找到后还要重读”的重复工作。

**核心路径**：用户提供资料或问题 → Agent 按 Skill 读取与组织 → 飞书保存有来源的知识 → 本地检索与原文核对 → 在当前项目中给出适用建议 → 经确认补回实践经验。

**交付方式**：公开 Git 仓库中的可安装 Skill、Node.js 辅助脚本、模板与合成示例。当前不自建 SaaS，不运营统一的托管知识库。用户连接自己的飞书和宿主调度器，因此按可下载交付的 LEVEL 1 管理；若未来承担托管账号、在线数据或常驻服务责任，再评估等级。

**当前范围已确认**：飞书单后端、首次授权引导、收藏整理与项目查询、本地增强检索、按需 HTML 图谱、定时整理检查接入。

**当前轮次范围已确认**：REQ-016新笔记精细短标题、首页介绍及说明书；仅源码／测试／文档、本地提交，以及用户已预览的现有知识库首页和一篇方法笔记真实测试，不自动发布或升级全局安装。

## 2. 已有能力与边界

| 能力 | 当前行为 | 边界 |
|---|---|---|
| 首次连接 | 诊断 CLI／身份，引导授权；space-discover 完整分页发现专用空间，Agent 经初始化确认后用官方 CLI 创建独立空间与首页，回读后绑定 | 默认名「魔法书屋知识库」；已有绑定不改名；错误或未读完不能当不存在；不自动扩大权限 |
| 资料收藏 | 保存来源、标题、备注和内容覆盖 | capture 是本地记录，不代表飞书已保存 |
| 整理入库 | 来源笔记、主题、实践；生成具体计划后按授权写入 | 创建、追加、唯一行内替换；复杂富文本另按官方流程 |
| 新资料分类 | 每次读正文和当前目录，优先复用；必要新分类 shelf 与来源笔记通过 parentStep 合并预览，一次确认后依次回读执行 | 分类最多两层；仅新来源；不足时 pending；不未经预览建目录、不迁移旧页 |
| 检索 | 中文分词／双字组合、BM25、多查询、引用邻居 | 没有独立向量模型；Agent 阅读正文判断语义和适用性 |
| 本地索引 | 目录分页与正文读取分别保存断点；元数据未变时跳过正文 | 修改时间仅是近似依据，可 force；缺时间时重读 |
| 知识图谱 | 离线 HTML，拖动、缩放、搜索、筛选、邻居与原文 | 连线依据是引用；有效摘要或标注正文摘录；浏览器新版交互待验 |
| 定时维护 | 准备提示与时间，通过宿主注册并记录回执 | 默认草稿与检查；没有注册与唤醒证据不能说已运行 |
| 失败处理 | 回读、只读诊断、未知结果恢复、未发送计划取消／替代 | 已发送或未知结果不能取消来掩盖影响；不盲目重发 |

定时维护“已实现入口”与“用户已启用任务”是两个事实。不能用源码、配置文件或本地回执代替真实调度验收。

## 3. 用户交互与知识结构

常用请求：先收藏、整理入库、结合当前项目查资料、补充实践、生成图谱、检查知识库、安排定时维护。具体句式以 README 为准。

飞书结构示例（旧库可保留，新库按资料逐步建立，不预建固定四类）：

```text
绑定入口／首页
├── 收件箱与来源
├── 主题知识
├── 实践经验
└── 维护记录
```

首页承担导航，分类可用 Wiki 文档节点承载。来源笔记回答“材料讲什么”，主题页回答“目前知道什么”，项目参考回答“现在怎么用”。实践经验必须说明实际验证条件，不能为了填满分类编造经验。

当前绑定机制是节点子树或单篇 docx，不是整个知识空间的永久自动发现授权。首页外新增顶层节点，需要重新检查并明确纳入范围。

重要主张带来源；原文观点、Agent 推断和用户经验分开。视频字幕不是画面核验；教程转述共同原文不算多份独立验证。

## 4. 架构与调用关系

```text
用户请求
  → SKILL.md 选择工作流
  → 当前 Agent 阅读按需 references／templates
  → scripts/library.mjs 命令入口
      ├── onboarding.mjs：未绑定可用的本地介绍状态与明确偏好
      ├── library-core.mjs：绑定、索引、收藏、计划、写入、维护
      ├── lark.mjs：官方 CLI 调用、用户身份、Wiki 范围与正文
      ├── classification.mjs：分类上下文、协议校验、目录／主题版本、正文分类段落
      ├── scan.mjs：分页和页内检查点，独立正文队列
      ├── summaries.mjs：版本匹配摘要与干净正文摘录
      ├── retrieval.mjs：分词、BM25、关系抽取、只读检查
      ├── graph.mjs + assets/graph.html：本地图谱导出
      └── store.mjs：路径、ID、原子状态写入、单机互斥
```

来源获取复用宿主或已安装的 Agent Reach 等工具，不是本包自带全平台采集器。网页／字幕正文作为资料处理，不获得执行命令的权限。

安装脚本 `scripts/install.mjs` 复制完整技能包，逐文件校验；不同内容的同名目录不覆盖。`scripts/demo.mjs` 只使用合成材料。

## 5. 数据与状态契约

### 5.1 两套状态不得混用

- `.elx-level/`：项目开发流程状态，可版本化；仅放项目任务与验证，不放用户资料。
- `~/.elx-library/`：用户实际知识库状态，默认保持旧路径兼容；不得纳入代码仓库。

覆盖优先级：显式 `--home` → `ELX_MAGIC_STUDY_HOME` → 旧 `ELX_LIBRARY_HOME` → 默认目录。品牌和仓库目录改名不意味着迁移用户数据。

### 5.2 用户资料的当前对象

| 对象 | 关键数据 | 读写方 |
|---|---|---|
| config.json | 默认知识库编号 | bind、loadLibrary |
| library.json | 账号指纹、读写根、文档缓存、同步位置、调度回执 | bind/sync/fetch/capture/maintenance |
| documents | 文档 ID、URL／别名、类型、Markdown、内容 hash、覆盖与时间 | 索引、检索、图谱、计划验证 |
| 原始快照 | 来源编号、正文、覆盖方式、内容 hash | source-content 写入；同内容快照保留 |
| operations | 不变 payload、digest、每步状态、实际结果 URL | plan/apply/recover 与任务查看 |

OPT-01 已加入可选 `recordRole`：input 为待处理输入，derived 为生成知识页，navigation 为导航／维护页。新创建知识页记录 producedBy 和 inputVersions；只有 input 的实际 hash 变化才进入待整理队列。旧本地收藏可按既有 remote=false 识别为输入；其余未知角色列入 needsClassification，不自动回填。单条 classify 需要明确确认，正文保持原样。schemaVersion 保持 1，旧字段不删除。

OPT-03 新增可选 scan 检查点：绑定账号与读取根，保存分页／页内偏移／已见节点和独立 pendingReads。完整目录才标记 outOfScope，不删除记录。账号不符拒绝运行，读根变化重建断点；子节点移动时先查范围再读取。重复／无效分页报错并保留证据，可 --restart-scan；正文失败保留旧缓存并标 unavailable，下一轮重试。相同非空修改时间允许跳过正文，fetchedAt 不伪造更新；无元数据则读取。--force 对尚未处理的正文强制刷新，全量强制请配合 --restart-scan 并续跑至完成。

OPT-04 新增可选 summary／summaryForHash。计划 action.summary 为 1—400 字符的整篇简述，进入 digest，完成时绑定 step.verifiedHash。当前正文 hash 不符或旧摘要未标版本时不展示旧简述，转为明确的正文摘录；不修改旧正文，不强制全库模型调用。

### 5.3 新资料分类契约

- classification-context 只读返回输入缓存及截断标记、授权写入根下两层节点、有效已有标签、BM25 主题候选；节点不等于语义分类，目录 complete 仅覆盖该两层。Agent 阅读正文和节点用途后选择。
- 新建 source 动作的可选 classification 包含 sourceId/sourceHash、status、basis、reason/evidence、tags、relatedTopics、proposedCategory；脚本生成真实 destination 路径。旧计划无该字段仍兼容。
- content 判断需正文和逐字依据；仅链接／未知覆盖必须 pending、无内容标签与关联主题。用户指定可选已有位置，仍不冒充全文。标签规范全半角、空格、大小写并复用现有写法，同义词归并由 Agent 判断。
- 关联主题必须已索引、在读范围内，提供当前 hash、关联理由与两边原文证据；plan/apply 检查版本和路径，来源自动加入原有来源版本约束。修改预览重建计划及 digest，不改操作历史。
- 写入的来源笔记追加分类段落、标签和真实主题引用；本地保存 classification、tags、classificationForHash。主题不顺带改写，同来源不重复创建；旧页补充仍走独立增改计划。pendingContentClassification 与旧版 needsClassification 角色分类分开显示。
- proposedCategory 保持旧版“只建议”语义。REQ-015 的明确新分类使用 create/shelf，包含用途正文；parentStep 从 1 开始引用本计划前序 shelf，不与 parent 混用。预览用步骤号和分类路径，不伪造 URL；确认涵盖分类和笔记，执行回读后再解析真实父节点，不改 payload/digest。语义同义分类仍由 Agent 比较，脚本不能保证分类质量。
- shelfPath/plannedParentPath 保留前序步骤或真实父路径；拒绝非分类父步骤、前向引用、超过两层、重复分类和不完整查重。回读后的分类改名、正文编辑、路径移动都会阻断依赖写入。新分类记录 navigation；只有完整计划完成才标记输入处理完成。旧计划无新增字段继续兼容。

### 5.4 可选界面图标流程与暂停实验

REQ-010／011图标脚本已移至 experiments/category-icons，不随正式Skill打包，也不参与正常测试。个人状态中的历史字段与已设置的飞书图标保持，不自动迁移或清除。

REQ-013新增纯指引：实际新增分类或分类改名后，按 references/optional-icons.md 检查当前工具是否可观察并操作飞书网页或客户端；不按Agent品牌断定能力。具备时按具体目标、旧图标和建议合并询问，用户同意后才操作。无能力跳过；普通内容更新不触发；人工图标保护；刷新或重开后核对结果及标题正文不变。没有新命令、持久化字段或后台监听，定时任务只提建议。

### 5.5 写入约束

先展示目标与内容，再使用该预览的 digest 执行。执行前核对账号、根、来源和目标基线；创建后核对实际父节点；写后核对正文和返回状态。

分类页与子文档可在同一计划预览，用 parentStep 表达依赖；执行时分类先创建并回读，再解析真实父节点写子文档。正文中的额外跨文档引用仍只使用实际返回 URL，需要额外修改时另列范围。多文档没有整体事务；未知写入先查证，recover 后按原计划继续，不自动删除或重新创建。

OPT-02 增加 plan-cancel、plan-supersede 和只读 diagnose。终态保留原 payload／digest，不可 apply／recover；替代目标必须是同库同范围的新预览。只有从未发送的计划可终止。诊断给出有限摘录和比较元数据，没有放宽既有归一化规则。服务端 success 与本地 VERIFY_FAILED 可以同时出现，实际失败记录仍需核对，不能直接认定数据丢失。

## 6. 运行、测试与交付

- Node.js 22+；脚本无 npm 运行依赖。
- 飞书连接依赖官方 lark-cli；实现曾对本机 1.0.93 的帮助与内嵌参考做过核对，升级后仍要重新核验接口。
- 主要验证环境是 Windows／Codex。不能据代码可运行就宣称其他平台已验收。
- `npm test`：本轮正式范围实际重跑 51 项（包含通用宿主回执测试），通过；是合成和模拟行为测试。
- `npm run demo`：生成合成知识库图谱与检索结果，不连接真实飞书。
- Skill 格式检查使用 Skill Creator 的 `quick_validate.py`；不是语义质量认证。
- Git 远端：`https://github.com/Ee1ex/elx-magic-study.git`，0.3.0 已发布并回读，见 [Release Record](releases/RELEASE-0.3.0.md)。

当前版本来自 `package.json`。本轮版本工具已将 0.2.0 演进为 0.3.0；历史交付证据与真实飞书入库记录分开保存，见进度和发布台账。

## 7. 当前问题与下一阶段

四项优化源码已完成：防重复入队、计划生命周期与只读诊断、目录断点、版本化图谱摘要。38 项合成测试通过；浏览器拒绝本地 file 协议，故新版交互仍待验收。本机已备份旧版并安装 0.3.0，23 个文件与源码校验一致；真实资料不迁移。GitHub 0.2.0 已发布，结果见 [Release Record](releases/RELEASE-0.2.0.md)。任务与验收边界见 [可执行优化计划](plans/OPTIMIZATION_PLAN.md)。

新资料自动分类已在本地实现，见 [REQ-009](requirements/REQ-009-classification.md) 和 [PROG-003](progress/PROG-003-classification.md)；本轮已完成 0.3.0 发布及本机安装，见 [发布记录](releases/RELEASE-0.3.0.md)。后续体验与功能设想见 [路线图](ROADMAP.md)。本 SPEC 不把候选设计写成已具备的能力。

## 8. 工作区与恢复注意事项

Skill、安装目录与 GitHub 仓库已使用 `elx-magic-study`。本机项目文件夹仍叫 `elx-library`，此前重命名因占用失败；实际根路径以当前宿主和文件系统检查为准，不凭期望名称操作。

本轮接管基线是 `df42fae`，其 README 插图变更属于已有工作，完整保留。`.workbuddy/` 是已有未跟踪目录，未读取或改写正文，不纳入本轮提交。

恢复任务时先核对 Git、LEVEL 状态和 SPEC，再读对应任务卡。历史中某次“未绑定”“23 项测试”“尚未发布”仅表示当时状态，不应覆盖后续事实。

## REQ-012 当前引导契约

首次使用主动询问是否需要定时整理，即使已绑定飞书；已有选择不重复询问，拒绝不阻断使用。缺外部读取工具时先提供 Agent Reach 官方 GitHub 来源和安装范围，等授权；OpenCLI单独选择，平台按实际Skill/reference按需配置，不要求一次全部开通。

schedule-plan输出通用host-automation方案；当前Agent可调用自身工具时执行并回读，否则提供任务提示与准确手动配置步骤，不编造WorkBuddy菜单。schedule-record需要provider、真实ID、status、时间／时区与verified:true，按provider＋ID更新；既有记录不迁移。回执保存不等于唤醒验证。

0.4.0发布与安装已完成，见 [发布记录](releases/RELEASE-0.4.0.md)；历史版本、试验和打包阶段的“尚未安装”不代表当前状态。

2026-10-04：用户要求开始更新，批准本轮0.4.1打包、本机安装和GitHub发布；不实际修改知识库图标。

0.4.1发布与安装已回读，见 [Release Record](releases/RELEASE-0.4.1.md)。本轮没有实际修改飞书图标。

## REQ-014 首次导览与场景提示

onboarding只读读取个人状态目录的onboarding.json，无记录则needsIntroduction=true，不要求已有库。onboarding-record接受introduced:true与readingTools/opencli/schedule/icons/graph明确choices，增量合并；ask/later/never/interested只表示提醒偏好，不允许enabled。文件独立于单库状态，不写远端或公开仓库；当前用户指令优先，不静默回填既有用户。

Skill按feature-tour.md在首次介绍核心功能、可选项、初始化步骤；后续每轮最多一个相关可选提示，拒绝／暂缓后不按调用次数重问。手动维护、外部读取缺口、多文档关系、新增／改名分类等按具体条件触发。无人值守任务不询问可选功能，不自动安装或写入。仅在调用Skill时提示，不后台监听。

2026-10-04：用户要求发布并更新本机，授权0.5.0发布和Codex安装；不改用户偏好，不创建实际任务。

0.5.0发布安装回读见 [Release Record](releases/RELEASE-0.5.0.md)。

## REQ-015 桌面引导与专用空间

缺 OpenCLI 时优先引导下载 OpenCLIApp，由用户在应用内安装／修复 CLI，并安装 OpenCLI Skills 到 Agent；分别检查 CLI、宿主发现、浏览器／扩展桥接及目标实际读取。Agent Reach 按所需能力另选，不作为桌面安装前置。截图标签是版本示例，不保证任意版本界面一致。

space-discover 未绑定可用且只读：默认搜索「魔法书屋知识库」，已有绑定优先；空间分页完整后区分无匹配／单候选／多候选，最多100页；预算耗尽返回 incomplete，错误不归零。仅确认当前用户可访问范围，不证明无权访问的空间不存在。官方 +space-list 的 data.spaces 与兼容 items 被归一化；has_more 必须明确。

新空间创建与首页回读是 library-bootstrap.md 规定的 Agent 官方 CLI 工作流，不是 space-discover 自动创建。用户确认初始化范围后，按真实 space_id 建立／核对「书屋首页」，绑定其子树；初始化记录保存在个人目录，未知结果不重发。同一确认范围内连续执行，额外权限仍单独确认。已有库不改名、不迁移，首页之外顶层节点不自动纳入读取范围。

本轮合成验收与实际未验证边界见 [PROG-009](progress/PROG-009-first-use-library.md)。

2026-10-04：REQ-015已随0.6.0发布并安装，61项合成回归通过；真实平台测试待用户提供具体资料与范围。见 [发布记录](releases/RELEASE-0.6.0.md)。

2026-10-04真实验收：本机独立状态目录完成授权、OpenCLI正文和部分评论读取、独立Wiki／首页创建绑定，以及分类与笔记合并预览后的真实写入回读。Windows分享链接入口及首页URL通过有界绕行处理，未固化修复；从零安装仍未测。见 [真实验收](progress/PROG-010-live-acceptance.md)。

## REQ-016 精细标题与首页说明书

新来源使用titleSummary＋classification；formatNoteTitle将NFKC概括（最多10 Unicode码点，优先约8字）与真实末级分类用丨连接，禁止混入分隔符／控制字符，不截断；同时给完整title须一致。新旧分类父节点均适用，正文首H1同步，原始标题和来源保留正文。首页、分类文档不套此格式；旧动作无titleSummary继续兼容，不批量迁移旧标题。

新首页使用assets/templates/library-home.md：本库大标题与介绍用途在前，功能、可复制提示词、可选条件和确认流程在后，实际导航末尾。正文进入初始化预览，空首页绑定后可用原plan append/index写入回读；已有首页需明确局部范围，不自动重复或覆盖。此次两处真实页面测试通过，详情见 [PROG-011](progress/PROG-011-note-titles-home.md)。

2026-10-05追加授权：发布0.7.0 main／Tag／Release／ZIP，并备份升级本机Codex；不额外改动真实知识库或个人状态。
