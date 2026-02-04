from pathlib import Path
from datetime import datetime
from typing import Optional
from models.task import VideoInfo
from core.config_manager import config_manager
from utils.logger import setup_logger
from utils.file_utils import generate_output_filename, ensure_dir_exists

logger = setup_logger()


class MarkdownGenerator:
    """Markdown 文件生成器"""

    def generate(
        self,
        summary: str,
        metadata: dict,
        output_path: Optional[str] = None,
        custom_filename: Optional[str] = None
    ) -> str:
        """生成 Markdown 文件

        Args:
            summary: 摘要内容
            metadata: 元数据（标题、来源、作者等）
            output_path: 输出目录（可选）
            custom_filename: 自定义文件名（不含扩展名）

        Returns:
            生成的文件路径
        """
        # 获取输出目录
        if not output_path:
            output_dir = config_manager.get_output_dir()
        else:
            output_dir = Path(output_path)
            ensure_dir_exists(str(output_dir))

        # 生成文件名
        title = metadata.get("title", "视频摘要")
        if custom_filename:
            filename = f"{custom_filename}.md"
        else:
            filename = generate_output_filename(title, ".md")

        output_file = output_dir / filename

        # 构建 Markdown 内容
        content = self._build_content(summary, metadata)

        # 写入文件
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(content)

        logger.info(f"Generated markdown file: {output_file}")
        return str(output_file)

    def _build_content(self, summary: str, metadata: dict) -> str:
        """构建 Markdown 内容"""
        # 元数据
        lines = [
            "---",
            f'title: "{metadata.get("title", "视频摘要")}"',
            f'source: "{metadata.get("source", "")}"',
            f'author: "{metadata.get("author", "未知")}"',
            f'platform: "{metadata.get("platform", "")}"',
            f'processed_at: "{datetime.now().isoformat()}"',
            "---",
            "",
            f"# {metadata.get("title", "视频摘要")}",
            "",
            "## 📊 信息概览",
            "",
            f"- **来源平台**: {metadata.get('platform', '未知')}",
            f"- **作者**: {metadata.get('author', '未知')}",
            f"- **处理时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"- **原文链接**: {metadata.get('source', '')}",
            "",
            "---",
            "",
            "## 📝 内容摘要",
            "",
            summary,
            "",
            "---",
            "",
            "*本摘要由 Video Insight 自动生成*",
        ]

        return "\n".join(lines)

    def generate_with_toc(
        self,
        summary: str,
        metadata: dict,
        output_path: Optional[str] = None
    ) -> str:
        """生成带目录的 Markdown 文件"""
        # 构建带目录的内容
        toc = self._generate_toc(summary)

        # 添加目录
        content = self._build_content(summary, metadata)
        content = f"{toc}\n\n{content}"

        # 保存文件
        return self.generate(content, metadata, output_path)

    def _generate_toc(self, content: str) -> str:
        """从内容生成目录"""
        import re

        # 提取标题
        headings = re.findall(r"^(#{1,6})\s+(.+)$", content, re.MULTILINE)

        if not headings:
            return ""

        toc_lines = ["## 目录", ""]
        current_level = 0

        for level, title in headings:
            level = len(level)
            indent = "  " * (level - 1)
            # 生成锚点
            anchor = title.lower().replace(" ", "-").replace(".", "")
            toc_lines.append(f"{indent}- [{title}](#{anchor})")

        return "\n".join(toc_lines)


# 全局服务实例
markdown_generator = MarkdownGenerator()


# 便捷函数
def generate_markdown(
    summary: str,
    metadata: dict,
    output_path: Optional[str] = None
) -> str:
    """生成 Markdown 文件"""
    return markdown_generator.generate(summary, metadata, output_path)
