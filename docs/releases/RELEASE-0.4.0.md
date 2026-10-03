# 0.4.0 发布与本机安装记录

日期：2026-10-04（Asia/Shanghai）。状态：已发布并安装，已回读。

用户当次明确要求安装到本地Codex并发布GitHub。main与v0.4.0目标为58b0ac6880b98ff66417f336cf90f385f6ad465e；后续仅补收尾记录，不移动Tag。

[公开Release](https://github.com/Ee1ex/elx-magic-study/releases/tag/v0.4.0)非草稿、非预发布。附件elx-magic-study-0.4.0.zip为24个Skill文件、使用说明和哈希清单，不包含图标实验、用户配置或正文。

附件SHA256：73be4080d77b5dc0cd2ce8b0b8b70782fd39ff38ac6e0d807453fccdb07c87df；GitHub服务端附件digest与本地一致。Release正文及远端README逐字节核对一致；远端树无私人产物。实验保留在仓库experiments，不随Skill ZIP安装。

本机Codex原0.3.0共23个文件完整备份至Skills目录之外；0.4.0共24个文件与源码SHA256一致，CLI版本正确且不含图标命令，Skill格式检查通过。备份路径回执保存在本机忽略目录artifacts/release-0.4.0/install.json。个人知识库状态、图标和飞书正文未修改。

本轮串行完整测试51项通过。并行完整重跑两次分别出现Windows EPERM原子替换错误，单项及串行回归通过；该环境问题记录保留，没有借发布扩大存储逻辑修改。不同宿主真实注册／唤醒、新用户平台配置及既有图谱交互未验证项继续保留。

GitHub插件只读核验账号Ee1ex及仓库管理权限成功；现有插件无完整本地Git提交与附件上传入口，已向用户说明，采用已有Git／gh连接上传并回读。未强推、改权限或创建额外服务。

恢复时先停止相关任务，保留个人状态和操作历史，再恢复旧安装备份；不要删除用户资料或使用旧版继续执行未知写入。详细变化见CHANGELOG、SPEC和PACKAGE-0.4.0历史打包记录。
