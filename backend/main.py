from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from api.websocket import manager
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


@app.get("/")
async def root():
    return {"message": "Video Insight API is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    logger.info("WebSocket client connected")
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received: {data}")
            # Echo back for now
            await manager.send_message({"type": "echo", "data": data}, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket client disconnected")


if __name__ == "__main__":
    logger.info("Starting Video Insight API...")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
