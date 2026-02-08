import os
import subprocess
import asyncio
import time
from pathlib import Path
from typing import Optional, Callable
from utils.logger import setup_logger
from core.config_manager import config_manager

logger = setup_logger()


class WhisperService:
    """Whisper 语音识别服务（支持 CPU 和 Metal GPU 加速）"""

    def __init__(self):
        self._model = None
        self._model_size = "base"
        self._device = None
        self._backend = None  # 'faster-whisper' 或 'openai-whisper'
        self._project_root = Path(__file__).resolve().parent.parent
        self._temp_dir = Path("/tmp/video_insight_audio")
        self._temp_dir.mkdir(parents=True, exist_ok=True)

    def _detect_device(self, preferred_device: str = "auto") -> tuple[str, str]:
        """检测最佳设备和后端

        Returns:
            (device, backend) 元组
        """
        forced_backend = os.getenv("WHISPER_BACKEND", "").strip().lower()
        if forced_backend in {"openai-whisper", "faster-whisper"}:
            if forced_backend == "openai-whisper":
                try:
                    import torch
                    if torch.backends.mps.is_available():
                        logger.info("Using forced backend: openai-whisper on mps")
                        return "mps", "openai-whisper"
                except Exception as e:
                    logger.warning(f"Forced openai-whisper backend failed to detect MPS: {e}")

                logger.info("Using forced backend: openai-whisper on cpu")
                return "cpu", "openai-whisper"

            logger.info("Using forced backend: faster-whisper on cpu")
            return "cpu", "faster-whisper"

        preferred = (preferred_device or "auto").strip().lower()
        if preferred == "cpu":
            logger.info("Using configured device: cpu with faster-whisper")
            return "cpu", "faster-whisper"

        if preferred in {"mps", "metal", "gpu"}:
            try:
                import torch
                if torch.backends.mps.is_available():
                    logger.info("Using configured device: mps with openai-whisper")
                    return "mps", "openai-whisper"
            except Exception as e:
                logger.warning(f"Configured mps device is unavailable: {e}")

            logger.info("Falling back to cpu with faster-whisper")
            return "cpu", "faster-whisper"

        try:
            import torch
            if torch.backends.mps.is_available():
                logger.info("✓ Metal GPU (MPS) detected, using openai-whisper for acceleration")
                return "mps", "openai-whisper"
        except Exception as e:
            logger.debug(f"MPS detection failed: {e}")

        logger.info("Using CPU with faster-whisper")
        return "cpu", "faster-whisper"

    def load_model(self, model_size: Optional[str] = None) -> None:
        """加载 Whisper 模型"""
        if model_size:
            self._model_size = model_size

        config = config_manager.get()
        model_size = config.whisper.model_size if not model_size else model_size

        # 检测设备
        device, backend = self._detect_device(config.whisper.device)
        self._device = device
        self._backend = backend

        logger.info(f"Loading Whisper model: {model_size} on {device} using {backend}")

        # 模型缓存目录
        if config.whisper.cache_dir:
            cache_dir = Path(config.whisper.cache_dir).expanduser()
            if not cache_dir.is_absolute():
                cache_dir = self._project_root / cache_dir
            cache_dir = cache_dir.resolve()
        else:
            cache_dir = Path.home() / ".cache" / "whisper"

        cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Using cache directory: {cache_dir}")

        if backend == "openai-whisper":
            self._load_openai_whisper(model_size, device, cache_dir)
        else:
            self._load_faster_whisper(model_size, cache_dir)

        logger.info("Whisper model loaded successfully")

    def _load_openai_whisper(self, model_size: str, device: str, cache_dir: Path) -> None:
        """加载 OpenAI Whisper（支持 Metal GPU）"""
        import whisper
        import torch

        # 设置下载目录
        os.environ["WHISPER_CACHE_DIR"] = str(cache_dir)

        self._model = whisper.load_model(
            model_size,
            device=device,
            download_root=str(cache_dir)
        )

        # 设置为评估模式
        self._model.eval()

        # 如果是 MPS，启用优化
        if device == "mps":
            torch.mps.set_per_process_memory_fraction(0.8)

    def _load_faster_whisper(self, model_size: str, cache_dir: Path) -> None:
        """加载 Faster Whisper（CPU 优化）"""
        from faster_whisper import WhisperModel

        cpu_threads = max(4, min(12, os.cpu_count() or 8))
        num_workers = max(2, cpu_threads // 2)

        self._model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            download_root=str(cache_dir),
            cpu_threads=cpu_threads,
            num_workers=num_workers,
        )

    def _get_openai_decode_options(self) -> dict:
        """获取 OpenAI Whisper 解码参数（优先速度）。"""
        perf_mode = os.getenv("WHISPER_PERF_MODE", "fast").strip().lower()

        if perf_mode == "quality":
            beam_size = 5
            condition_on_previous_text = True
        elif perf_mode == "balanced":
            beam_size = 2
            condition_on_previous_text = False
        else:
            beam_size = 1
            condition_on_previous_text = False

        beam_size = int(os.getenv("WHISPER_BEAM_SIZE", beam_size))
        condition_env = os.getenv("WHISPER_CONDITION_PREV", "")
        if condition_env:
            condition_on_previous_text = condition_env.lower() in {"1", "true", "yes"}

        return {
            "beam_size": beam_size,
            "best_of": 1,
            "temperature": 0.0,
            "compression_ratio_threshold": 2.4,
            "no_speech_threshold": 0.6,
            "condition_on_previous_text": condition_on_previous_text,
            "fp16": self._device == "mps",
        }

    def is_model_loaded(self) -> bool:
        """检查模型是否已加载"""
        return self._model is not None

    def transcribe(
        self,
        audio_path: str,
        language: str = "zh",
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> str:
        """转录音频为文本"""
        if not self._model:
            self.load_model()

        logger.info(f"Transcribing audio: {audio_path}")

        if self._backend == "openai-whisper":
            return self._transcribe_openai(audio_path, language, progress_callback)
        else:
            return self._transcribe_faster(audio_path, language, progress_callback)

    def _transcribe_openai(
        self,
        audio_path: str,
        language: str,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> str:
        """使用 OpenAI Whisper 转录（Metal GPU 加速）"""
        import whisper
        import torch

        if progress_callback:
            progress_callback(10, "开始识别...")

        decode_options = self._get_openai_decode_options()
        logger.info(
            "OpenAI Whisper decode options: beam_size=%s, condition_on_previous_text=%s, fp16=%s",
            decode_options["beam_size"],
            decode_options["condition_on_previous_text"],
            decode_options["fp16"],
        )

        start_time = time.perf_counter()

        # 转录参数
        with torch.no_grad():
            result = self._model.transcribe(
                audio_path,
                language=language,
                **decode_options,
            )

        full_text = result["text"].strip()
        elapsed = time.perf_counter() - start_time
        segments = result.get("segments") or []
        audio_duration = 0.0
        if segments:
            audio_duration = float(segments[-1].get("end", 0.0) or 0.0)
        rtf = elapsed / audio_duration if audio_duration > 0 else 0.0

        if progress_callback:
            progress_callback(100, "识别完成")

        logger.info(
            "Transcription complete: %s characters, elapsed=%.2fs, audio=%.2fs, rtf=%.2f",
            len(full_text),
            elapsed,
            audio_duration,
            rtf,
        )
        return full_text

    def _transcribe_faster(
        self,
        audio_path: str,
        language: str,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> str:
        """使用 Faster Whisper 转录（CPU 优化）"""
        if progress_callback:
            progress_callback(10, "开始识别...")

        start_time = time.perf_counter()

        # 转录参数
        segments, info = self._model.transcribe(
            audio_path,
            language=language,
            beam_size=1,
            no_speech_threshold=0.6,
            log_progress=True,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )

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
        elapsed = time.perf_counter() - start_time
        rtf = elapsed / total_duration if total_duration > 0 else 0.0

        if progress_callback:
            progress_callback(100, "识别完成")
        
        logger.info(f"Transcription complete: full_text: {full_text}")
        logger.info(
            "Transcription complete: %s characters, elapsed=%.2fs, audio=%.2fs, rtf=%.2f",
            len(full_text),
            elapsed,
            total_duration,
            rtf,
        )
        return full_text

    def transcribe_video(
        self,
        video_path: str,
        language: str = "zh",
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> str:
        """转录视频（自动提取音频）"""
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

    def get_device_info(self) -> dict:
        """获取设备信息"""
        return {
            "device": self._device,
            "backend": self._backend,
            "model_size": self._model_size,
        }

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


def get_device_info() -> dict:
    """获取设备信息"""
    return whisper_service.get_device_info()
