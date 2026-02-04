from pydantic import BaseModel
from typing import Optional
from enum import Enum
from datetime import datetime


class TaskStatus(str, Enum):
    PENDING = "pending"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskType(str, Enum):
    FILE = "file"
    URL = "url"


class Task(BaseModel):
    id: str
    type: TaskType
    source: str  # 文件路径或 URL
    filename: Optional[str] = None
    title: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    progress: int = 0
    message: str = "等待处理"
    created_at: datetime = datetime.now()
    error: Optional[str] = None
    output_path: Optional[str] = None


class TaskCreate(BaseModel):
    id: str
    type: TaskType
    source: str
    template_prompt: str
    title: Optional[str] = None


class VideoInfo(BaseModel):
    title: str
    author: str
    duration: float
    thumbnail: Optional[str] = None
    platform: str


class ProcessingProgress(BaseModel):
    task_id: str
    status: TaskStatus
    progress: int
    message: str
