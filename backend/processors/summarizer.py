import inspect
from typing import AsyncGenerator, Optional
from anthropic import AsyncAnthropic
from utils.logger import setup_logger
from core.config_manager import config_manager

logger = setup_logger()


class Summarizer:
    """MiniMax 摘要生成器（使用 Anthropic SDK）"""

    def __init__(self):
        self._model: Optional[str] = None
        self._max_tokens: int = 4096

    def _create_client(self) -> AsyncAnthropic:
        """按次创建 Anthropic 客户端，避免复用失效连接。"""
        config = config_manager.get()

        if not config.minimax.api_key:
            raise ValueError("MiniMax API key not configured")

        self._model = config.minimax.model
        self._max_tokens = config.minimax.max_tokens

        return AsyncAnthropic(
            api_key=config.minimax.api_key,
            base_url=config.minimax.base_url,
            timeout=120,
            max_retries=1,
        )

    async def _close_client(self, client: AsyncAnthropic) -> None:
        """兼容同步/异步 close，避免资源泄露和 RuntimeWarning。"""
        try:
            close_result = client.close()
            if inspect.isawaitable(close_result):
                await close_result
        except Exception as e:
            logger.warning("Failed to close MiniMax client: %s", e)

    @staticmethod
    def _extract_text_from_message(message) -> str:
        """从响应中提取文本内容，忽略 thinking 等非文本块。"""
        content_blocks = getattr(message, "content", None) or []
        text_parts = []
        block_types = []

        for block in content_blocks:
            block_type = getattr(block, "type", None)
            if isinstance(block, dict):
                block_type = block.get("type")

            if block_type:
                block_types.append(block_type)

            if block_type != "text":
                continue

            if isinstance(block, dict):
                text = block.get("text", "")
            else:
                text = getattr(block, "text", "")

            if text:
                text_parts.append(text)

        if text_parts:
            return "".join(text_parts)

        fallback_text = getattr(message, "output_text", "")
        if isinstance(fallback_text, str) and fallback_text.strip():
            return fallback_text

        raise ValueError(
            "No text content in MiniMax response, content block types: "
            f"{block_types or ['unknown']}"
        )

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
        client = self._create_client()

        # 构建完整的提示词
        full_prompt = f"""{template_prompt}

以下是视频的转录文本：
---
{text}
---

请按照上述要求整理内容。
"""
        logger.info("Starting summarization with MiniMax")

        if progress_callback:
            progress_callback(5, "开始生成摘要...")

        try:
            # 使用 Anthropic SDK 流式调用
            async with client.messages.stream(
                model=self._model,
                max_tokens=self._max_tokens,
                temperature=0.7,
                messages=[
                    {
                        "role": "user",
                        "content": full_prompt,
                    }
                ],
            ) as stream:
                buffer = ""
                async for text_chunk in stream.text_stream:
                    buffer += text_chunk
                    yield text_chunk

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
            logger.error("Summarization failed [%s]: %s", type(e).__name__, e)
            raise
        finally:
            await self._close_client(client)

    async def summarize_non_stream(
        self,
        text: str,
        template_prompt: str,
        progress_callback=None
    ) -> str:
        """生成摘要（非流式）"""
        client = self._create_client()

        # 构建完整的提示词
        full_prompt = f"""{template_prompt}

以下是视频的转录文本：
---
{text}
---

请按照上述要求整理内容。
"""
        logger.info("Starting summarization with MiniMax (non-stream)")

        if progress_callback:
            progress_callback(5, "开始生成摘要...")

        try:
            # 非流式调用
            message = await client.messages.create(
                model=self._model,
                max_tokens=self._max_tokens,
                temperature=0.7,
                messages=[
                    {
                        "role": "user",
                        "content": full_prompt,
                    }
                ],
            )

            result = self._extract_text_from_message(message)

            if progress_callback:
                progress_callback(100, "摘要生成完成")

            logger.info("Summarization complete")
            return result

        except Exception as e:
            logger.error("Summarization failed [%s]: %s", type(e).__name__, e)
            raise
        finally:
            await self._close_client(client)

    def summarize_sync(
        self,
        text: str,
        template_prompt: str,
        max_tokens: int = 4096
    ) -> str:
        """同步生成摘要（非流式）"""
        import asyncio

        # 收集所有内容
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
