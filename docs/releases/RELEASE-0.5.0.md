# 0.5.0 发布与安装记录

日期：2026-10-04（Asia/Shanghai）。发布安装完成，回读通过。

用户要求发布并更新本机。版本源package.json，新增首次导览和本地偏好，按minor从0.4.1升级0.5.0。发布提交39cab59346f2408b9054221022cd07099140b004，main与v0.5.0核对一致；后续收尾只补记录，不移动Tag。

[公开Release](https://github.com/Ee1ex/elx-magic-study/releases/tag/v0.5.0)附elx-magic-study-0.5.0.zip，27个Skill文件、说明与清单，不含个人状态或实验适配器。SHA256：71c18d4b58bb5f07972035fb5fcd0ea5ae978df46851db69348793124ae2ccb5。远端附件digest、Release正文、README字节均已核对。

本机旧0.4.1的25个文件备份校验，新0.5.0的27个文件与源码一致，help显示新版本与onboarding入口。具体备份路径保存在本机忽略目录artifacts/release-0.5.0/install.json。升级不创建引导偏好、不改变绑定、不配置可选功能。

52项串行回归通过；Skill格式与README设计、文档链接校验通过。不同Agent的真实首次导览体验及场景提示频率仍待使用验证。GitHub插件核验身份和权限；使用现有Git/gh完成本地Git历史、Tag与附件上传，不强推或修改权限。

用户后续追加了知识库图标优化请求，将作为独立知识库操作处理，不混入本版本发布内容。回退需保留用户状态并恢复旧安装备份，不删除个人数据或改写历史。
