# Video Insight - 技术设计文档

**文档版本：** v1.0
**创建日期：** 2026-02-03
**作者：** Video Insight Team

---

## 1. 系统架构

### 1.1 整体架构

```
┌─────────────────────────────────────────────┐
│         Electron 渲染进程 (React)            │
│  ┌─────────────┐  ┌──────────────────────┐  │
│  │ 拖拽上传区   │  │  URL 输入框          │  │
│  └─────────────┘  └──────────────────────┘  │
│  ┌─────────────────────────────────────────┐│
│  │  模板选择器 (预设 + 自定义 Prompt)       ││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │  处理进度 (实时状态 + 日志)             ││
│  └─────────────────────────────────────────┘│
└──────────────┬──────────────────────────────┘
               │ IPC (Electron)
┌──────────────┴──────────────────────────────┐
│         Electron 主进程                      │
│  - 窗口管理                                  │
│  - Python 子进程管理                         │
│  - 文件系统访问                              │
└──────────────┬──────────────────────────────┘
               │ HTTP (localhost:8000)
┌──────────────┴──────────────────────────────┐
│         Python FastAPI 后端                  │
│  ┌─────────────────────────────────────────┐│
│  │ 视频处理管线 (Pipeline)                  ││
│  │  1. 下载/读取 → 2. 字幕提取              ││
│  │  3. Whisper 识别 → 4. MiniMax 摘要       ││
│  │  5. Markdown 生成                        ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### 1.2 架构设计原则

- **进程隔离：** Python 后端独立进程，崩溃不影响 UI
- **异步处理：** 长时间任务使用 WebSocket 推送进度
- **插件化：** 视频下载器设计为可插拔模块
- **配置驱动：** 模板、API Key 等通过配置文件管理

---

## 2. 技术选型

### 2.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 28+ | 桌面应用框架 |
| React | 18+ | UI 框架 |
| TypeScript | 5+ | 类型安全 |
| Vite | 5+ | 构建工具 |
| Tailwind CSS | 3+ | 样式框架 |
| Zustand | 4+ | 状态管理 |

### 2.2 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.10+ | 后端语言 |
| FastAPI | 0.109+ | Web 框架 |
| faster-whisper | 1.0+ | 语音识别 |
| FFmpeg | 6.0+ | 视频处理 |
| httpx | 0.26+ | HTTP 客户端 |
| pydantic | 2.5+ | 数据验证 |

### 2.3 第三方服务

- **MiniMax M2.1 API：** 文本摘要生成
- **小红书视频下载：** 参考开源项目实现

---

## 3. 核心模块设计

### 3.1 前端模块结构

```
frontend/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 主进程入口
│   │   ├── window.ts            # 窗口管理
│   │   ├── ipc.ts               # IPC 通信
│   │   └── python-manager.ts   # Python 子进程管理
│   ├── renderer/                # Electron 渲染进程
│   │   ├── App.tsx              # 应用根组件
│   │   ├── pages/
│   │   │   └── Home.tsx         # 主页面
│   │   ├── components/
│   │   │   ├── DropZone.tsx     # 文件拖拽区
│   │   │   ├── URLInput.tsx     # URL 输入框
│   │   │   ├── TemplateSelector.tsx  # 模板选择器
│   │   │   ├── ProcessingQueue.tsx   # 处理队列
│   │   │   ├── ProgressPanel.tsx     # 进度面板
│   │   │   └── SettingsPanel.tsx     # 设置面板
│   │   ├── services/
│   │   │   ├── ipc.ts           # IPC 服务
│   │   │   └── websocket.ts     # WebSocket 服务
│   │   ├── stores/
│   │   │   ├── app.ts           # 应用状态
│   │   │   ├── queue.ts         # 队列状态
│   │   │   └── settings.ts      # 设置状态
│   │   └── types/
│   │       └── index.ts         # 类型定义
│   └── preload/
│       └── index.ts             # 预加载脚本
├── package.json
└── vite.config.ts
```

### 3.2 后端模块结构

```
backend/
├── main.py                      # FastAPI 入口
├── api/
│   ├── __init__.py
│   ├── process.py               # 处理接口
│   ├── config.py                # 配置管理
│   └── websocket.py             # WebSocket 接口
├── core/
│   ├── __init__.py
│   ├── pipeline.py              # 处理管线
│   └── queue.py                 # 任务队列
├── downloaders/
│   ├── __init__.py
│   ├── base.py                  # 下载器基类
│   └── xiaohongshu.py           # 小红书下载器
├── processors/
│   ├── __init__.py
│   ├── subtitle_extractor.py   # 字幕提取
│   ├── whisper_service.py       # Whisper 服务
│   ├── summarizer.py            # 摘要生成
│   └── markdown_generator.py   # Markdown 生成
├── models/
│   ├── __init__.py
│   ├── task.py                  # 任务模型
│   └── config.py                # 配置模型
├── templates/
│   └── prompts.json             # 预设模板
├── utils/
│   ├── __init__.py
│   ├── logger.py                # 日志工具
│   └── file_utils.py            # 文件工具
├── requirements.txt
└── config.yaml                  # 配置文件
```

---

## 4. 数据流设计

### 4.1 视频处理流程

```
用户输入（文件/URL）
    ↓
[1] 输入验证与队列管理
    ├─ 本地文件：检查格式、大小
    └─ URL：识别平台（小红书/其他）
    ↓
[2] 视频获取
    ├─ 本地文件：直接读取
    └─ URL：调用对应下载器
    │   └─ 小红书：参考开源项目实现
    ↓
[3] 字幕/文本提取（优先级处理）
    ├─ 检查内嵌字幕（SRT/ASS/VTT）
    ├─ 如有字幕 → 直接提取文本
    └─ 无字幕 → 进入语音识别
    ↓
[4] Whisper 语音识别（仅在需要时）
    ├─ 音频提取（ffmpeg）
    ├─ Whisper 模型推理（base/small 可选）
    └─ 生成带时间戳的文本
    ↓
[5] 文本预处理
    ├─ 去除重复内容
    ├─ 标点符号优化
    └─ 分段整理
    ↓
[6] MiniMax 摘要生成
    ├─ 加载用户选择的模板
    ├─ 构建 Prompt（模板 + 视频文本）
    ├─ 调用 MiniMax M2.1 API
    └─ 流式返回摘要内容
    ↓
[7] Markdown 生成与导出
    ├─ 格式化摘要内容
    ├─ 添加元数据（标题、时间、来源）
    ├─ 保存到用户指定目录
    └─ 通知前端完成
```

### 4.2 进度推送机制

**WebSocket 消息格式：**

```json
{
  "task_id": "uuid",
  "status": "processing",
  "stage": "whisper_recognition",
  "progress": 45,
  "message": "正在识别语音...",
  "timestamp": "2026-02-03T10:30:00Z"
}
```

**状态枚举：**
- `queued` - 已加入队列
- `downloading` - 下载中
- `extracting_subtitle` - 提取字幕中
- `recognizing` - 语音识别中
- `summarizing` - 生成摘要中
- `exporting` - 导出中
- `completed` - 完成
- `failed` - 失败

---

## 5. 核心功能实现

### 5.1 视频下载器（插件化设计）

**基类接口：**

```python
from abc import ABC, abstractmethod
from typing import Optional

class BaseDownloader(ABC):
    """视频下载器基类"""

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """判断是否支持该 URL"""
        pass

    @abstractmethod
    async def download(self, url: str, output_path: str) -> str:
        """下载视频，返回本地路径"""
        pass

    @abstractmethod
    def get_video_info(self, url: str) -> dict:
        """获取视频信息（标题、作者等）"""
        pass
```

**小红书实现：**

```python
class XiaohongshuDownloader(BaseDownloader):
    """小红书视频下载器"""

    def can_handle(self, url: str) -> bool:
        return "xiaohongshu.com" in url or "xhslink.com" in url

    async def download(self, url: str, output_path: str) -> str:
        # 参考开源项目实现
        # 1. 解析视频 ID
        # 2. 获取视频真实地址
        # 3. 下载视频文件
        pass

    def get_video_info(self, url: str) -> dict:
        # 获取视频标题、作者等信息
        pass
```

### 5.2 字幕提取

```python
import ffmpeg
from typing import Optional

class SubtitleExtractor:
    """字幕提取器"""

    def extract(self, video_path: str) -> Optional[str]:
        """提取视频内嵌字幕"""
        try:
            # 检测字幕流
            probe = ffmpeg.probe(video_path)
            subtitle_streams = [
                stream for stream in probe['streams']
                if stream['codec_type'] == 'subtitle'
            ]

            if not subtitle_streams:
                return None

            # 提取第一个字幕流
            output_path = video_path.replace('.mp4', '.srt')
            ffmpeg.input(video_path).output(
                output_path,
                map='0:s:0'
            ).run()

            return self._parse_srt(output_path)
        except Exception as e:
            return None

    def _parse_srt(self, srt_path: str) -> str:
        """解析 SRT 文件，提取纯文本"""
        # 读取 SRT 文件，去除时间戳，返回纯文本
        pass
```

### 5.3 Whisper 语音识别

```python
from faster_whisper import WhisperModel

class WhisperService:
    """Whisper 语音识别服务"""

    def __init__(self, model_size: str = "base"):
        self.model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8"
        )

    async def transcribe(
        self,
        audio_path: str,
        language: str = "zh"
    ) -> str:
        """转录音频为文本"""
        segments, info = self.model.transcribe(
            audio_path,
            language=language,
            beam_size=5
        )

        # 合并所有片段
        text = " ".join([segment.text for segment in segments])
        return text

    def extract_audio(self, video_path: str) -> str:
        """从视频提取音频"""
        audio_path = video_path.replace('.mp4', '.wav')
        ffmpeg.input(video_path).output(
            audio_path,
            acodec='pcm_s16le',
            ac=1,
            ar='16k'
        ).run()
        return audio_path
```

### 5.4 MiniMax 摘要生成

```python
import httpx
from typing import AsyncGenerator

class Summarizer:
    """MiniMax 摘要生成器"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.minimax.chat/v1"

    async def summarize(
        self,
        text: str,
        template: str,
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """生成摘要（流式返回）"""
        prompt = self._build_prompt(text, template)

        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/text/chatcompletion_v2",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "abab6.5s-chat",
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "stream": stream
                }
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = json.loads(line[6:])
                        if "choices" in data:
                            yield data["choices"][0]["delta"]["content"]

    def _build_prompt(self, text: str, template: str) -> str:
        """构建提示词"""
        return f"{template}\n\n视频内容：\n{text}"
```

### 5.5 Markdown 生成

```python
from datetime import datetime

class MarkdownGenerator:
    """Markdown 文件生成器"""

    def generate(
        self,
        summary: str,
        metadata: dict,
        output_path: str
    ) -> str:
        """生成 Markdown 文件"""
        content = self._build_markdown(summary, metadata)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return output_path

    def _build_markdown(self, summary: str, metadata: dict) -> str:
        """构建 Markdown 内容"""
        return f"""# {metadata.get('title', '视频摘要')}

## 元数据

- **来源：** {metadata.get('source', 'N/A')}
- **作者：** {metadata.get('author', 'N/A')}
- **处理时间：** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **视频时长：** {metadata.get('duration', 'N/A')}

---

## 内容摘要

{summary}

---

*本摘要由 Video Insight 自动生成*
"""
```

---

## 6. 配置管理

### 6.1 配置文件结构

```yaml
# config.yaml
app:
  name: "Video Insight"
  version: "1.0.0"
  output_dir: "~/Documents/VideoInsight"

whisper:
  model_size: "base"  # tiny, base, small, medium, large
  language: "zh"
  device: "cpu"

minimax:
  api_key: ""  # 从环境变量或用户输入获取
  model: "abab6.5s-chat"
  max_tokens: 4096

templates:
  - name: "学习笔记"
    prompt: "请将以下视频内容整理成学习笔记格式，包含：1. 核心概念 2. 关键要点 3. 实践建议"
  - name: "要点提取"
    prompt: "请提取视频的核心要点，以简洁的列表形式呈现"
  - name: "详细记录"
    prompt: "请详细记录视频内容，保留所有重要信息和细节"
  - name: "问答格式"
    prompt: "请将视频内容整理成问答格式，提取关键问题和答案"
  - name: "思维导图"
    prompt: "请将视频内容整理成思维导图结构，使用 Markdown 格式"

downloader:
  timeout: 300  # 下载超时时间（秒）
  max_retries: 3  # 最大重试次数
```

### 6.2 用户配置存储

**位置：** `~/Library/Application Support/VideoInsight/config.json`

```json
{
  "minimax_api_key": "encrypted_key",
  "output_directory": "~/Documents/VideoInsight",
  "whisper_model": "base",
  "custom_templates": [
    {
      "name": "我的模板",
      "prompt": "自定义提示词..."
    }
  ]
}
```

---

## 7. 错误处理

### 7.1 错误分类

| 错误类型 | 处理策略 |
|---------|---------|
| 网络错误 | 自动重试 3 次，失败后提示用户 |
| 视频格式不支持 | 提示用户转换格式 |
| API 调用失败 | 检查 API Key，提示用户 |
| 内存不足 | 降级使用更小的 Whisper 模型 |
| 磁盘空间不足 | 提示用户清理空间 |

### 7.2 日志系统

```python
import logging
from logging.handlers import RotatingFileHandler

def setup_logger():
    logger = logging.getLogger("video_insight")
    logger.setLevel(logging.INFO)

    # 文件日志
    handler = RotatingFileHandler(
        "logs/app.log",
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    logger.addHandler(handler)

    return logger
```

---

## 8. 性能优化

### 8.1 优化策略

1. **字幕优先：** 优先使用现有字幕，避免不必要的 Whisper 计算
2. **模型缓存：** Whisper 模型加载后常驻内存
3. **异步处理：** 所有 I/O 操作使用异步
4. **流式输出：** MiniMax 摘要使用流式返回，提升体验
5. **资源清理：** 处理完成后及时清理临时文件

### 8.2 性能指标

| 指标 | 目标值 |
|------|--------|
| 应用启动时间 | < 3 秒 |
| Whisper 加载时间 | < 5 秒 |
| 10 分钟视频处理时间 | < 5 分钟 |
| 内存占用 | < 4GB |

---

## 9. 安全性设计

### 9.1 数据安全

- **API Key 加密：** 使用系统 Keychain 存储
- **本地处理：** 视频文件不上传云端
- **临时文件清理：** 处理完成后自动删除临时文件

### 9.2 网络安全

- **HTTPS：** 所有 API 调用使用 HTTPS
- **证书验证：** 验证 SSL 证书
- **超时控制：** 设置合理的超时时间

---

## 10. 测试策略

### 10.1 单元测试

- 每个模块独立测试
- 覆盖率目标：> 80%

### 10.2 集成测试

- 端到端流程测试
- 模拟各种错误场景

### 10.3 性能测试

- 不同视频长度的处理时间
- 内存占用监控
- 并发处理测试

---

## 11. 部署与打包

### 11.1 打包配置

**Electron Builder 配置：**

```json
{
  "appId": "com.videoinsight.app",
  "productName": "Video Insight",
  "directories": {
    "output": "dist"
  },
  "mac": {
    "target": ["dmg", "zip"],
    "category": "public.app-category.productivity",
    "minimumSystemVersion": "12.0"
  },
  "extraResources": [
    {
      "from": "backend/dist",
      "to": "backend"
    },
    {
      "from": "models",
      "to": "models"
    }
  ]
}
```

### 11.2 依赖打包

- **Python 后端：** 使用 PyInstaller 打包成独立可执行文件
- **Whisper 模型：** 首次运行时自动下载
- **FFmpeg：** 内置到应用包中

---

## 12. 未来扩展

### 12.1 架构扩展点

1. **下载器插件：** 轻松添加新平台支持
2. **摘要引擎：** 支持切换不同的 AI 模型
3. **导出格式：** 支持 PDF、HTML 等格式
4. **云端同步：** 支持配置和模板云端同步

### 12.2 技术债务

- 考虑使用 Rust 重写性能关键模块
- 考虑使用 GPU 加速 Whisper
- 考虑添加本地数据库支持历史记录

---

## 附录

### A. 参考资料

- [Electron 官方文档](https://www.electronjs.org/docs)
- [FastAPI 官方文档](https://fastapi.tiangolo.com/)
- [Whisper 项目](https://github.com/openai/whisper)
- [faster-whisper](https://github.com/guillaumekln/faster-whisper)
- [MiniMax API 文档](https://www.minimaxi.com/document)

### B. 开源项目参考

- [小红书下载器](https://github.com/hoanx0601/Xiaohongshu_Douyin_downloader_no_watermark)
- [VideoCaptioner](https://github.com/WEIFENG2333/VideoCaptioner)
