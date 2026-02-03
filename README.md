# Video Insight

一款 macOS 桌面应用，通过 AI 技术将视频内容自动转换为结构化的 Markdown 文本摘要。

## 项目结构

```
video-insight/
├── frontend/          # Electron + React 前端
├── backend/           # Python + FastAPI 后端
├── models/            # Whisper 模型存储
├── logs/              # 日志文件
└── docs/              # 文档
    └── plans/         # 设计文档和计划
```

## 技术栈

- **前端：** Electron + React + TypeScript + Vite + Tailwind CSS
- **后端：** Python + FastAPI + faster-whisper
- **AI 服务：** MiniMax M2.1 API

## 开发状态

🚧 项目正在开发中...

## 文档

- [产品需求文档 (PRD)](docs/plans/2026-02-03-video-insight-prd.md)
- [技术设计文档](docs/plans/2026-02-03-video-insight-technical-design.md)
- [实现计划](docs/plans/2026-02-03-video-insight-implementation-plan.md)

## 快速开始

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

### 后端开发

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

## License

MIT
