import subprocess
import json
import os
from pathlib import Path
from typing import Optional, List, Dict
from utils.logger import setup_logger

logger = setup_logger()


class SubtitleExtractor:
    """字幕提取器"""

    def __init__(self):
        self.temp_dir = Path("/tmp/video_insight_subtitles")
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def extract(
        self,
        video_path: str,
        progress_callback=None
    ) -> Optional[str]:
        """提取视频内嵌字幕

        Args:
            video_path: 视频文件路径
            progress_callback: 进度回调

        Returns:
            提取的文本内容，如果没有字幕则返回 None
        """
        logger.info(f"Extracting subtitles from: {video_path}")

        try:
            # 1. 检测字幕流
            subtitle_streams = self._get_subtitle_streams(video_path)

            if not subtitle_streams:
                logger.info("No subtitle streams found")
                return None

            logger.info(f"Found {len(subtitle_streams)} subtitle streams")

            # 2. 提取第一个字幕流
            subtitle_path = self._extract_subtitle(video_path, subtitle_streams[0])

            if not subtitle_path:
                return None

            # 3. 解析字幕文件
            text = self._parse_subtitle(subtitle_path)

            # 4. 清理临时文件
            self._cleanup_temp_files(video_path)

            logger.info(f"Extracted {len(text)} characters from subtitles")
            return text

        except Exception as e:
            logger.error(f"Failed to extract subtitles: {e}")
            return None

    def _get_subtitle_streams(self, video_path: str) -> List[Dict]:
        """使用 ffprobe 检测字幕流"""
        try:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v", "error",
                    "-select_streams", "s",
                    "-show_entries", "stream=codec_name,index,title,language",
                    "-of", "json",
                    video_path,
                ],
                capture_output=True,
                text=True,
            )

            if result.returncode == 0:
                data = json.loads(result.stdout)
                streams = data.get("streams", [])
                # 优先选择中文字幕
                for stream in streams:
                    lang = stream.get("language", "")
                    if lang in ["zh", "chi"]:
                        return [stream]
                return streams

        except Exception as e:
            logger.error(f"Failed to probe subtitle streams: {e}")

        return []

    def _extract_subtitle(self, video_path: str, subtitle_stream: Dict) -> Optional[str]:
        """提取字幕流到文件"""
        try:
            output_path = self.temp_dir / f"{Path(video_path).stem}_sub.srt"

            stream_index = subtitle_stream.get("index", 0)

            result = subprocess.run(
                [
                    "ffmpeg",
                    "-i", video_path,
                    "-map", f"0:{stream_index}",
                    "-y",
                    str(output_path),
                ],
                capture_output=True,
                text=True,
            )

            if result.returncode == 0 and output_path.exists():
                return str(output_path)

        except Exception as e:
            logger.error(f"Failed to extract subtitle: {e}")

        return None

    def _parse_subtitle(self, subtitle_path: str) -> str:
        """解析字幕文件，返回纯文本"""
        try:
            with open(subtitle_path, "r", encoding="utf-8") as f:
                content = f.read()

            # 解析 SRT 格式
            lines = content.split("\n")
            text_lines = []

            for line in lines:
                line = line.strip()
                # 跳过序号和时间戳
                if not line or "-->" in line or line.isdigit():
                    continue
                # 只保留文字内容
                if line:
                    text_lines.append(line)

            return " ".join(text_lines)

        except Exception as e:
            logger.error(f"Failed to parse subtitle: {e}")
            return ""

    def _cleanup_temp_files(self, video_path: str) -> None:
        """清理临时文件"""
        try:
            pattern = self.temp_dir / f"{Path(video_path).stem}*"
            for f in self.temp_dir.glob(pattern.name):
                if f.is_file():
                    f.unlink()
        except Exception as e:
            logger.warning(f"Failed to cleanup temp files: {e}")

    def extract_all_subtitles(
        self,
        video_path: str
    ) -> List[Dict[str, str]]:
        """提取所有字幕轨道

        Returns:
            字幕列表，每个包含语言和文本
        """
        subtitles = []

        try:
            subtitle_streams = self._get_subtitle_streams(video_path)

            for stream in subtitle_streams:
                lang = stream.get("language", "unknown")
                subtitle_path = self._extract_subtitle(video_path, stream)

                if subtitle_path:
                    text = self._parse_subtitle(subtitle_path)
                    subtitles.append({
                        "language": lang,
                        "text": text,
                    })

                    self._cleanup_temp_files(video_path)

        except Exception as e:
            logger.error(f"Failed to extract all subtitles: {e}")

        return subtitles


# 便捷函数
def extract_subtitles(
    video_path: str,
    progress_callback=None
) -> Optional[str]:
    """提取视频字幕"""
    extractor = SubtitleExtractor()
    return extractor.extract(video_path, progress_callback)
