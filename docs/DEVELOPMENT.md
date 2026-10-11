# 开发与兼容说明

## 名称

- 中文：魔法书屋。
- 英文：Magic Study。
- Skill 标识：`elx-magic-study`。
- 简称：`elx-ms`。简称用于交流，不是另一个独立安装的 Skill。

项目原名为 `elx-library`。更名后仍默认读取 `~/.elx-library`，保留旧用户的知识库绑定、索引与操作历史；不搬动或删除资料。环境变量优先级为：明确的 `--home`、`ELX_MAGIC_STUDY_HOME`、旧版 `ELX_LIBRARY_HOME`、默认目录。

## 运行环境

Node.js 22 或更高版本；飞书操作需要官方 lark-cli。辅助脚本没有 npm 运行依赖。Windows 已完成本地验证；其他系统尚未做完整端到端验证。

当前已发布及本机安装0.9.0，包含REQ-018／019。回归宜使用 `node --test --test-concurrency=1 tests/*.test.mjs`，分别记录合成、实际平台和环境检查，不以工作区偶尔通过关闭历史EPERM。包及发布闭环见 [PACKAGE-0.9.0](releases/PACKAGE-0.9.0.md)和[RELEASE-0.9.0](releases/RELEASE-0.9.0.md)。

工作台入口为workbench-bind/context/sync、preferences-ack、source-issue、topic-suggest；配置及恢复见Skill包references/workbench.md。脚本没有常驻后台，管理资源随当前新版命令调用同步。本机40文件与源码及ZIP核对一致；宿主在新对话发现新版仍与文件安装核验区分。

```bash
npm test
npm run demo
node scripts/install.mjs
node scripts/install.mjs --apply
```

不加 `--apply` 的安装命令只预览。安装器逐文件核对 SHA-256；遇到不同内容的已有目录会停止，不覆盖。演示只用合成资料，输出到新的 `artifacts/demo/` 子目录。

## 目录

```text
skills/elx-magic-study/  可安装的完整 Skill
scripts/                 安装与演示脚本
tests/                   行为测试
assets/readme/           README 的流程图和合成图谱示例
```

## 当前实现边界

- 本地检索是中文分词、双字组合、BM25 排序与引用邻居；Agent 负责扩词和根据正文判断。没有独立 embedding 模型。
- 图谱边来自真实链接或有依据的明确关系；距离只是排版。HTML 无外部脚本或后台网络请求。
- 定时维护依赖宿主调度能力，默认只读飞书并生成本地草稿／检查结果。保存调度方案文件不等于已经注册任务。
- 自动索引主要支持 docx。视频内容取决于字幕／转录工具；图片、表格、附件需要适用的读取方式，不能声称全覆盖。
- 写入支持创建、追加、唯一行内替换和授权范围内的子分类。写后回读，未知结果先查证，不重发。
- 单机锁不能消除飞书手动编辑或其他设备引起的竞争，不承诺跨文档原子事务。

当前源码增加verification.mjs、OpenCLI无shell入口与元数据resolve-url。只归一化表格分隔行连字符数量；缺字、数值或代码块变化继续失败。新精确替换记录核验哈希版本，旧计划保持旧哈希，不自动修改历史操作。
- vivo 原子笔记、语雀、Obsidian 尚未实现接入。

## 发布内容与隐私

仓库只包含通用源码、测试与合成示例。`.skillpick`、`artifacts`、个人状态目录和包含本机信息的设计／交付记录不纳入上传。不要提交凭据、真实飞书 token、文档正文、授权链接或个人图谱。

本地状态按用户账号与知识库隔离。更名不会重新申请权限，升级不能绕过用户对实际远端写入的授权。

## 四项优化的兼容边界

源码已加入 recordRole、计划取消／替代、scan 检查点和摘要版本字段，均为增量可选字段，保留旧资料及原始计划。升级安装副本与实际资料回填是独立操作，本轮未执行。旧远端记录角色不明时显示待分类；图谱无有效摘要时提供正文摘录。回退旧版不理解新终态和扫描字段，不应继续用旧版执行已取消计划。

2026-10-03 后续交付：0.3.0 已完成发布与本机安装，原 0.2.0 完整备份；未迁移个人资料。详细证据见 [Release Record](releases/RELEASE-0.3.0.md)。
