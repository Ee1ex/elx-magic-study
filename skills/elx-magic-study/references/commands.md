# 命令与数据协议

依赖：Node.js 22+；飞书操作需要官方 lark-cli。脚本无 npm 依赖。所有命令返回 JSON，失败进程退出非零；不把 `ok:false` 当空结果。

脚本位置是 `<SKILL_ROOT>/scripts/library.mjs`，以下称 `CLI`。个人状态默认 `~/.elx-library`；命令指定 `--home` 时应使用绝对路径。知识库编号可通过 `--library` 指定，否则使用首个绑定的默认库。多个库不要凭模糊名称自动选择。

## 读取与图谱

```text
node CLI doctor
node CLI status
node CLI sync --max-docs 30 --max-nodes 500
node CLI search --query "离线 授权" --query "断网 许可证" --limit 8
node CLI fetch --id <search返回的文档id>
node CLI lint
node CLI graph --output <绝对路径/new-graph.html>
```

search 返回本地缓存候选、片段行号、匹配词和引用邻居。行号不能直接转换为飞书块链接。`--offline` 只在用户接受缓存时使用；输出仍要说明是历史快照。

sync 会遍历限定 Wiki 子树并按上限轮转读取；目录不完整时不能认定所有旧节点已离开范围。第一版自动索引 docx，其他对象不假装已读取。图片、表格、附件等内容由 Agent 按官方文档分流。

## 外部来源

```text
node CLI capture --url <链接> --title <可确认标题> --note <收藏理由>
node CLI source-content --id <src编号> --file <正文UTF8文件> --coverage transcript --note "B站字幕；未核对画面"
```

两个命令仅生成本地记录，来源正文快照按内容 hash 留存。source-content 不代表自动向飞书保存。获取失败时保持 link_only，不填写虚构全文。

新输入记录使用 recordRole=input，生成知识页使用 derived，导航／维护页使用 navigation。旧远端记录没有角色时列为 needsClassification，不能自动把所有 source 都重新整理。确认单条角色后可执行 `classify --id <编号> --role input|derived|navigation --confirm`，只改本地角色，不修改正文或远端。

## 飞书写入计划

Agent 写一个普通 UTF-8 JSON 文件，再 `plan --file <文件>`：

```json
{
  "purpose": "保存来源并补充离线使用主题",
  "sourceIds": ["本地已登记的来源编号"],
  "actions": [
    {"kind":"create","title":"来源笔记：资料标题","category":"source","content":"# 来源笔记\n\n来源：https://example.com/article\n\n依据充分的内容。"},
    {"kind":"append","doc":"https://example.feishu.cn/wiki/真实节点token","category":"topic","content":"## 新资料补充\n\n新证据与适用条件。"}
  ]
}
```

示例 URL／编号不得直接用于执行。类别支持 source/topic/experience/document/index/log。同一计划中每个已有文档只能编辑一次，最多 12 项。创建标题必须与已索引文档不冲突。

创建动作可选 `parent`：填写已存在的分类 Wiki／docx 链接。脚本会验证该节点属于已授权写入根、记录其真实 Wiki token，并在创建后回读检查直接父节点。省略时仍使用写入根。首次分类入库先创建分类页，再用实际返回的分类链接生成内容计划；不要捏造节点 token。

脚本保留完整正文供预览，并为创建／追加加入可读的 ELX记录 标识用于恢复。`str_replace` 只支持唯一、非空的单行替换，保留正文其他内容；不支持删除、整篇覆盖和自动资源下载。

```text
node CLI plans
node CLI plan-show --id <计划编号>
node CLI apply --id <计划编号> --approve <用户已确认预览的digest>
node CLI recover --id <计划编号> --step 1 --doc <核实的结果链接>
node CLI diagnose --id <计划编号> --step 1 --doc <结果链接>
node CLI plan-cancel --id <未发送计划> --approve <原digest> --reason <原因>
node CLI plan-supersede --id <未发送旧计划> --replacement <新预览计划> --approve <旧digest> --reason <原因>
```

digest 绑定预览内容，不能自行生成新计划后沿用旧确认。计划写入状态不代表语义正确，Agent 仍应核对实际结果与用户目标。

取消／替代只改变本地未发送计划的生命周期，保留 payload 和 digest。diagnose 是只读检查，不等于 recover；成功诊断后仍需 recover 更新核验状态。status 会给出待确认、待查证等计数。

## 维护任务

```text
node CLI maintenance --refresh
node CLI schedule-plan --time 09:00 --timezone Asia/Shanghai --days MO,WE,FR --output <新调度方案JSON>
node CLI schedule-record --file <真实宿主回执JSON>
```

schedule-plan 只准备提示与时间配置；实际调用宿主调度工具后才算创建。回执字段：provider=`codex-heartbeat`、automationId、status、time、timezone，以及可选 days/name。不能编造回执。

## 本地文件与数据边界

文件写入使用绝对或明确参数路径；图谱和调度方案拒绝覆盖已有文件。状态写入使用原子替换，单机同一状态目录由 OS 锁避免并发写。锁不跨设备，也不保护用户手动编辑飞书。

演示入口 `demo-import --id <新id> --file <清单>` 只接受 `demo:true`，与飞书库分离，不能执行远端同步或写入。文件被成功导入不表示其语义真实。

## 同步断点与刷新

重复 sync 会续跑目录与正文队列；catalogComplete=true 且 remainingThisPass=0 表示本轮完成。下一次启动新一轮。directoryTasks 仅表示待办任务数，不是剩余文档数。

相同非空修改时间可跳过正文，skippedUnchanged 给出数量，不更新 fetchedAt；缺元数据时照常读取。要整轮重读可 `sync --restart-scan --force`，之后继续 sync 直到完成；不要每次都 restart。游标失效时可显式 restart-scan，保留正文与旧记录。节点读取前再次核对范围；完整目录才标 outOfScope，绝不删除。

## 可选的图谱摘要

actions 中可添加 `"summary":"讲什么、何时有用及依据边界。"`（1—400 字符）。摘要描述动作执行后的整篇页面，纳入计划 digest。回读成功后保存 summaryForHash；图谱只接受与当前 hash 一致的摘要，否则使用明确标注的正文摘录。不要为旧数据批量伪造版本。

## 新资料内容分类

`classification-context --id <输入来源编号> --query "正文关键词" [--query "另一组词"] [--limit 300]` 只读返回两层节点、已有标签和主题候选，最多列 1000 个目录节点。locations.complete=false 不能当全目录；source.truncated=true 需继续分段读正文；topicCandidates 为缓存 BM25 候选，不代表已确认语义关联。

plan 的新建 source 动作可附 classification，其来源版本、标签、依据与主题引用进入同一 digest；脚本将这些信息附到来源正文。语义判断、JSON 协议及用户修改预览流程见 [classification.md](classification.md)。旧动作不带该字段仍保持兼容。`classify --role` 是另一项输入／输出角色设置，不是内容分类。

status／maintenance 的 pendingContentClassification 表示新来源笔记的待内容分类项；不自动重新分类旧页。

## 当前宿主的定时任务

schedule-plan 输出 kind=host-automation 的未注册方案，交给当前Agent自身自动化功能执行。schedule-record 接受实际 provider 标识、automationId、status、time、timezone 和 verified:true，按 provider＋automationId 去重；verified 只表示Agent确实已回读任务，不代表脚本验证了自动唤醒。旧记录仍可读取，新的回执必须明确验证。

正式包不提供图标命令；暂停实验保存在项目 experiments/category-icons，不随 Skill 安装。
