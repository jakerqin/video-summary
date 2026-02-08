import asyncio
import os
from pathlib import Path
from typing import Callable, Optional

from api.websocket import manager
from core.config_manager import config_manager
from downloaders.xiaohongshu import download_video, register_downloaders
from models.task import TaskCreate, TaskStatus, TaskType
from processors.subtitle_extractor import extract_subtitles
from processors.whisper_service import load_whisper_model, whisper_service
from utils.file_utils import cleanup_temp_dir, create_temp_dir
from utils.logger import setup_logger

logger = setup_logger()


class VideoProcessingPipeline:
    """视频处理管线（仅负责转录阶段）

    处理流程：
    1. 下载/读取视频
    2. 字幕提取
    3. Whisper 语音识别（字幕缺失时）
    4. 返回转录文本给前端继续摘要
    """

    _downloaders_registered = False

    def __init__(self):
        self._temp_dir: Optional[Path] = None
        self._progress_callback: Optional[Callable] = None
        self._current_task_id: Optional[str] = None

        if not VideoProcessingPipeline._downloaders_registered:
            register_downloaders()
            VideoProcessingPipeline._downloaders_registered = True

    async def process(
        self,
        task: TaskCreate,
        progress_callback: Optional[Callable[[TaskStatus, int, str], None]] = None,
    ) -> dict:
        """执行视频转录流程。"""
        self._progress_callback = progress_callback
        self._current_task_id = task.id
        self._temp_dir = create_temp_dir(f"task_{task.id}_")

        try:
            self._log_step(f"Starting processing task: {task.id}")
            self._log_step(f"Task type: {task.type.value}, Source: {task.source[:100]}")
            self._update_progress(TaskStatus.PROCESSING, 5, "开始处理任务")

            # Step 1: 获取视频
            self._log_step("Step 1/2: Preparing video source...")
            video_path = await self._get_video(task)
            self._log_step(f"Video source ready: {video_path}")
            self._update_progress(TaskStatus.PROCESSING, 20, "视频准备完成")

            # Step 2: 字幕/语音识别
            self._log_step("Step 2/2: Extracting text from video...")
            text = await self._extract_text(video_path)
            if not text.strip():
                raise ValueError("Transcription result is empty")

            self._log_step(f"Transcription completed, total chars: {len(text)}")
            self._log_step("Backend transcription finished, waiting for frontend to call MiniMax")
            self._update_progress(
                TaskStatus.PROCESSING,
                60,
                "转录完成，等待前端流式摘要",
            )

            return {
                "success": True,
                "task_id": task.id,
                "transcript": text,
                "transcript_length": len(text),
                "source": task.source,
                "title": task.title,
                "task_type": task.type.value,
            }

        except Exception as e:
            error_msg = str(e)
            self._log_step(f"Task {task.id} failed: {error_msg}", level="error")
            self._update_progress(TaskStatus.FAILED, 0, f"处理失败: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "task_id": task.id,
            }

        finally:
            if self._temp_dir:
                cleanup_temp_dir(self._temp_dir)
                self._log_step(f"Cleaned up temp directory for task {task.id}")
            self._current_task_id = None

    async def _get_video(self, task: TaskCreate) -> str:
        """获取视频文件。"""
        self._update_progress(TaskStatus.PROCESSING, 10, "准备视频输入")

        if task.type == TaskType.FILE:
            if not os.path.exists(task.source):
                raise ValueError(f"File not found: {task.source}")
            self._log_step(f"Using local file: {task.source}")
            self._log_step(f"File size: {os.path.getsize(task.source) / 1024 / 1024:.2f} MB")
            return task.source

        if task.type == TaskType.URL:
            output_path = str(self._temp_dir / "downloads")
            os.makedirs(output_path, exist_ok=True)
            self._log_step(f"Downloading video from URL: {task.source[:100]}")

            def download_progress(progress: int, message: str):
                self._update_progress(
                    TaskStatus.DOWNLOADING,
                    10 + int(progress * 0.1),
                    f"下载中: {message}",
                )
                # 每10%推送一次日志
                if progress % 10 == 0:
                    self._log_step(f"Download progress: {progress}% - {message}")

            video_path = await download_video(task.source, output_path, download_progress)
            self._log_step(f"Video download completed: {video_path}")
            self._log_step(f"Downloaded file size: {os.path.getsize(video_path) / 1024 / 1024:.2f} MB")
            return video_path

        raise ValueError(f"Unknown task type: {task.type}")

    async def _extract_text(self, video_path: str) -> str:
        """提取视频文本（字幕优先）。"""
        self._update_progress(TaskStatus.PROCESSING, 25, "检查内嵌字幕")
        self._log_step(f"Extracting subtitles from: {video_path}")

        subtitles = extract_subtitles(video_path)
        if subtitles:
            self._log_step("Subtitles found, using embedded subtitles")
            self._log_step(f"Subtitle text length: {len(subtitles)} characters")
            self._update_progress(TaskStatus.PROCESSING, 50, "已使用字幕完成转录")
            return subtitles

        self._log_step("No subtitles found, using Whisper")
        self._update_progress(TaskStatus.PROCESSING, 35, "启动 Whisper 语音识别")

        if not whisper_service.is_model_loaded():
            config = config_manager.get()
            self._log_step(f"Loading Whisper model: {config.whisper.model_size}")
            self._log_step("This may take a few seconds on first run...")
            load_whisper_model(config.whisper.model_size)
            self._log_step("Whisper model loaded successfully")

        def whisper_progress(progress: int, message: str):
            self._update_progress(
                TaskStatus.PROCESSING,
                35 + int(progress * 0.2),
                f"语音识别: {message}",
            )
            # 每20%推送一次日志
            if progress % 20 == 0:
                self._log_step(f"Whisper progress: {progress}% - {message}")

        self._log_step("Starting Whisper transcription...")
        text = whisper_service.transcribe_video(
            video_path,
            language="zh",
            progress_callback=whisper_progress,
        )
        self._log_step("Whisper transcription completed")
        self._log_step(f"Transcribed text length: {len(text)} characters")
        return text

    def _update_progress(self, status: TaskStatus, progress: int, message: str) -> None:
        """更新进度并广播给前端。"""
        payload = {
            "type": "progress",
            "taskId": self._current_task_id,
            "task_id": self._current_task_id,
            "status": status.value,
            "progress": progress,
            "message": message,
        }
        self._broadcast(payload)

        if self._progress_callback:
            self._progress_callback(status, progress, message)

    def _log_step(self, message: str, level: str = "info") -> None:
        """记录步骤日志并推送到前端日志面板。"""
        log_func = getattr(logger, level, logger.info)
        log_func(message)

        payload = {
            "type": "task_log",
            "taskId": self._current_task_id,
            "task_id": self._current_task_id,
            "level": level,
            "message": message,
        }
        self._broadcast(payload)

    def _broadcast(self, payload: dict) -> None:
        try:
            asyncio.create_task(manager.broadcast(payload))
        except Exception as e:
            logger.warning("Failed to broadcast message: %s", e)


    @staticmethod
    def _is_retryable_summarization_error(error: Exception) -> bool:
        """保留兼容接口，供历史测试与调用方复用。"""
        retryable_markers = [
            "incomplete chunked read",
            "peer closed connection",
            "connection error",
            "api connection error",
            "connection reset",
            "connection aborted",
            "remoteprotocolerror",
            "temporarily unavailable",
            "timed out",
            "timeout",
            "503",
            "502",
            "504",
            "429",
            "rate limit",
        ]

        error_text = str(error).lower()
        return any(marker in error_text for marker in retryable_markers)


# 便捷函数
async def process_video(task: TaskCreate, progress_callback: Optional[Callable] = None) -> dict:
    """处理视频转录任务。"""
    pipeline = VideoProcessingPipeline()
    return await pipeline.process(task, progress_callback)
