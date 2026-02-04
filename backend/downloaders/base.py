from abc import ABC, abstractmethod
from typing import Optional
from models.task import VideoInfo
import asyncio


class BaseDownloader(ABC):
    """视频下载器基类"""

    @abstractmethod
    async def can_handle(self, url: str) -> bool:
        """判断是否支持该 URL"""
        pass

    @abstractmethod
    async def download(
        self,
        url: str,
        output_path: str,
        progress_callback=None
    ) -> str:
        """下载视频，返回本地路径"""
        pass

    @abstractmethod
    async def get_video_info(self, url: str) -> VideoInfo:
        """获取视频信息"""
        pass


class DownloaderRegistry:
    """下载器注册中心"""

    def __init__(self):
        self._downloaders: list[BaseDownloader] = []

    def register(self, downloader: BaseDownloader) -> None:
        """注册下载器"""
        self._downloaders.append(downloader)

    async def get_downloader(self, url: str) -> Optional[BaseDownloader]:
        """获取匹配的下载器"""
        for downloader in self._downloaders:
            if await downloader.can_handle(url):
                return downloader
        return None

    def get_supported_platforms(self) -> list[str]:
        """获取支持的平台列表"""
        platforms = []
        for downloader in self._downloaders:
            platforms.append(downloader.__class__.__name__)
        return platforms


# 全局注册中心
downloader_registry = DownloaderRegistry()
