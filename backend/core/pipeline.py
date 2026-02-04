import asyncio
import os
from pathlib import Path
from typing import Optional, Callable
from models.task import Task, TaskStatus, TaskType, TaskCreate
from models.config import Settings
from downloaders.xiaohongshu import download_video, get_video_info, register_downloaders
from processors.subtitle_extractor import extract_subtitles
from processors.whisper_service import whisper_service, load_whisper_model
from processors.summarizer import summarizer
from processors.markdown_generator import markdown_generator
from core.config_manager import config_manager
from api.websocket import manager
from utils.logger import setup_logger
from utils.file_utils import create_temp_dir, cleanup_temp_dir

logger = setup_logger()


class VideoProcessingPipeline:
    """视频处理管线

    处理流程：
    1. 下载/读取视频
    2. 字幕提取
    3. Whisper 语音识别
    4. MiniMax 摘要生成
    5. Markdown 导出
    """

    def __init__(self):
        self._temp_dir: Optional[Path] = None
        self._progress_callback: Optional[Callable] = None

        # 注册下载器
        register_downloaders()

    async def process(
        self,
        task: TaskCreate,
        progress_callback: Optional[Callable[[TaskStatus, int, str], None]] = None
    ) -> dict:
        """执行完整的视频处理流程

        Args:
            task: 任务信息
            progress_callback: 进度回调 (status, progress, message)

        Returns:
            处理结果 {'success': bool, 'output_path': str, 'error': str}
        """
        self._progress_callback = progress_callback
        self._temp_dir = create_temp_dir(f"task_{task.id}_")

        try:
            logger.info(f"Starting processing task: {task.id}")
            self._update_progress(TaskStatus.PROCESSING, 5, "开始处理...")

            # Step 1: 获取视频
            video_path = await self._get_video(task)
            self._update_progress(TaskStatus.PROCESSING, 20, "视频获取完成")

            # Step 2: 提取字幕
            self._update_progress(TaskStatus.PROCESSING, 25, "检查字幕...")
            text = await self._extract_text(video_path)

            # Step 3: 生成摘要
            self._update_progress(TaskStatus.PROCESSING, 40, "开始生成摘要...")
            summary = await self._generate_summary(text, task.template_prompt)

            # Step 4: 导出 Markdown
            self._update_progress(TaskStatus.PROCESSING, 95, "导出文件...")
            output_path = self._export_markdown(summary, task, video_path)

            # 完成
            self._update_progress(TaskStatus.COMPLETED, 100, "处理完成")

            logger.info(f"Task {task.id} completed successfully")
            return {
                "success": True,
                "output_path": output_path,
                "task_id": task.id,
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Task {task.id} failed: {error_msg}")
            self._update_progress(TaskStatus.FAILED, 0, f"处理失败: {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "task_id": task.id,
            }

        finally:
            # 清理临时文件
            if self._temp_dir:
                cleanup_temp_dir(self._temp_dir)
                logger.info(f"Cleaned up temp directory for task {task.id}")

    async def _get_video(self, task: TaskCreate) -> str:
        """获取视频文件"""
        self._update_progress(TaskStatus.PROCESSING, 10, "获取视频中...")

        if task.type == TaskType.FILE:
            # 本地文件，直接返回
            if not os.path.exists(task.source):
                raise ValueError(f"File not found: {task.source}")
            return task.source

        elif task.type == TaskType.URL:
            # 下载视频
            output_path = str(self._temp_dir / "downloads")
            os.makedirs(output_path, exist_ok=True)

            def download_progress(progress: int, message: str):
                self._update_progress(
                    TaskStatus.DOWNLOADING,
                    5 + int(progress * 0.1),  # 5-15%
                    f"下载中: {message}",
                )

            video_path = await download_video(
                task.source,
                output_path,
                download_progress,
            )

            return video_path

        raise ValueError(f"Unknown task type: {task.type}")

    async def _extract_text(self, video_path: str) -> str:
        """提取视频文本（字幕或语音识别）"""
        # Step 1: 尝试提取字幕
        self._update_progress(TaskStatus.PROCESSING, 25, "检查字幕...")

        subtitles = extract_subtitles(video_path)

        if subtitles:
            logger.info("Using existing subtitles")
            self._update_progress(TaskStatus.PROCESSING, 35, "使用字幕识别...")
            return subtitles

        # Step 2: 没有字幕，使用 Whisper
        logger.info("No subtitles found, using Whisper")
        self._update_progress(TaskStatus.PROCESSING, 35, "语音识别中...")

        # 加载模型（如果还未加载）
        if not whisper_service.is_model_loaded():
            config = config_manager.get()
            load_whisper_model(config.whisper.model_size)

        def whisper_progress(progress: int, message: str):
            self._update_progress(
                TaskStatus.PROCESSING,
                35 + int(progress * 0.05),  # 35-40%
                f"语音识别: {message}",
            )

        text = whisper_service.transcribe_video(
            video_path,
            language="zh",
            progress_callback=whisper_progress,
        )

        return text

    async def _generate_summary(
        self,
        text: str,
        template_prompt: str
    ) -> str:
        """生成摘要"""
        # 检查 API Key
        config = config_manager.get()
        if not config.minimax.api_key:
            raise ValueError("MiniMax API key not configured")

        # 如果文本太长，截取一部分
        max_chars = 15000  # MiniMax 支持的上下文长度
        if len(text) > max_chars:
            text = text[:max_chars]
            logger.warning(f"Text truncated to {max_chars} characters")

        # 流式生成摘要
        summary_parts = []

        def progress_callback(progress: int, message: str):
            self._update_progress(
                TaskStatus.PROCESSING,
                40 + int(progress * 0.55),  # 40-95%
                message,
            )

        async for chunk in summarizer.summarize(text, template_prompt, progress_callback=progress_callback):
            summary_parts.append(chunk)

        return "".join(summary_parts)

    def _export_markdown(
        self,
        summary: str,
        task: TaskCreate,
        video_path: str
    ) -> str:
        """导出 Markdown 文件"""
        config = config_manager.get()

        # 获取视频信息
        video_info = None
        if task.type == TaskType.URL:
            try:
                video_info = get_video_info(task.source)
            except Exception as e:
                logger.warning(f"Failed to get video info: {e}")

        # 构建元数据
        metadata = {
            "title": video_info.title if video_info else (task.title or "视频摘要"),
            "source": task.source,
            "author": video_info.author if video_info else "",
            "platform": video_info.platform if video_info else "",
        }

        # 生成 Markdown
        output_path = config.get_output_dir()
        return markdown_generator.generate(summary, metadata, str(output_path))

    def _update_progress(
        self,
        status: TaskStatus,
        progress: int,
        message: str
    ) -> None:
        """更新进度"""
        # 通过 WebSocket 推送进度
        try:
            asyncio.create_task(
                manager.send_message(
                    {
                        "type": "progress",
                        "task_id": getattr(self, "_current_task_id", None),
                        "status": status.value,
                        "progress": progress,
                        "message": message,
                    },
                    None,  # broadcast
                )
            )
        except Exception as e:
            logger.warning(f"Failed to send progress: {e}")

        # 调用回调
        if self._progress_callback:
            self._progress_callback(status, progress, message)


# 全局管线实例
pipeline = VideoProcessingPipeline()


# 便捷函数
async def process_video(
    task: TaskCreate,
    progress_callback: Optional[Callable] = None
) -> dict:
    """处理视频"""
    return await pipeline.process(task, progress_callback)
