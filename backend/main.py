import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import uvicorn
import math

# Import Routers
from app.api.ingest import router as ingest_router
from app.api.diagram import router as diagram_router
from app.api.chat import router as chat_router
from app.api.analyze import router as analyze_router
from app.core.limiter import limiter

app = FastAPI(title="OpenSource Compass API", version="1.0.0")

# ── Rate Limiter ─────────────────────────────────────────────────────────────
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """
    Returns HTTP 429 with a clean JSON body and a Retry-After header.
    Parses the limit string (e.g. '5 per 1 hour') to calculate seconds remaining.
    """
    limit_str = str(exc.detail) if exc.detail else "1 hour"
    # slowapi formats it as "X per N unit" — extract the unit to compute seconds
    seconds = 3600  # default: 1 hour
    if "minute" in limit_str:
        seconds = 60
    elif "second" in limit_str:
        seconds = 1
    elif "day" in limit_str:
        seconds = 86400

    minutes = math.ceil(seconds / 60)
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "message": f"You've sent too many requests. Please wait {minutes} minute{'s' if minutes != 1 else ''}.",
            "retry_after_seconds": seconds,
        },
        headers={"Retry-After": str(seconds)},
    )

app.add_middleware(SlowAPIMiddleware)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-RateLimit-Remaining", "X-RateLimit-Limit", "Retry-After"],
    expose_headers=["X-RateLimit-Remaining", "X-RateLimit-Limit", "Retry-After"],
)

# ── Base Routes ───────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "Welcome to OpenSource Compass API"}

@app.get("/health")
async def health_check():
    return {"status": "System is running"}

# ── Feature Routers ───────────────────────────────────────────────────────────
app.include_router(ingest_router)
app.include_router(diagram_router)
app.include_router(chat_router)
app.include_router(analyze_router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
