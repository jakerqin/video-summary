import asyncio
import json
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Optional

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.websocket import manager
from core.config_manager import config_manager
from core.pipeline import process_video
from downloaders.xiaohongshu import get_video_info as fetch_video_info
from models.task import TaskCreate, TaskType
from processors.markdown_generator import markdown_generator
from processors.summarizer import summarizer
from processors.whisper_service import whisper_service
from utils.logger import setup_logger

logger = setup_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理。"""
    logger.info("Preloading Whisper model...")
    try:
        whisper_service.load_model()
        logger.info("Whisper model preloaded successfully")
    except Exception as e:
        logger.warning("Failed to preload Whisper model: %s", e)

    yield

    logger.info("Shutting down...")


app = FastAPI(title="Video Insight API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    task_id: str
    type: str
    source: str
    template_prompt: str
    title: Optional[str] = None


class VideoInfoRequest(BaseModel):
    url: str


class ExportMarkdownRequest(BaseModel):
    task_id: str
    type: str
    source: str
    summary: str
    title: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class StreamSummaryRequest(BaseModel):
    transcript: str
    template_prompt: str


async def _build_markdown_metadata(task_type: TaskType, source: str, title: Optional[str]) -> Dict[str, str]:
    """构建 Markdown 导出元数据。"""
    metadata: Dict[str, str] = {
        "title": title or "视频摘要",
        "source": source,
        "author": "",
        "platform": "",
    }

    if task_type != TaskType.URL:
        return metadata

    try:
        info = await fetch_video_info(source)
        metadata["title"] = title or info.title or metadata["title"]
        metadata["author"] = info.author or ""
        metadata["platform"] = info.platform or ""
    except Exception as e:
        logger.warning("Failed to fetch URL metadata for markdown export: %s", e)

    return metadata


async def _run_transcription_task(task: TaskCreate) -> None:
    """运行后端转录任务，并将转录结果交给前端继续摘要。"""
    await manager.broadcast(
        {
            "type": "task_update",
            "taskId": task.id,
            "task_id": task.id,
            "status": "processing",
            "progress": 0,
            "message": "任务已接受，开始转录",
        }
    )

    result = await process_video(task)
    if not result.get("success"):
        await manager.broadcast(
            {
                "type": "task_update",
                "taskId": task.id,
                "task_id": task.id,
                "status": "failed",
                "progress": 0,
                "message": result.get("error") or "处理失败",
            }
        )
        return

    await manager.broadcast(
        {
            "type": "task_update",
            "taskId": task.id,
            "task_id": task.id,
            "status": "processing",
            "progress": 60,
            "message": "转录完成，前端开始流式摘要",
        }
    )

    await manager.broadcast(
        {
            "type": "transcript_ready",
            "taskId": task.id,
            "task_id": task.id,
            "status": "processing",
            "progress": 60,
            "message": "转录完成，等待前端调用 MiniMax",
            "transcript": result.get("transcript", ""),
            "templatePrompt": task.template_prompt,
            "source": result.get("source", task.source),
            "title": result.get("title", task.title),
            "taskType": result.get("task_type", task.type.value),
            "transcriptLength": result.get("transcript_length", 0),
        }
    )


@app.get("/")
async def root():
    return {"message": "Video Insight API is running", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/config")
async def get_config():
    """获取配置。"""
    config = config_manager.get()
    return {
        "templates": [
            {"id": t.id, "name": t.name, "prompt": t.prompt}
            for t in config.templates
        ],
        "output_directory": str(config_manager.get_output_dir()),
    }


@app.post("/config/api-key")
async def set_api_key(request: dict):
    """设置 API Key。"""
    api_key = request.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required")

    config_manager.update_minimax_key(api_key)
    return {"success": True}


@app.post("/video/info")
async def get_video_info_endpoint(request: VideoInfoRequest):
    """获取视频信息。"""
    try:
        info = await fetch_video_info(request.url)
        return {
            "success": True,
            "data": {
                "title": info.title,
                "author": info.author,
                "duration": info.duration,
                "platform": info.platform,
            },
        }
    except Exception as e:
        logger.error("Failed to get video info: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传视频文件。"""
    try:
        upload_dir = Path("./data/uploads")
        upload_dir.mkdir(parents=True, exist_ok=True)

        file_path = upload_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        logger.info("File uploaded: %s", file_path)
        return {"path": str(file_path)}
    except Exception as e:
        logger.error("Failed to upload file: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/process")
async def process_video_endpoint(request: ProcessRequest):
    """提交后端转录任务。"""
    if not request.template_prompt:
        raise HTTPException(status_code=400, detail="Template prompt is required")

    try:
        task_type = TaskType(request.type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Unsupported task type: {request.type}") from e

    task = TaskCreate(
        id=request.task_id,
        type=task_type,
        source=request.source,
        template_prompt=request.template_prompt,
        title=request.title,
    )

    asyncio.create_task(_run_transcription_task(task))

    return {
        "success": True,
        "task_id": task.id,
        "message": "任务已提交，开始转录处理",
    }


@app.post("/summarize/stream")
async def stream_summary(request: StreamSummaryRequest):
    """流式生成摘要（通过后端代理避免 CORS）"""
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is required")

    if not request.template_prompt.strip():
        raise HTTPException(status_code=400, detail="Template prompt is required")

    async def generate_sse():
        """生成 SSE 格式的流式响应"""
        try:
            async for chunk in summarizer.summarize(
                text=request.transcript,
                template_prompt=request.template_prompt,
                stream=True
            ):
                # SSE 格式：data: {json}\n\n
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"

            # 发送完成信号
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            logger.error("Stream summary failed: %s", e)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/markdown/export")
async def export_markdown(request: ExportMarkdownRequest):
    """将前端摘要结果导出为 Markdown 文件。"""
    summary = request.summary.strip()
    if not summary:
        raise HTTPException(status_code=400, detail="Summary is required")

    try:
        task_type = TaskType(request.type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Unsupported task type: {request.type}") from e

    metadata = dict(request.metadata or {})
    if not metadata:
        metadata = await _build_markdown_metadata(task_type, request.source, request.title)
    else:
        metadata.setdefault("title", request.title or "视频摘要")
        metadata.setdefault("source", request.source)
        metadata.setdefault("author", "")
        metadata.setdefault("platform", "")

    try:
        output_path = markdown_generator.generate(
            summary=summary,
            metadata=metadata,
            output_path=str(config_manager.get_output_dir()),
        )
    except Exception as e:
        logger.error("Failed to export markdown: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

    await manager.broadcast(
        {
            "type": "task_update",
            "taskId": request.task_id,
            "task_id": request.task_id,
            "status": "completed",
            "progress": 100,
            "message": "处理完成",
            "outputPath": output_path,
            "output_path": output_path,
        }
    )

    return {
        "success": True,
        "task_id": request.task_id,
        "output_path": output_path,
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    client_info = f"{websocket.client}"

    logger.info("WebSocket client connected: %s", client_info)

    try:
        while True:
            data = await websocket.receive_text()
            logger.info("Received from %s: %s", client_info, data[:200])

            try:
                message = json.loads(data)
                message_type = message.get("type")

                if message_type == "ping":
                    await manager.send_message({"type": "pong"}, websocket)

                elif message_type == "get_status":
                    await manager.send_message(
                        {
                            "type": "status",
                            "whisper_ready": whisper_service.is_model_loaded(),
                        },
                        websocket,
                    )

                elif message_type == "test_connection":
                    await manager.send_message(
                        {"type": "connection_test", "status": "ok"},
                        websocket,
                    )

                elif message_type == "start_processing":
                    tasks = message.get("tasks", [])
                    logger.info("Received start_processing request with %s tasks", len(tasks))

                    for task_data in tasks:
                        try:
                            task = TaskCreate(
                                id=task_data.get("id"),
                                type=TaskType(task_data.get("type")),
                                source=task_data.get("source"),
                                template_prompt=task_data.get("templatePrompt", ""),
                                title=task_data.get("title"),
                            )
                        except Exception as e:
                            logger.error("Invalid task payload: %s", e)
                            await manager.broadcast(
                                {
                                    "type": "task_update",
                                    "taskId": task_data.get("id"),
                                    "task_id": task_data.get("id"),
                                    "status": "failed",
                                    "progress": 0,
                                    "message": f"任务参数错误: {e}",
                                }
                            )
                            continue

                        asyncio.create_task(_run_transcription_task(task))

                    await manager.send_message(
                        {"type": "processing_started", "count": len(tasks)},
                        websocket,
                    )

                else:
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
        logger.info("WebSocket client disconnected: %s", client_info)


if __name__ == "__main__":
    logger.info("Starting Video Insight API...")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=9000,
        log_level="info",
        reload=False,
    )
