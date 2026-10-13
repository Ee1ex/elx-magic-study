"""Prepare a local source bundle. No Feishu writes, downloads, OCR or transcription."""
import argparse
import hashlib
import importlib.metadata
import json
import shutil
import sys
import zipfile
from pathlib import Path

DOCUMENTS = {'.pdf', '.docx', '.pptx', '.xlsx', '.xls', '.html', '.htm', '.csv', '.json', '.xml', '.epub'}
IMAGES = {'.png', '.jpg', '.jpeg', '.webp', '.gif'}
TEXT = {'.md', '.txt'}
MAX_BYTES = 100 * 1024 * 1024


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def prepare(source, output, source_url=None):
    source, output = Path(source).resolve(), Path(output).resolve()
    if not source.is_file() or source.stat().st_size > MAX_BYTES:
        raise ValueError('需要不超过100MiB的本地文件；远程链接先按平台流程下载')
    suffix = source.suffix.lower()
    if suffix not in DOCUMENTS | IMAGES | TEXT:
        raise ValueError('此入口不处理该格式；音视频需另选已授权转写路径，不自动发送云端')
    if source_url:
        from urllib.parse import urlsplit
        u = urlsplit(source_url)
        if u.scheme not in {'http', 'https'} or not u.hostname or u.username or u.password:
            raise ValueError('来源链接必须是无账号密码的HTTP(S)地址')
    # Fail before writing a bundle when the required parser is missing.
    converter, version = None, None
    if suffix in DOCUMENTS:
        from markitdown import MarkItDown
        converter = MarkItDown(enable_plugins=False)
        version = importlib.metadata.version('markitdown')
    output.mkdir(parents=True, exist_ok=False)
    original = output / ('original' + suffix)
    shutil.copyfile(source, original)
    warnings = ['转换成功不代表内容完整；检查原文件中的表格、图片、阅读顺序和缺页。']
    assets = []
    if suffix in IMAGES:
        markdown = ''
        warnings.append('原图已保留，尚未提取文字；由当前宿主视觉能力或另行授权OCR读取。')
    elif suffix in TEXT:
        markdown = original.read_text(encoding='utf-8-sig')
    else:
        result = converter.convert_local(str(original))
        markdown = result.markdown
        if suffix == '.pdf':
            warnings.append('PDF原件待上传；文字提取不证明扫描页和关键图表已读，按需逐页渲染核对。')
    if not markdown.strip():
        warnings.append('未取得有效正文，不能标记full_text或据此生成完整总结。')
    if suffix in {'.docx', '.pptx', '.xlsx'}:
        prefix = {'.docx': 'word/media/', '.pptx': 'ppt/media/', '.xlsx': 'xl/media/'}[suffix]
        with zipfile.ZipFile(original) as archive:
            members = [m for m in archive.infolist() if m.filename.startswith(prefix) and not m.is_dir()]
            if len(members) > 200 or sum(m.file_size for m in members) > MAX_BYTES:
                raise ValueError('内嵌资源超过200项或100MiB，保留原件，改用有界人工检查')
            for index, member in enumerate(members, 1):
                ext = Path(member.filename).suffix.lower()
                if ext not in IMAGES:
                    warnings.append('未提取非普通图片资源：' + member.filename)
                    continue
                name = f'asset-{index:03d}{ext}'
                target = output / name
                # Generated names; never extract an archive member to its own path.
                with archive.open(member) as stream, target.open('xb') as dest:
                    remaining = MAX_BYTES
                    while chunk := stream.read(min(1024 * 1024, remaining + 1)):
                        remaining -= len(chunk)
                        if remaining < 0:
                            raise ValueError('解压资源超过上限')
                        dest.write(chunk)
                assets.append({'file': name, 'sha256': digest(target), 'origin': member.filename,
                               'review': 'pending', 'selected': False})
        warnings.append('资源顺序不等于原文位置；按原文关系选择关键图，图表对象可能需要渲染。')
    (output / 'content.md').write_text(markdown, encoding='utf-8')
    manifest = {'schemaVersion': 1, 'sourceName': source.name, 'sourceURL': source_url,
                'original': {'file': original.name, 'sha256': digest(original), 'bytes': original.stat().st_size},
                'converter': {'name': 'markitdown' if converter else 'local-file', 'version': version,
                              'plugins': False, 'cloudOCR': False},
                'markdown': {'file': 'content.md', 'sha256': digest(output / 'content.md')},
                'coverage': 'unreviewed' if markdown.strip() else 'needs-reading',
                'assets': assets, 'warnings': warnings, 'remoteSaved': False}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', help='已取得的本地文件；不接受URL')
    parser.add_argument('--output', required=True, help='新的私人工作目录，不覆盖旧输出')
    parser.add_argument('--source-url', help='仅记录来源，不请求此地址')
    args = parser.parse_args()
    try:
        result = prepare(args.source, args.output, args.source_url)
        print(json.dumps({'ok': True, 'output': str(Path(args.output).resolve()), **result}, ensure_ascii=False))
    except Exception as error:
        # A failed conversion may leave a source snapshot; keep it for diagnosis.
        print(json.dumps({'ok': False, 'code': type(error).__name__,
                          'message': str(error), 'remoteSaved': False}, ensure_ascii=False), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
