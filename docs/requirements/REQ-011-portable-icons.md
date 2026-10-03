# REQ-011 终端原生图标适配

日期：2026-10-04。用户准备在 WorkBuddy 和其他 harness 试用，目标是仅需 Node/终端，不需 Codex Computer Use。

## Strategy note

Strategy: UI_SELECTOR。Contract: visible-ui。依赖已安装 OpenCLI 与浏览器桥接，复用浏览器内合法登录，不读取／导出 Cookie，不调用私有接口。

已观察 h1.page-block-content 内原生 custom-icon 和添加图标入口；选择器 em-emoji-picker 的 open Shadow DOM 中有 input[type=search]、带 aria-label 的表情按钮。OpenCLI 1.8.6 普通 target resolver 只查询 document，不能可靠跨 Shadow DOM；本项目使用公开导出的 Page SDK，read-only evaluate 读取可见控件及几何，nativeClick/nativeType 操作。坐标每次从当前 DOM 计算，不硬编码屏幕位置。

不是向全局 clis 注册新适配器，而是在 Skill 包内提供独立适配模块和命令；不修改 OpenCLI、扩展或外部 Agent 配置。

## 命令与边界

- icon-inspect：只读打开并核对指定分类页，返回当前原生图标。
- icon-plan：无 observation 时尝试适配器只读观察；缺包／桥接／登录时保存待设置，不把未知图标当默认空图标。
- icon-apply：明确 digest 后才设置，执行前核对分类身份、正文、路径和原图标；写前落 sending，写后重新导航刷新核对，自动保存 DOM 证据与回执。
- icon-verify：未知写结果只读核对，不重发点击。命令超时、UI变化或人工改图标停止，不能靠重试覆盖用户选择。
- 输出 JSON，与 Agent 品牌无关；浏览器/官方CLI仍是外部前置条件。WorkBuddy 自身行为由用户试用，不把本机终端验证称作 WorkBuddy 验收。

## 验收

缺浏览器、错误目标、旧 digest、手动图标变化、主题保持、Shadow DOM候选缺失／重复、刷新不一致、未知结果恢复都需有可检查结果。一次真实终端写入并刷新验证，只影响已选分类图标，不改标题正文。交付完整Skill试用包与可复制命令，不公开用户资料。
