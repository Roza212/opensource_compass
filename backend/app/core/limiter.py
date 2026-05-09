"""
Central rate limiter configuration.
Uses Redis as the storage backend so limits are shared across
all Uvicorn workers and survive server restarts.
Falls back to in-memory storage if Redis is unavailable.
"""
import os
import math
from slowapi import Limiter
from slowapi.util import get_remote_address

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Storage URI: slowapi/limits uses "redis://" scheme directly
try:
    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri=REDIS_URL,
        default_limits=[],           # No blanket default — apply per-route
    )
except Exception:
    # Fallback: in-memory (per-process) if Redis is unreachable
    limiter = Limiter(key_func=get_remote_address, default_limits=[])


def retry_after_seconds(limit_string: str) -> int:
    """
    Given a slowapi limit string like '5/hour', return how many
    seconds until the window resets so the 429 body is informative.
    """
    parts = limit_string.lower().split("/")
    if len(parts) != 2:
        return 60
    unit = parts[1].strip()
    mapping = {"second": 1, "minute": 60, "hour": 3600, "day": 86400}
    return mapping.get(unit, 60)
