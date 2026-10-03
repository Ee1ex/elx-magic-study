# PROG-006 读取工具与首次定时引导

日期：2026-10-04。REQ-012 用户要求：缺工具时询问安装Agent Reach、给GitHub来源、引导平台配置及询问OpenCLI；首次使用主动询问定时整理并使用当前Agent的自动化能力。

实现：新增reading-tools.md，入口／setup／capture路由；平台配置遵循当前Agent Reach及相关参考，授权分层、只读验收、失败可保留链接。首次主动询问与定时提示不以Codex为唯一宿主。schedule-plan改为host-automation，schedule-record支持实际provider并要求verified:true，按provider＋ID去重。修复测试发现的saveLibrary缺失导入。

先新增失败用例复现heartbeat绑定；通过后发现旧保存入口缺导入并修复。完整回归59项；模拟不同宿主并不代表真实WorkBuddy自动化创建验收。

图标实验暂停，从日常入口、入库和维护路由移出；未删除实验代码、预览包或用户已设置图标。没有安装工具、改权限、注册定时任务、发布或同步本机安装。

引导演练：已有读取能力→复用；缺工具→给Agent Reach源链接并询问；拒绝→收链接／接受正文；同意→按当前上游安装并分平台验证；OpenCLI单独问；首次定时同意→确认时间时区范围再选宿主；仅手动界面→提供提示，不伪称注册；拒绝→不阻断；宿主不具备能力→手动maintenance。
