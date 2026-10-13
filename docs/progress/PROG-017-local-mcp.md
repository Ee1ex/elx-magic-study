# PROG-017 本地 MCP 实施与验收

日期：2026-10-14。需求：[REQ-022](../requirements/REQ-022-local-mcp.md)。基线 `f7f02b6`；接手时工作区干净，正式版本 0.10.0，MarkItDown 文件读取集成未发布。

本地实现提交 `0cff712`。远端 main 仍为 `cf1164c`，发布清单见[PACKAGE-1.0.0](../releases/PACKAGE-1.0.0.md)。

## 当前实现

- `mcp/` 独立包锁定官方 SDK v2、Zod；`server.mjs` 只负责 stdio 注册，`runner.mjs` 异步启动受控 worker；worker 固定映射到同一 `library.mjs`。原 CLI 只增加结构化 plan 和随机候选数组的可选入参，旧命令参数不变。
- 13个结构化工具覆盖诊断、状态、文档/条目检索、正文/表格、偏好、同步、预览、操作、执行与恢复。最多两步计划仅允许新分类加子文档；其他复杂能力继续由 Skill/CLI 编排。
- `approve.mjs` 是非 MCP 的交互式人工批准入口；计划、摘要、账号和写入根绑定，一次性凭据在执行前消费。未知结果只查原 operation，不自动重试。
- `build.mjs` 生成独立目录，包含固定 MCP 依赖和同版 Skill；旧 Skill-only 路径保留。文件转换仍通过可选 MarkItDown 运行时，不作为 MCP 依赖。

## 证据与限制

- 修改前 `node --test --test-concurrency=1 tests/*.test.mjs`：107项中106通过，1项旧工作台用例在 Windows `library.json` 原子 rename 遇 EPERM；本轮未修改 `store.mjs`，不宣称环境根因已修复。
- `cd mcp; npm test`：5项通过，覆盖官方客户端握手、工具发现、合成状态/检索、非法参数、未批准写入拒绝、固定动作映射、合格池、慢请求并行、摘要/账号/根、完成计划重放拒绝及两步计划的核验后续行边界。
- 同字节源码的系统临时目录完整旧 CLI 回归107/107通过。工作区修改前107项中106通过、1项EPERM；首次复制到仓库内更深路径时也出现EPERM，不把其退出码0当测试成功。
- Skill Creator格式验证通过；Node语法与`git diff --check`通过。SDK 2.3.1、Zod 4.1.12 锁定；`npm ci --ignore-scripts`后审计为0项已知漏洞。
- 本地1.0.0构建与摘要见[PACKAGE-1.0.0](../releases/PACKAGE-1.0.0.md)：Skill ZIP 47文件、MCP ZIP 2500文件，解包后逐文件 SHA256 一致；解包的 MCP server 同样通过5项合成协议测试。
- 未执行真实飞书文档/表格写入、图片/PDF上传、Codex 全局 MCP 配置、其他客户端/系统验收。计划的“实际客户端授权执行”仍待用户提供具体测试目标并确认。
- 1.0.0 GitHub main/Tag/Release 和本机全局安装待展示包、摘要和远端目标后再次确认；本文件不构成发布回执。
