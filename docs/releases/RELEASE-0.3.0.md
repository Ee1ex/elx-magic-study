# Magic Study 0.3.0 发布与安装记录

日期：2026-10-03（Asia/Shanghai）。状态：已完成并回读，本记录锁定。

## 授权与版本

用户当次明确要求“发布并更新然后完成收尾工作”。范围是 GitHub main、版本 Tag／Release 与 Codex 本机安装升级，不含个人知识库迁移、飞书写入、删除、权限调整或其他功能。

版本来源 package.json，ELX version-bump 根据 v0.2.0 后新增分类功能按 minor 从 0.2.0 演进至 0.3.0。包、SKILL 元信息、CLI help 一致。

## 交付对象

- 仓库：Ee1ex/elx-magic-study，main。
- 发布提交：fdcf7086c171c0b17fc857f226a146cca6b1417e。
- Tag：v0.3.0；注解对象 022ea08d8cf88eafef49c1e24251b45c638b67e3；解引用为上述提交。
- [公开 Release](https://github.com/Ee1ex/elx-magic-study/releases/tag/v0.3.0)，非草稿、非预发布。
- 后续收尾提交只更新项目记录，不移动 Tag，不更改已安装的 Skill 内容。

## 验证

- 50 项合成测试通过，其中分类新增 12 项。
- Skill 格式、9 个脚本语法、README 设计保留检查通过；文档链接校验完成。
- README 图片与引用、标题／HTML 结构、代码围栏保持；只更新文字。
- main 与 Tag 原子推送成功；Tag 目标一致，远端 README 逐字节一致，Release 正文一致，远端完整树无私人状态与忽略产物。
- Codex 本机旧版 0.2.0 移至 Skills 目录之外的备份目录，21 个旧文件哈希校验一致；无文件删除。新版 23 个文件与源码 SHA256 全部一致；CLI 0.3.0 与 classification-context 命令有效，安装副本格式检查通过。
- 具体备份位置与安装回执保存在本机忽略目录 artifacts/release-0.3.0/install-receipt.json，不将个人路径上传。

GitHub 插件仍为无此仓库写权限的其他账号；已告知用户并核验 gh 为仓库所有者 Ee1ex，沿用已有连接发布。未修改权限或重新授权应用。

## 变化与限制

新资料的主位置、标签、主题依据进入统一可修改预览；脚本核对范围、版本与引用。见 [CHANGELOG](../../CHANGELOG.md)、[SPEC](../SPEC.md)、[PROG-003](../progress/PROG-003-classification.md)。

语义分类准确率、真实飞书 Markdown 显示／回读、大目录与长正文仍待试用；图谱新版交互原有未验项继续保留，见 [待验证](../pending-verification.md)。测试和安装不代表真实知识库已执行分类。

## 恢复

保留旧安装备份与现有个人状态；需回退时先停止写操作并制定独立恢复范围，不删除用户资料、不强推历史。旧版不理解新分类元数据，不继续执行含新字段或已取消的计划。此次仅 GitHub 发布与本机安装，无 npm、网站、飞书文档发布和定时任务注册。
