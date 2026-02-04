import os
import uuid
import shutil
from pathlib import Path
from typing import Optional


def sanitize_filename(filename: str) -> str:
    """清理文件名，移除非法字符"""
    # 移除或替换非法字符
    invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
    for char in invalid_chars:
        filename = filename.replace(char, '_')
    return filename.strip()


def get_file_extension(filepath: str) -> str:
    """获取文件扩展名（小写）"""
    return Path(filepath).suffix.lower()


def get_file_size(filepath: str) -> int:
    """获取文件大小（字节）"""
    return Path(filepath).stat().st_size


def format_file_size(size: int) -> str:
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.2f} {unit}"
        size /= 1024
    return f"{size:.2f} TB"


def create_temp_dir(prefix: str = "video_insight_") -> Path:
    """创建临时目录"""
    temp_dir = Path("/tmp") / f"{prefix}{uuid.uuid4().hex[:8]}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    return temp_dir


def cleanup_temp_dir(temp_dir: Path) -> None:
    """清理临时目录"""
    if temp_dir and temp_dir.exists():
        shutil.rmtree(temp_dir)


def ensure_dir_exists(path: str) -> Path:
    """确保目录存在"""
    dir_path = Path(path)
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def generate_output_filename(title: str, extension: str = ".md") -> str:
    """生成输出文件名"""
    # 清理标题
    safe_title = sanitize_filename(title)
    # 添加 UUID 确保唯一性
    unique_id = uuid.uuid4().hex[:8]
    return f"{safe_title}_{unique_id}{extension}"


def get_video_duration_ffprobe(video_path: str) -> Optional[float]:
    """使用 ffprobe 获取视频时长"""
    try:
        import subprocess
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path,
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            return float(result.stdout.strip())
    except Exception:
        pass
    return None


def extract_audio_ffmpeg(video_path: str, output_path: str) -> bool:
    """使用 ffmpeg 提取音频"""
    try:
        import subprocess
        subprocess.run(
            [
                "ffmpeg",
                "-i", video_path,
                "-vn",  # 不处理视频
                "-acodec", "pcm_s16le",  # PCM 16位
                "-ar", "16000",  # 16kHz 采样率
                "-ac", "1",  # 单声道
                "-y",  # 覆盖输出
                output_path,
            ],
            capture_output=True,
            check=True,
        )
        return True
    except Exception as e:
        print(f"Failed to extract audio: {e}")
        return False


def get_video_info_ffprobe(video_path: str) -> dict:
    """使用 ffprobe 获取视频详细信息"""
    try:
        import subprocess
        import json

        result = subprocess.run(
            [
                "ffprobe",
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                video_path,
            ],
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            data = json.loads(result.stdout)
            info = {
                "duration": 0.0,
                "width": 0,
                "height": 0,
                "codec": None,
                "size": 0,
            }

            if "format" in data:
                info["size"] = int(data["format"].get("size", 0))
                duration = data["format"].get("duration")
                if duration:
                    info["duration"] = float(duration)

            for stream in data.get("streams", []):
                if stream.get("codec_type") == "video":
                    info["width"] = stream.get("width", 0)
                    info["height"] = stream.get("height", 0)
                    info["codec"] = stream.get("codec_name")

            return info
    except Exception as e:
        print(f"Failed to get video info: {e}")

    return {"duration": 0.0, "width": 0, "height": 0, "codec": None, "size": 0}
