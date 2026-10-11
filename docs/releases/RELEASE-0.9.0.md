# 0.9.0 发布与安装记录

日期：2026-10-12。用户明确要求升级本机安装并发布GitHub，授权main、v0.9.0 Tag、正式Release和已验收ZIP/摘要附件，以及文档收尾推送。

## 版本与公开结果

发布目标为`04ce7204a75dee5713ab91841df63b049ec87844`，main和v0.9.0的首次远端回读均指向该提交。Tag为annotated，后续仅追加发布事实文档，不移动Tag或改写历史。

[正式Release](https://github.com/Ee1ex/elx-magic-study/releases/tag/v0.9.0)标题“魔法书屋 0.9.0 · 工作台、整理偏好与主题建议”，draft=false、prerelease=false，设为最新版本。

ZIP附件128270字节，SHA256：`6cc2f4d3cdfefc3b35ba42f5b478bd4b17d4f10e6ed49d1457736ee74f310a50`。GitHub附件digest与本地一致，实际下载回来的ZIP摘要亦一致；外部sha256清单一同发布。包内40个Skill文件、INSTALL.md及SHA256SUMS，构建/解包验收见[PACKAGE记录](PACKAGE-0.9.0.md)。

GitHub插件核对身份、仓库push权限并回读Tag下的Skill版本；当前插件没有原生Git传输、Tag/Release附件工具，沿用项目Git/gh流程执行fast-forward main和Tag原子推送、Release创建及下载回读。无PR、强推、公共历史重写或权限改动。

## 本机安装

旧版0.8.0的32个文件完整备份到本机Codex Skills目录之外的skill-backups位置，未删除；准确路径仅保留私人回执。项目安装器安装0.9.0后，40个文件与源码逐文件SHA256一致，实际本机CLI help返回0.9.0。

兼容个人状态目录中的131个文件前后摘要一致；没有改动绑定、偏好、缓存、快照或操作历史，也没有新增真实知识库写入、注册任务或安装其他工具。宿主Skill发现/新对话实际使用仍与磁盘安装核验区分。

## 验证边界与回退

复用最终源码45文件字节一致的临时副本85项通过、ZIP及解包入口证据；本轮没有改功能代码，不重复扩大测试。工作区EPERM根因未解决，新文章实际导入、全新空库、跨Agent/设备和浏览器视觉等未验收范围仍保留。

回退时只在用户明确授权下恢复旧Skill备份，保留个人状态与完整操作历史；不自动撤销知识库改动或删除新旧目录。附件、旧版本、备份和试点资源保持。
