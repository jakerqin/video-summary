import httpx
import json
from typing import AsyncGenerator, Optional
from utils.logger import setup_logger
from core.config_manager import config_manager

logger = setup_logger()


class Summarizer:
    """MiniMax 摘要生成器"""

    def __init__(self):
        self._api_key: Optional[str] = None
        self._base_url: Optional[str] = None
        self._model: Optional[str] = None

    def _get_config(self):
        """获取配置"""
        config = config_manager.get()

        if not self._api_key:
            self._api_key = config.minimax.api_key

        if not self._base_url:
            self._base_url = config.minimax.base_url

        if not self._model:
            self._model = config.minimax.model

    def _get_api_key(self) -> str:
        """获取 API Key"""
        self._get_config()

        if not self._api_key:
            raise ValueError("MiniMax API key not configured")

        return self._api_key

    async def summarize(
        self,
        text: str,
        template_prompt: str,
        stream: bool = True,
        progress_callback=None
    ) -> AsyncGenerator[str, None]:
        """生成摘要（流式输出）

        Args:
            text: 原始文本
            template_prompt: 提示词模板
            stream: 是否流式输出
            progress_callback: 进度回调

        Yields:
            生成的文本片段
        """
        api_key = self._get_api_key()

        # 构建完整的提示词
        full_prompt = f"""{template_prompt}

以下是视频的转录文本：
---
{text}
---

请按照上述要求整理内容。
"""
        logger.info(f"Full prompt: {full_prompt}")
        logger.info("Starting summarization with MiniMax")

        if progress_callback:
            progress_callback(5, "开始生成摘要...")

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{self._base_url}/text/chatcompletion_v2",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self._model,
                        "messages": [
                            {
                                "role": "user",
                                "content": full_prompt,
                            }
                        ],
                        "tokens_to_generate": 4096,
                        "temperature": 0.7,
                        "top_p": 0.95,
                    },
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.text()
                        logger.error(f"MiniMax API error: {error_text}")
                        raise Exception(f"API request failed: {response.status_code}")

                    buffer = ""
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = json.loads(line[6:])

                            if "choices" in data:
                                choice = data["choices"][0]
                                if "delta" in choice:
                                    content = choice["delta"].get("content", "")
                                    if content:
                                        buffer += content
                                        yield content

                            # 模拟进度
                            if progress_callback:
                                progress_callback(
                                    30 + min(len(buffer) * 2, 60),
                                    "正在生成摘要...",
                                )

            if progress_callback:
                progress_callback(100, "摘要生成完成")

            logger.info("Summarization complete")

        except Exception as e:
            logger.error(f"Summarization failed: {e}")
            raise

    def summarize_sync(
        self,
        text: str,
        template_prompt: str,
        max_tokens: int = 4096
    ) -> str:
        """同步生成摘要（非流式）"""
        import asyncio

        # 由于 API 是流式的，我们需要收集所有内容
        collected = []

        async def collect():
            async for chunk in self.summarize(text, template_prompt):
                collected.append(chunk)

        asyncio.run(collect())
        return "".join(collected)


# 全局服务实例
summarizer = Summarizer()


# 便捷函数
async def generate_summary(
    text: str,
    template_prompt: str,
    progress_callback=None
) -> AsyncGenerator[str, None]:
    """生成摘要"""
    async for chunk in summarizer.summarize(text, template_prompt, progress_callback=progress_callback):
        yield chunk


def summarize_sync(text: str, template_prompt: str) -> str:
    """同步生成摘要"""
    return summarizer.summarize_sync(text, template_prompt)
