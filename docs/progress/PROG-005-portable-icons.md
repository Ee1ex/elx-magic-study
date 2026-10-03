# PROG-005 终端图标适配与试用交付

日期：2026-10-04。关联REQ-011，基线cfaba81。用户希望使用没有Computer Use的WorkBuddy和harness试用。

## 实现

独立项目模块icon-browser.mjs发现已安装OpenCLI，使用公开Page SDK。实际DOM已定位h1.page-block-content、custom-icon、添加入口，以及em-emoji-picker的Shadow DOM搜索框和aria-label候选。读取不运行私有接口、不提取Cookie；写入使用SDK原生输入。

新增icon-inspect／icon-apply／icon-verify，增强icon-plan无观察时的自动观察及降级。未知写结果只读恢复，已有手动图标保护，旧digest／目标变化被阻断。脚本自动生成DOM观察证据，目标Agent无需自己伪造verified回执。

## 真实过程与边界

1. OpenCLI doctor、只读观察通过。普通CSS／数字ref无法可靠访问Shadow DOM，改用公开SDK；没有修改全局工具。
2. 只读调试期间曾用Codex浏览器观察面板作辅助诊断；最终运行适配器的读写及核对路径不调用Codex工具。
3. 实践经验初次完整命令未完成目标选择，保留unknown及临时随机图标；只读核对后通过终端SDK有界修正为试管图标，再icon-verify确认。没有直接重跑未知apply。
4. 网页与交互设计初次尝试也未确认完成；后续观察出现选择后立即刷新读回旧值的问题。加入保存稳定和刷新多次一致检查，有界修正为调色板，icon-verify通过。
5. 修正后的AI工具与效率从默认图标出发，icon-plan → icon-apply一次完成机器人图标设置、刷新DOM证据保存和官方CLI身份／路径／标题／正文核对，返回verified。

三个试点分类的最终图标分别为试管、调色板、机器人；标题正文保持。真实回执和显示截图在本机忽略目录artifacts/portable-icons-20261004，不进入公开仓库。

## 自动检查与交付

先补3项终端失败用例，确认原实现强制要求observation；实现后补Shadow DOM布局行为用例。完整58项测试通过；包含缺浏览器、确认摘要、人工改动阻断、未知结果不可重发、只读恢复及幂等。

交付完整Skill预览包及references/terminal-icons.md；用户可复制其中提示交给WorkBuddy/harness。没有宣称这些Agent本体已经验收，也没有发布或升级全局安装。仅本机终端路线通过，其他系统／连接方式仍待验证。

交付校验：Skill格式、11个脚本语法、文档链接、README图片与结构检查通过。预览包位于本机忽略目录artifacts/portable-icons-20261004，27个Skill文件与源码SHA256逐项一致，ZIP解压完整性通过；包内入口icon-inspect已真实读取机器人图标。正式安装副本和GitHub保持不变。
