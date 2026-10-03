# 无 Computer Use 的 Agent：终端图标流程

适用于 WorkBuddy、其他 harness 或任何能运行 Node 命令的 Agent。运行路径不需要 Codex、截图理解模型或 Computer Use 插件；仍需要一台具有已登录飞书浏览器的电脑，以及 OpenCLI 的浏览器桥接。无头远端执行器没有该浏览器时，不能凭空改图标。

## 先检查环境

- Node.js 22+、飞书官方 lark-cli 和已有知识库绑定。
- 用户自行安装／连接 OpenCLI 与其浏览器扩展。先运行 `opencli doctor`，应看到扩展与连通性成功；不要因缺扩展自动更改浏览器权限。
- 浏览器登录对应飞书账号，并能编辑目标分类。CLI 的飞书授权与浏览器登录是两回事。
- 当前实现实测 OpenCLI 1.8.6，使用其公开 Page SDK 导出；不修改全局 OpenCLI。npm 本地依赖、常用全局安装目录、`~/.opencli/node_modules` 可自动发现。找不到时，设置 `ELX_OPENCLI_PACKAGE` 为 `@jackwener/opencli` 包目录绝对路径（包含 package.json），然后重试。
- 将整个 `elx-magic-study` 文件夹交给目标 Agent，不要只复制 SKILL.md。调用本包内 scripts/library.mjs；不要误用已安装的旧版副本。

首次试用先指定一个尚无自定义图标的分类页。不要让 Agent 新建测试知识库、批量修改所有分类或覆盖你手动挑选的图标。

## 可复制流程

下面 `CLI` 表示本技能实际路径下的 `scripts/library.mjs`，`<库编号>` 和 `<分类文档ID>` 来自 status／索引。使用实际文档 ID，不用 Wiki 节点 token 代替。

```text
node CLI doctor
node CLI status --library <库编号>
node CLI icon-inspect --library <库编号> --id <分类文档ID>
```

icon-inspect 只读，打开它自己管理的浏览器页，核对 URL／标题后返回原生图标。null 表示明确观察到默认无图标；读取失败不等于 null。不会读取或导出 Cookie。

Agent 根据分类用途准备 UTF-8 JSON 文件：

```json
{
  "documentId": "实际分类文档ID",
  "icon": "🎨",
  "searchText": "调色板",
  "theme": "网页与交互设计",
  "reason": "用于网页视觉与交互设计资料"
}
```

searchText 是在飞书内置选择器中的搜索词，建议明确提供中文或当前界面可用的名称；已实测“试管”对应 🧪、“调色板”对应 🎨，之前网页试点“书”对应 📚。最终必须匹配目标 Emoji 的 aria-label，不能点击第一个搜索结果充数。

```text
node CLI icon-plan --library <库编号> --file <建议JSON文件>
```

不提供 observation 时自动通过 OpenCLI 观察；该命令只生成本地计划。结果 decision：

| action | 后续处理 |
|---|---|
| set | 展示分类、旧图标、新图标和理由，按用户明确授权执行 |
| preserve | 保留手动／未知来源图标，不继续改 |
| keep | 当前自动图标仍合适，结束 |
| pending | 报告浏览器／登录／界面或信息缺口，先修环境后重新规划 |

确认具体变更后，使用刚返回的 plan 和 digest：

```text
node CLI icon-apply --library <库编号> --id <plan> --approve <digest>
```

执行器先核对当前文档与旧图标，再用原生选择器搜索、精确选择，重新导航刷新并核对。成功时自动保存可审计的 DOM 观察证据到个人状态目录，并完成回执；不要求 Agent 自己编写 verified JSON。

返回 `ok:true` 且 data.state=verified 才能报告成功。`icon-plan` 的 ok:true 可能只是 pending／preserve，不能当成功改图标。标准 JSON 在 stdout，进程失败返回非零；harness 不要仅以进程启动或计划存在判断业务成功。

## 失败与恢复

- BROWSER_MISSING／BROWSER_CONFIG：未找到 OpenCLI SDK 或路径错误。配置依赖后重新生成计划，不改权限。
- 未登录、无编辑权限或控件不唯一：停止。不要导出凭据、绕验证码、换账号或用私有 API 兜底。
- ICON_CHANGED／ICON_DOCUMENT_CHANGED：有人修改图标、标题、正文或路径。保留修改，重新核对；不强行使用旧 digest。
- ICON_WRITE_UNCERTAIN：点击可能已产生效果（飞书“添加图标”可能先随机填一个）。**不要重跑 icon-apply**。先运行：

```text
node CLI icon-verify --library <库编号> --id <plan> --approve <digest>
```

它只重新读取和核对，不再点击。若当前图标与预期不同，保留 pending 并报告实际情况，用户明确决定如何处理后才能制定后续修正范围；不要用新计划偷偷覆盖未知结果。旧回执不能覆盖新计划。

一次只运行一个同库图标任务。适配器使用有界等待、实际可见控件坐标、输入焦点核对与精确候选，不对截图坐标做硬编码；读取 Shadow DOM 不涉及网页私有状态。成功／失败都会释放它自己创建的浏览器会话，不关闭用户已有标签页。

## 给 WorkBuddy／harness 的试用提示

> 读取这个文件夹里的 SKILL.md 和 references/terminal-icons.md。只用终端完成操作，不调用 Computer Use。先 doctor、status 和 icon-inspect，选择我指定的一篇分类页；根据用途提出一个飞书原生图标，生成 icon-plan 并给我看目标与理由。获得我的确认后只执行这一份 icon-apply，报告实际 JSON 结果与证据路径。失败时按文档停止或只读核验，不循环重试写入，不改标题正文、不改其他页。

## 验收清单

1. 没有 Computer Use 仍能完成只读检查；机器没有浏览器桥接时准确报告阻塞。
2. 已有自定义／手动图标显示 preserve，实际图标不变。
3. 一个默认图标分类经确认后变为目标图标，重新打开仍保留；标题、正文、位置不变。
4. 重复已成功的 apply 返回 alreadyApplied，不再写一次。
5. 人为关闭连接时不能返回 verified。未知写结果只运行 verify。

本机 CLI／OpenCLI 测试不等于 WorkBuddy 或每种 harness 已验证。请保留实际命令、退出码、JSON 和可查看的页面结果反馈；不要把私人文档、Cookie 或个人状态上传公开仓库。
