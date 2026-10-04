# 0.6.0 发布与安装记录

日期：2026-10-04（Asia/Shanghai）。用户授权打包发布并安装本机，随后测试。发布与安装已完成，真实内容测试尚未执行。

## 发布

版本源 package.json，REQ-015 新能力按 minor 从0.5.0升级0.6.0。Skill元数据和CLI help版本同步。发布提交 `ed79546379a4f295054cf0f4ea67716c4d1ecf4e`，main与v0.6.0发布时回读一致；后续只追加收尾记录，不移动Tag。

[Release](https://github.com/Ee1ex/elx-magic-study/releases/tag/v0.6.0)附 elx-magic-study-0.6.0.zip；28个完整Skill文件、安装说明及SHA256清单，不含实验适配器、个人绑定／偏好、缓存或私有资料。

ZIP SHA256：`938281ded68f514b4ae909bd1d18918048f247de47d794daf52f791d9cc0d24d`。远端附件uploaded状态、digest、大小、Release标题／正文及README逐项核验。初次正文精确比较因GitHub将LF转换为CRLF而失败；只规范换行后全文一致，未改远端正文或放宽内容比较。

GitHub插件只读核验Ee1ex/elx-magic-study仓库与写入权限；当前插件无Tag／Release上传工具，已说明并沿用项目Git/gh流程。main与Tag以atomic push发布；无强推、权限修改或历史重写。

## 本机安装

旧0.5.0的27个文件完整备份并逐文件校验；用仓库现有安装器安装0.6.0，28个文件与源码SHA256一致，help显示0.6.0及space-discover。备份准确位置保存在本机忽略目录artifacts/release-0.6.0/install.json，不删除旧安装。

升级未重置个人状态或创建空间。安装后doctor与onboarding只读运行成功：已有绑定、已介绍状态仍在；CLI 1.0.93，授权摘要needs_refresh。没有据此认定授权失效或远端读取成功，实际查询时按正常流程刷新并验收。

## 验证与待测

61项串行合成回归通过；脚本语法、Skill Creator格式、文档链接、README图片／标题／HTML结构及Git diff检查通过。包内每个文件与清单一致，安装与包均来自同一源码。

新用户OpenCLIApp完整安装／桥接、真实独立Wiki创建与恢复、首次分类入库、小红书评论及回复覆盖仍待实测。后续测试需明确资料链接和保存范围；已有绑定不为了测试而重置，也不把升级授权当作真实空间创建授权。

回退：停止相关操作，保留个人状态与新计划历史，恢复旧安装备份。尚未完成的parentStep计划只用支持版本查证恢复，不交给旧版继续执行；不删除资料或改写Tag。
