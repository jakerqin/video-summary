import os
import subprocess
import asyncio
from pathlib import Path
from typing import Optional, Callable
from faster_whisper import WhisperModel
from utils.logger import setup_logger
from core.config_manager import config_manager

logger = setup_logger()


class WhisperService:
    """Whisper 语音识别服务"""

    def __init__(self):
        self._model: Optional[WhisperModel] = None
        self._model_size = "base"
        self._temp_dir = Path("/tmp/video_insight_audio")
        self._temp_dir.mkdir(parents=True, exist_ok=True)

    def load_model(self, model_size: Optional[str] = None) -> None:
        """加载 Whisper 模型"""
        if model_size:
            self._model_size = model_size

        config = config_manager.get()
        model_size = config.whisper.model_size if not model_size else model_size

        logger.info(f"Loading Whisper model: {model_size}")

        # 模型缓存目录
        cache_dir = Path.home() / ".cache" / "whisper"
        cache_dir.mkdir(parents=True, exist_ok=True)

        self._model = WhisperModel(
            model_size,
            device="cpu",  # Mac 使用 CPU
            compute_type="int8",  # int8 减少内存占用
            cache_dir=str(cache_dir),
        )

        logger.info("Whisper model loaded successfully")

    def is_model_loaded(self) -> bool:
        """检查模型是否已加载"""
        return self._model is not None

    def transcribe(
        self,
        audio_path: str,
        language: str = "zh",
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> str:
        """转录音频为文本

        Args:
            audio_path: 音频文件路径
            language: 语言（默认中文）
            progress_callback: 进度回调函数

        Returns:
            转录的文本
        """
        if not self._model:
            self.load_model()

        logger.info(f"Transcribing audio: {audio_path}")

        # 转录参数
        segments, info = self._model.transcribe(
            audio_path,
            language=language,
            beam_size=5,
            no_speech_threshold=0.6,
            log_progress=True,
        )

        # 回调进度
        if progress_callback:
            progress_callback(10, "开始识别...")

        # 收集所有文本
        texts = []
        total_duration = info.duration if info.duration > 0 else 0
        processed_duration = 0

        for segment in segments:
            texts.append(segment.text)

            # 更新进度
            if progress_callback and total_duration > 0:
                segment_end = segment.end if hasattr(segment, 'end') else 0
                if segment_end > processed_duration:
                    processed_duration = segment_end
                    progress = int((processed_duration / total_duration) * 90) + 10
                    progress = min(progress, 99)
                    progress_callback(progress, f"正在识别: {segment.text[:20]}...")

        full_text = " ".join(texts).strip()

        if progress_callback:
            progress_callback(100, "识别完成")

        logger.info(f"Transcription complete: {len(full_text)} characters")
        return full_text

    def transcribe_video(
        self,
        video_path: str,
        language: str = "zh",
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> str:
        """转录视频（自动提取音频）

        Args:
            video_path: 视频文件路径
            language: 语言
            progress_callback: 进度回调

        Returns:
            转录的文本
        """
        if progress_callback:
            progress_callback(5, "提取音频中...")

        # 提取音频
        audio_path = self._extract_audio(video_path)

        if not audio_path:
            raise Exception("Failed to extract audio from video")

        try:
            # 转录音频
            text = self.transcribe(audio_path, language, progress_callback)
            return text
        finally:
            # 清理临时音频文件
            self._cleanup_audio(audio_path)

    def _extract_audio(self, video_path: str) -> Optional[str]:
        """提取音频"""
        try:
            output_path = self._temp_dir / f"{Path(video_path).stem}.wav"

            result = subprocess.run(
                [
                    "ffmpeg",
                    "-i", video_path,
                    "-vn",  # 不处理视频
                    "-acodec", "pcm_s16le",
                    "-ar", "16000",
                    "-ac", "1",
                    "-y",
                    str(output_path),
                ],
                capture_output=True,
                text=True,
            )

            if result.returncode == 0 and output_path.exists():
                return str(output_path)

            logger.error(f"Failed to extract audio: {result.stderr}")
            return None

        except Exception as e:
            logger.error(f"Audio extraction failed: {e}")
            return None

    def _cleanup_audio(self, audio_path: str) -> None:
        """清理临时音频文件"""
        try:
            audio_file = Path(audio_path)
            if audio_file.exists():
                audio_file.unlink()
        except Exception as e:
            logger.warning(f"Failed to cleanup audio file: {e}")

    def get_supported_languages(self) -> list[str]:
        """获取支持的语言列表"""
        return [
            "zh", "en", "ja", "ko", "fr", "de", "es", "ru", "pt", "ar",
        ]

    def unload_model(self) -> None:
        """卸载模型，释放内存"""
        if self._model:
            del self._model
            self._model = None
            logger.info("Whisper model unloaded")


# 全局服务实例
whisper_service = WhisperService()


# 便捷函数
def transcribe_video(
    video_path: str,
    language: str = "zh",
    progress_callback: Optional[Callable[[int, str], None]] = None
) -> str:
    """转录视频"""
    return whisper_service.transcribe_video(
        video_path,
        language,
        progress_callback,
    )


def load_whisper_model(model_size: Optional[str] = None) -> None:
    """加载 Whisper 模型"""
    whisper_service.load_model(model_size)


def is_whisper_ready() -> bool:
    """检查 Whisper 是否就绪"""
    return whisper_service.is_model_loaded()
