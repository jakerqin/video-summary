from pydantic import BaseModel
from typing import List, Optional


class Template(BaseModel):
    id: str
    name: str
    prompt: str
    is_custom: bool = False


class AppConfig(BaseModel):
    name: str = "Video Insight"
    version: str = "1.0.0"
    output_dir: str = "~/Documents/VideoInsight"


class WhisperConfig(BaseModel):
    model_config = {'protected_namespaces': ()}

    model_size: str = "base"
    language: str = "zh"
    device: str = "cpu"
    cache_dir: Optional[str] = None  # 自定义缓存目录，默认使用 ~/.cache/whisper


class MiniMaxConfig(BaseModel):
    api_key: str = ""
    model: str = "abab6.5s-chat"
    max_tokens: int = 4096
    base_url: str = "https://api.minimaxi.com/anthropic"


class DownloaderConfig(BaseModel):
    timeout: int = 300
    max_retries: int = 3


class Settings(BaseModel):
    app: AppConfig = AppConfig()
    whisper: WhisperConfig = WhisperConfig()
    minimax: MiniMaxConfig = MiniMaxConfig()
    templates: List[Template] = []
    downloader: DownloaderConfig = DownloaderConfig()
