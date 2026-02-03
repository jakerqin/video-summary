import logging
from logging.handlers import RotatingFileHandler
import os


def setup_logger(name: str = "video_insight") -> logging.Logger:
    """设置日志系统"""
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # 确保日志目录存在
    log_dir = os.path.join(os.path.dirname(__file__), "../../logs")
    os.makedirs(log_dir, exist_ok=True)

    # 文件日志
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, "app.log"),
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
    )
    file_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    file_handler.setFormatter(file_formatter)

    # 控制台日志
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter("%(levelname)s - %(message)s")
    console_handler.setFormatter(console_formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger
