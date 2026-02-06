import httpx
import re
import json
import os
from pathlib import Path
from typing import Optional
from models.task import VideoInfo
from downloaders.base import BaseDownloader, downloader_registry
from utils.logger import setup_logger

logger = setup_logger()


class XiaohongshuDownloader(BaseDownloader):
    """小红书视频下载器

    参考开源项目实现：
    https://github.com/hoanx0601/Xiaohongshu_Douyin_downloader_no_watermark
    """

    # 小红书链接格式
    URL_PATTERNS = [
        r"https://www\.xiaohongshu\.com/explore/[a-zA-Z0-9]+",
        r"https://xhslink\.com/[a-zA-Z0-9]+",
    ]

    async def can_handle(self, url: str) -> bool:
        """判断是否是小红书链接"""
        return any(re.match(pattern, url) for pattern in self.URL_PATTERNS)

    async def download(
        self,
        url: str,
        output_path: str,
        progress_callback=None
    ) -> str:
        """下载小红书视频"""
        logger.info(f"Starting download from Xiaohongshu: {url}")

        try:
            # 获取视频信息
            video_info = await self.get_video_info(url)

            # 获取视频真实地址
            video_url = await self._get_video_url(url)

            if not video_url:
                raise Exception("Failed to get video URL")

            # 下载视频
            async with httpx.AsyncClient(follow_redirects=True) as client:
                async with client.stream("GET", video_url) as response:
                    total = int(response.headers.get("content-length", 0))
                    downloaded = 0

                    output_file = Path(output_path) / f"{video_info.title}.mp4"
                    output_file.parent.mkdir(parents=True, exist_ok=True)

                    with open(output_file, "wb") as f:
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            f.write(chunk)
                            downloaded += len(chunk)

                            if progress_callback and total > 0:
                                progress = int(downloaded / total * 100)
                                progress_callback(progress, f"已下载 {downloaded}/{total} bytes")

            logger.info(f"Download complete: {output_file}")
            return str(output_file)

        except Exception as e:
            logger.error(f"Download failed: {e}")
            raise

    async def get_video_info(self, url: str) -> VideoInfo:
        """获取小红书视频信息"""
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                }

                response = await client.get(url, headers=headers, follow_redirects=True)
                html = response.text

                # 提取视频信息
                title = await self._extract_title(html)
                author = await self._extract_author(html)

                return VideoInfo(
                    title=title or "小红书视频",
                    author=author or "未知作者",
                    duration=0.0,
                    platform="xiaohongshu",
                )

        except Exception as e:
            logger.error(f"Failed to get video info: {e}")
            return VideoInfo(
                title="小红书视频",
                author="未知作者",
                duration=0.0,
                platform="xiaohongshu",
            )

    async def _get_video_url(self, url: str) -> Optional[str]:
        """获取视频真实下载地址"""
        try:
            # 小红书的视频地址通常需要通过 API 获取
            # 这里使用模拟实现，实际需要根据具体接口调整

            async with httpx.AsyncClient() as client:
                # 提取笔记 ID
                note_id = self._extract_note_id(url)

                if not note_id:
                    # 尝试从页面获取
                    return None

                # 调用小红书 API（此为示例，实际接口可能不同）
                api_url = f"https://www.xiaohongshu.com/api/sns/web/v1/notes/{note_id}"

                headers = {
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                }

                response = await client.get(api_url, headers=headers)

                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        video_data = data.get("data", {}).get("note", {})
                        return video_data.get("video", {}).get("play_url")

                return None

        except Exception as e:
            logger.error(f"Failed to get video URL: {e}")
            return None

    def _extract_note_id(self, url: str) -> Optional[str]:
        """从 URL 提取笔记 ID"""
        # xhslink.com/abc123 -> abc123
        match = re.search(r"xhslink\.com/([a-zA-Z0-9]+)", url)
        if match:
            return match.group(1)

        # www.xiaohongshu.com/explore/abc123 -> abc123
        match = re.search(r"explore/([a-zA-Z0-9]+)", url)
        if match:
            return match.group(1)

        return None

    async def _extract_title(self, html: str) -> Optional[str]:
        """从页面提取标题"""
        try:
            # 尝试从 JSON-LD 或其他位置提取
            match = re.search(r'"title":"([^"]+)"', html)
            if match:
                return match.group(1)
        except Exception:
            pass
        return None

    async def _extract_author(self, html: str) -> Optional[str]:
        """从页面提取作者"""
        try:
            match = re.search(r'"author":{"name":"([^"]+)"', html)
            if match:
                return match.group(1)
        except Exception:
            pass
        return None


# 注册下载器
def register_downloaders():
    """注册所有下载器"""
    downloader_registry.register(XiaohongshuDownloader())


# 便捷函数
async def download_video(
    url: str,
    output_path: str,
    progress_callback=None
) -> str:
    """下载视频（自动选择下载器）"""
    downloader = await downloader_registry.get_downloader(url)

    if not downloader:
        raise ValueError(f"Unsupported URL: {url}")

    return await downloader.download(url, output_path, progress_callback)


async def get_video_info(url: str) -> VideoInfo:
    """获取视频信息（自动选择下载器）"""
    downloader = await downloader_registry.get_downloader(url)

    if not downloader:
        raise ValueError(f"Unsupported URL: {url}")

    return await downloader.get_video_info(url)
