from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import asyncio
from typing import Optional
import json

from api.websocket import manager
from core.config_manager import config_manager
from core.pipeline import process_video, pipeline
from downloaders.xiaohongshu import get_video_info, XiaohongshuDownloader
from models.task import TaskCreate, TaskType
from utils.logger import setup_logger

logger = setup_logger()

app = FastAPI(title="Video Insight API", version="1.0.0")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Pydantic Models ============

class ProcessRequest(BaseModel):
    task_id: str
    type: str  # "file" or "url"
    source: str
    template_prompt: str
    title: Optional[str] = None


class VideoInfoRequest(BaseModel):
    url: str


# ============ Routes ============

@app.get("/")
async def root():
    return {"message": "Video Insight API is running", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/config")
async def get_config():
    """获取配置"""
    config = config_manager.get()
    return {
        "templates": [
            {"id": t.id, "name": t.name, "prompt": t.prompt}
            for t in config.templates
        ],
        "output_directory": str(config.get_output_dir()),
    }


@app.post("/config/api-key")
async def set_api_key(request: dict):
    """设置 API Key"""
    api_key = request.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required")

    config_manager.update_minimax_key(api_key)
    return {"success": True}


@app.post("/video/info")
async def get_video_info(request: VideoInfoRequest):
    """获取视频信息"""
    try:
        info = await get_video_info(request.url)
        return {
            "success": True,
            "data": {
                "title": info.title,
                "author": info.author,
                "duration": info.duration,
                "platform": info.platform,
            }
        }
    except Exception as e:
        logger.error(f"Failed to get video info: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/process")
async def process_video_endpoint(request: ProcessRequest):
    """处理视频"""
    # 验证请求
    if not request.template_prompt:
        raise HTTPException(status_code=400, detail="Template prompt is required")

    # 创建任务
    task = TaskCreate(
        id=request.task_id,
        type=TaskType(request.type),
        source=request.source,
        template_prompt=request.template_prompt,
        title=request.title,
    )

    # 异步处理
    async def run_process():
        # 通过 WebSocket 推送初始状态
        await manager.send_message(
            {
                "type": "task_update",
                "task_id": task.id,
                "status": "processing",
                "progress": 0,
                "message": "任务已接受",
            },
            None,
        )

        # 执行处理
        result = await process_video(task)

        # 推送完成状态
        await manager.send_message(
            {
                "type": "task_update",
                "task_id": task.id,
                "status": result["success"] and "completed" or "failed",
                "progress": result["success"] and 100 or 0,
                "message": result.get("error") or "处理完成",
                "output_path": result.get("output_path"),
            },
            None,
        )

    # 启动处理任务（不等待完成）
    asyncio.create_task(run_process())

    return {
        "success": True,
        "task_id": task.id,
        "message": "任务已提交处理",
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    client_info = f"{websocket.client}"

    logger.info(f"WebSocket client connected: {client_info}")

    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received from {client_info}: {data[:200]}")

            try:
                message = json.loads(data)

                # 处理不同类型的消息
                message_type = message.get("type")

                if message_type == "ping":
                    # 心跳响应
                    await manager.send_message({"type": "pong"}, websocket)

                elif message_type == "get_status":
                    # 获取服务状态
                    await manager.send_message(
                        {
                            "type": "status",
                            "whisper_ready": pipeline.is_model_loaded() if hasattr(pipeline, '_model') else False,
                        },
                        websocket,
                    )

                elif message_type == "test_connection":
                    # 测试连接
                    await manager.send_message(
                        {"type": "connection_test", "status": "ok"},
                        websocket,
                    )

                else:
                    # 未知消息类型
                    await manager.send_message(
                        {"type": "error", "message": f"Unknown message type: {message_type}"},
                        websocket,
                    )

            except json.JSONDecodeError:
                await manager.send_message(
                    {"type": "error", "message": "Invalid JSON format"},
                    websocket,
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WebSocket client disconnected: {client_info}")


if __name__ == "__main__":
    logger.info("Starting Video Insight API...")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
        reload=False,  # 生产环境设为 False
    )
