import os
from pathlib import Path
from typing import Optional
import yaml
from models.config import Settings, Template, AppConfig, WhisperConfig, MiniMaxConfig, DownloaderConfig


class ConfigManager:
    """配置管理器"""

    DEFAULT_TEMPLATES = [
        Template(
            id="study",
            name="学习笔记",
            prompt="请将以下视频内容整理成学习笔记格式，包含：\n1. 核心概念\n2. 关键要点\n3. 实践建议\n4. 思考题",
        ),
        Template(
            id="summary",
            name="要点提取",
            prompt="请提取视频的核心要点，以简洁的列表形式呈现，每个要点用一句话总结。",
        ),
        Template(
            id="detail",
            name="详细记录",
            prompt="请详细记录视频内容，保留所有重要信息和细节。按时间顺序组织内容。",
        ),
        Template(
            id="qa",
            name="问答格式",
            prompt="请将视频内容整理成问答格式，提取关键问题和答案。",
        ),
        Template(
            id="mindmap",
            name="思维导图",
            prompt="请将视频内容整理成思维导图结构，使用 Markdown 格式的层级列表。",
        ),
    ]

    def __init__(self):
        self._config: Optional[Settings] = None
        self._config_path = self._get_config_path()

    def _get_config_path(self) -> Path:
        """获取配置文件路径"""
        # 用户配置存储在应用数据目录
        config_dir = Path.home() / "Library" / "Application Support" / "VideoInsight"
        config_dir.mkdir(parents=True, exist_ok=True)
        return config_dir / "config.yaml"

    def load(self) -> Settings:
        """加载配置"""
        if self._config_path.exists():
            try:
                with open(self._config_path, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f) or {}
                self._config = Settings(**data)
            except Exception as e:
                print(f"Failed to load config: {e}")
                self._config = self._create_default_config()
        else:
            self._config = self._create_default_config()

        return self._config

    def _create_default_config(self) -> Settings:
        """创建默认配置"""
        return Settings(
            templates=self.DEFAULT_TEMPLATES,
            whisper=WhisperConfig(model_size="base"),
            minimax=MiniMaxConfig(api_key=""),
            downloader=DownloaderConfig(timeout=300),
        )

    def save(self, config: Optional[Settings] = None) -> None:
        """保存配置"""
        config = config or self._config
        if config:
            with open(self._config_path, "w", encoding="utf-8") as f:
                yaml.dump(config.model_dump(mode="python"), f, allow_nan=False)

    def get(self) -> Settings:
        """获取当前配置"""
        if not self._config:
            self.load()
        return self._config

    def update_minimax_key(self, api_key: str) -> None:
        """更新 MiniMax API Key"""
        if not self._config:
            self.load()
        self._config.minimax.api_key = api_key
        self.save()

    def get_template_by_id(self, template_id: str) -> Optional[Template]:
        """根据 ID 获取模板"""
        if not self._config:
            self.load()
        for template in self._config.templates:
            if template.id == template_id:
                return template
        return None

    def get_output_dir(self) -> Path:
        """获取输出目录"""
        if not self._config:
            self.load()
        output_path = Path(self._config.app.output_dir).expanduser()
        output_path.mkdir(parents=True, exist_ok=True)
        return output_path


# 全局配置管理器实例
config_manager = ConfigManager()
