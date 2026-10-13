# 魔法书屋 项目 SPEC

更新日期：2026-10-14。GitHub 正式版本为1.0.0，包含REQ-021文件与关键资源流程、REQ-022可选本地 MCP。发布状态见[发布回执](releases/RELEASE-1.0.0.md)，MCP验收边界见[PROG-017](progress/PROG-017-local-mcp.md)。责任模式：**LEVEL 1，用户明确指定**。

本文件是当前产品与技术事实入口，兼任 LEVEL 1 Project Brief。历史演变见进度与决策台账；未来功能见路线图；方案不代表已实现。

## 1. 项目简报

**名称**：魔法书屋 / Magic Study；Skill 标识 `elx-magic-study`；交流简称 `elx-ms`，不是另一个可独立调用的 Skill。

**用户与目标**：面向在飞书积累资料、希望在不同项目中复用知识的个人用户。减少“存过但找不到、找到后还要重读”的重复工作。

**核心路径**：用户提供资料或问题 → Agent 按 Skill 读取与组织 → 飞书保存有来源的知识 → 本地检索与原文核对 → 在当前项目中给出适用建议 → 经确认补回实践经验。

**交付方式**：公开 Git 仓库中的可安装 Skill、可选本地 stdio MCP、Node.js 辅助脚本、模板与合成示例。当前不自建 SaaS，不运营统一的托管知识库。用户连接自己的飞书和宿主调度器，因此按可下载交付的 LEVEL 1 管理；若未来承担托管账号、在线数据或常驻服务责任，再评估等级。

**当前范围已确认**：飞书单后端、首次授权引导、收藏整理与项目查询、本地增强检索、按需 HTML 图谱、定时整理检查接入。

**当前轮次结果**：以现有文件读取增量为基线实施本地 MCP 与独立包，并按当次确认发布1.0.0。已有个人入库与目录调整是历史完成事项，本轮未触碰真实知识库、迁移个人状态、删除、修改账号权限或配置全局 MCP；真实平台闭环仍待独立验收。

## 2. 已有能力与边界

REQ-021未发布增量：`file_import.py`准备常见本地文件正文、原件快照与Office图片候选；MarkItDown 0.1.8隔离运行时另装。关键图／PDF附件按`files-and-assets.md`由Agent使用官方XML插入，独立回执和资源回读；核心Markdown计划没有新增附件动作。7项本地合成格式／边界检查通过，真实资源上传与视觉仍待试点；不自动补写旧笔记。

REQ-022源码增量：`mcp/`是可选的本地 stdio 包，使用官方 TypeScript SDK v2；主协议进程通过异步 worker 调用原 `library.mjs`，不另建真实状态或写入规则。13个工具覆盖诊断、检索、正文/表格、偏好、有界同步、计划、状态、执行与恢复。模型持有计划摘要不能直接执行；`approve.mjs`要求本机用户在交互终端核对完整计划并输入批准短语，生成一次性凭据。MCP不暴露任意路径、删除、整篇覆盖或全平台采集；文件转换仍是可选 Skill 功能。合成协议检查不代表Codex全局安装或真实飞书写入验收。

| 能力 | 当前行为 | 边界 |
|---|---|---|
| 首次连接 | 诊断 CLI／身份，引导授权；space-discover 完整分页发现专用空间，Agent 经初始化确认后用官方 CLI 创建独立空间与首页，回读后绑定 | 默认名「魔法书屋知识库」；已有绑定不改名；错误或未读完不能当不存在；不自动扩大权限 |
| 资料收藏 | 保存来源、标题、备注和内容覆盖 | capture 是本地来源；配置工作台时同步管理条目，不代表知识文章已入库 |
| 整理入库 | 来源笔记、主题、实践；生成具体计划后按授权写入 | 创建、追加、唯一行内替换；复杂富文本另按官方流程 |
| 新资料分类 | 每次读正文和当前目录，优先复用；必要新分类 shelf 与来源笔记通过 parentStep 合并预览，一次确认后依次回读执行 | 分类最多两层；仅新来源；不足时 pending；不未经预览建目录、不迁移旧页 |
| 检索 | 中文分词／双字组合、BM25、多查询、引用邻居 | 没有独立向量模型；Agent 阅读正文判断语义和适用性 |
| 本地索引 | 目录分页与正文读取分别保存断点；元数据未变时跳过正文 | 修改时间仅是近似依据，可 force；缺时间时重读 |
| 知识图谱 | 离线 HTML，拖动、缩放、搜索、筛选、邻居与原文 | 连线依据是引用；有效摘要或标注正文摘录；浏览器新版交互待验 |
| 定时维护 | 准备提示与时间，通过宿主注册并记录回执 | 默认草稿与检查；没有注册与唤醒证据不能说已运行 |
| 失败处理 | 回读、只读诊断、未知结果恢复、未发送计划取消／替代 | 已发送或未知结果不能取消来掩盖影响；不盲目重发 |
| 书屋工作台 | 入库／预览／异常／查证后自动更新管理文档和一表五视图 | 初次具体资源和自动更新范围需确认；无常驻后台或批量队列；管理同步失败不重建文章 |
| 个人整理偏好 | 每次读取用户填写列，变化后询问是否先预览旧资料整理 | 不代填默认说明，不自动迁移；预览后偏好变化阻断旧方案 |
| 主题建议 | Agent读取双方正文，记录补充／冲突／时效建议及版本 | 不自动改主题正文；无评估不等于无建议 |
| 两类资料分区（0.10.0） | areas-bind核对首页直接子节点并登记links/personal；书屋管理在导航和初始化预览最先 | 不自动创建、移动或排序；未登记旧库继续原规则 |
| 个人记录（0.10.0） | 分类文档与动态表头；原生record_append插入行、填新单元格及全文回读 | 名称优先，品牌／备注可空或沿现有表头；同名同品牌先核对，未知结果不再插；复杂表格另按官方流程 |
| 推荐与字段建议（0.10.0） | 条目查询、文本筛选、限定候选池随机；Agent检查内容后建议扩列，分别给库内与网上结果 | 没有固定字段／条数门槛，不自动扩列／回填；Exa＋Agent Reach由宿主执行，文本条件不是低卡或预算证据 |

定时维护“已实现入口”与“用户已启用任务”是两个事实。不能用源码、配置文件或本地回执代替真实调度验收。

## 3. 用户交互与知识结构

常用请求：先收藏、整理入库、结合当前项目查资料、补充实践、生成图谱、检查知识库、安排定时维护。具体句式以 README 为准。

旧版飞书结构示例（仅解释历史，0.8.0新目录规则见REQ-017；不自动迁移）：

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
      ├── workbench.mjs：管理资源范围、偏好版本、Base镜像、自动区域保护与主题建议
      ├── lark.mjs：官方CLI调用、有限诊断、用户身份、Wiki范围、正文与元数据链接
      ├── opencli.mjs：已安装入口发现、独立参数调用，避免Windows cmd二次解析
      ├── verification.mjs：保留旧哈希协议，有限表格分隔行归一化核验
      ├── classification.mjs：分类上下文、协议校验、目录／主题版本、正文分类段落
      ├── content-areas.mjs：两类分区登记、实际归属与计划版本保护
      ├── records.mjs：动态表格解析、追加预期、条目查询和候选池随机
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

- Node.js 22+，辅助脚本无npm运行依赖；外部读取复用用户安装的工具。
- 当前源码/包/发布及本机安装0.9.0，版本源package.json，Skill及CLI版本一致；40文件及附件回读见RELEASE-0.9.0，本地构建见PACKAGE-0.9.0。
- 0.8.0验收为独立目录66项通过，原工作区曾发生Windows EPERM。当前改动基线在工作区66项通过；本轮新增回归和探针结果见PROG-013，不能将当前通过认定为历史环境根因已解决。
- npm test执行合成／模拟行为测试；npm run demo只生成合成资料，不连接真实飞书。真实平台、调度与跨宿主验收分别记录。
- Skill格式、脚本语法、文档本地链接及README原有图片与版式须核对；检查通过不等于语义质量达标。

REQ-019验收：工作区及字节一致临时副本分别85项通过，用户批准的管理资源试点完成CLI回读与备注/幂等检查。中间工作区EPERM再次出现，根因未解决；新的真实文章导入、全新空库和浏览器视觉仍待验，见[PROG-014](progress/PROG-014-workbench.md)。

workbench为library.json可选配置：三页URL/id/自动区hash、Base/table/视图、记录去重状态、偏好确认hash、主题建议与同步结果。偏好版本进入新payload，旧计划字段不改写。管理同步先持久化未知状态，再核对实际记录/自动区，只改机器字段和指定区域；文章成功与管理同步失败分开。绑定的三篇管理页从普通搜索、图谱、维护队列和知识统计中排除。首次资源创建由Agent按官方CLI完成并回读后注册，不是workbench-bind自动建页。

命名：摘要文档“书屋状态总览”，Base“书屋工作台”。既有试点文档原地改名，ID/链接/自动区域保持；新建模板采用同一命名，避免目录内两个同名工作台。

## 7. 当前问题与下一阶段

- 既有防重复入队、计划生命周期、扫描断点和版本化摘要已具备；内容主题目录、三类笔记命名和旧库清单整理已随0.8.0交付。
- REQ-018在当前源码处理表格格式误报、完整链接参数传递、缺文档URL补查和有限错误诊断；实际新平台与新用户环境仍需验收，个人异常计划不会自动修改。
- Windows EPERM发生条件及根因仍未确认；没有证据时不改存储原子性或系统设置。
- 后续候选为真实检索验收集、项目知识包及其他ROADMAP方向；书屋状态、偏好与主题建议已随0.9.0发布安装，其他真实链路/环境验证边界保留。

## 8. 工作区与恢复注意事项

- 当前项目根目录为D:\VibeCoding-Project\elx-magic-study；Skill标识仍elx-magic-study，个人数据默认兼容~/.elx-library，不自动搬迁。
- 恢复时核对Git、LEVEL状态、SPEC与当前任务；已忽略的私人产物和其他工具记录不作为新授权，不自动纳入提交。
- 历史发布、测试计数、授权和旧库移动结果以对应Progress／Release Record为准；旧异常计划保留真实状态，不因代码更新伪造完成。

## REQ-012 引导契约及后续演进

首次使用主动询问是否需要定时整理，即使已绑定飞书；已有选择不重复询问，拒绝不阻断使用。当前外部读取按reading-tools.md复用已有能力；缺OpenCLI优先引导OpenCLIApp，Agent Reach按其他读取需要另选。安装和平台权限按具体范围确认，不要求一次全部开通。

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

## REQ-017 内容主题目录（已随0.8.0交付）

新目录按内容主题直接位于授权首页下，最多两层；不默认创建收件箱容器／主题知识／实践经验顶层目录。待整理仅处理未完成资料，书屋管理按需容纳指南和维护记录。既有结构保持兼容，不依据目录名称静默改kind或recordRole。

新create的source/topic/experience支持titleSummary，生成具体概括丨末级内容分类；source仍需classification，topic/experience用实际parent或parentStep获取titleDestination并在执行前核对。来源／主题／实践正文分别标资料整理／主题综述／实践记录，重复或冲突类型拒绝；语义与实践证据由Agent核对。旧计划无新增字段兼容，原输入版本与技术kind不变。

旧资料整理是library-organization.md定义的Agent工作流：逐对象盘点正文、旧新标题路径、范围与依据，确认后官方CLI原地操作与回读；核心plan/apply没有新增move/rename命令。部分未知结果先查证，不复制重建、不删除空分类、不篡改旧计划。初始开发阶段尚未迁移；后续真实整理已执行，见 [PROG-012](progress/PROG-012-topic-organization.md)。

2026-10-11：本机0.8.0安装32文件校验通过，0.7.0备份保留；已有知识库整理清单随后获确认并执行完成，见PROG-012。

2026-10-11实际整理完成：2管理节点、14项移动、10项改名、28节点回读及索引同步无失败，旧页面保留不删除；3条历史异常计划保持原状态与payload，后续恢复需重新核对。

2026-10-11发布收尾：0.8.0 main／Tag／Release／32文件ZIP回读通过；本机安装already-identical。66项在源码逐字节一致的独立目录通过，原工作区EPERM环境问题保留待定位，见发布记录。

## REQ-018 稳定性优化（纳入0.9.0本地包）

contentComparison使用verificationText，仅规范已识别表格分隔行的连字符数量；保留列数、对齐、数据及代码块。旧normalizeText导出保留。新str_replace动作有verificationVersion=2，用新核验哈希；旧str_replace仍按旧哈希核验，旧create/append可通过新recover只读检查，不改原payload/digest。警告及partial_success依旧阻断。

parseCLIResult同时识别error与data.result/warnings，保留有限分类、错误码、警告数量、降级码、缺失scope与处理hint，不记录正文、原始警告、URL或凭据。apply的unknown步骤和错误输出保留diagnostic，不能据此盲目重试。

Lark.fetch在明确URL且响应缺URL时保留既有地址；裸token缺链接时查官方Drive元数据with_url。documentURL／未绑定可用的resolve-url核对实际文档、类型及Feishu URL；缺权限、错误token、非法域名或无链接停止，不猜测或重建。

scripts/opencli.mjs通过PATH发现已安装OpenCLIApp管理exe、直接exe或npm包内bin；限制入口范围并使用shell:false独立argv。识别失败或超时返回错误，不安装或修改全局工具，也不代表任意平台读取通过。

## REQ-020 个人记录与双来源推荐（0.10.0）

contentAreas为library.json可选登记，保存links/personal两个真实首页子节点的身份、位置与标题。新计划带contentAreasHash，发送前核对分区和目标实际位置；未登记旧库及旧计划保留原规则和不可变payload。同步／回读派生contentArea为links、personal或null（当前不在任何分区），不按目录名字猜。个人分类文档kind=personal，不要求外部sourceUrl或实践证据，不进待整理来源队列。

record_append用现有fields、原生tableId、基线和UUID幂等token；动态列沿用原表，名称列可沿名称／品名／店名，品牌不适用可省略。接口先插入行，再仅填新文本块；全文预期哈希保护旧备注和表格外内容。不是整体事务，未知／部分结果先查证，不能换计划绕过；合并／引用／资源单元格不普通追加。核心入口不自动扩列、批量补查、移动或删除。

record-context返回当前表格、字段、条目规模和缺口；是否建议新增列由Agent结合实际内容与推荐需求判断，不设固定数量门槛。record-search在个人文档表格条目上做BM25／字段文本筛选；--file限定已核对候选ID，--random以crypto.randomInt抽取。缓存及文本匹配不证明低卡、当前价、营业或真实体验，先回读和语义核对；网上结果由宿主Exa插件与Agent Reach路由获得，推荐不自动保存。

目录／首页模板先书屋管理、后链接资料与个人记录；真实旧库排序、迁移、Markdown导入、平台补查与原生表格显示尚未执行。当前版本及安装0.10.0，不将本地合成验收当真实飞书成功。需求与验收见[REQ-020](requirements/REQ-020-personal-records.md)和[PROG-015](progress/PROG-015-personal-records.md)。
