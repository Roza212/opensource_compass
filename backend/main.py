from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Import Routers
from app.api.ingest import router as ingest_router
from app.api.diagram import router as diagram_router
from app.api.chat import router as chat_router

app = FastAPI(title="OpenSource Compass API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to OpenSource Compass API"}

@app.get("/health")
async def health_check():
    return {"status": "System is running"}

# Include Routers
app.include_router(ingest_router)
app.include_router(diagram_router)
app.include_router(chat_router)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
