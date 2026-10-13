# PROG-016 文件与关键资源集成

2026-10-14，对应[REQ-021](../requirements/REQ-021-files-and-assets.md)。

## 实现

- 新增`file_import.py`，使用MarkItDown 0.1.8的本地转换接口，插件关闭；保留原件、UTF-8 Markdown、SHA256和覆盖待审核状态。图片只保留原件，不谎报OCR。
- DOCX/PPTX/XLSX媒体以生成文件名提取为候选，不使用ZIP内部路径写磁盘；资源数量和字节预算明确，未支持媒体提示遗漏。
- Skill入口、来源整理、读取工具及个人记录均路由到`files-and-assets.md`。文档明确关键图嵌入／PDF附件、一次预览、官方XML、独立日志、原件摘要绑定、未知结果查证、正文与资源分开核验。
- 采用宿主Agent和已有官方飞书CLI编排上传，没有给核心plan/apply增加未经验证的富文本动作。

## 验证与边界

- 隔离环境实际安装MarkItDown 0.1.8及pdf/docx/pptx/xlsx/xls依赖；本地工具不启用云OCR／转写。
- `tests/test_file_import.py`的7项检查全部通过：合成PDF文字与空页、Word与路径隔离、PowerPoint、Excel、HTML、CSV、Markdown、图片及错误边界。源文件均字节保留。测试未删除临时产物。
- 未上传本轮图片／PDF到真实飞书，未回填既有文档。原生资源显示、下载一致性和真实复杂文档语义质量保留待验证；不以本地转换通过代替平台成功。
- 上游K-Dense链接现为面向0.1.8的指引，本机原独立MarkItDown Skill为0.1.6指引；本轮只更新魔法书屋自己的集成，不覆盖独立Skill。

本机私有安装与测试回执放忽略目录；版本标签保持0.10.0，未创建新Tag／Release。

## 本机收尾

旧Skill完整备份到发现目录外；更新6项，最终46文件逐项SHA256与源码一致。独立持久转换环境已安装，安装副本实际HTML转换通过，安装前后152个个人状态文件摘要不变。Skill格式校验通过，现有Node回归106/107通过，1项旧OPT-03用例遇原子rename EPERM；未修改核心存储或据此声称环境问题解决。未进行真实飞书写入。
