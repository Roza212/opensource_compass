from fastapi import APIRouter, HTTPException
from app.models.schemas import SearchRequest, ChatRequest
from app.utils.errors import sanitize_error
from app.services.vector_store import search_code
from app.services.chat_engine import generate_explanation

router = APIRouter()

@router.post("/search")
def search_repository(request: SearchRequest):
    try:
        results = search_code(request.query)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=sanitize_error(e))

@router.post("/chat")
def chat_with_repo(request: ChatRequest):
    try:
        answer_string = generate_explanation(request.repo_name, request.question)
        return {"answer": answer_string}
    except Exception as e:
        err_msg = str(e)
        if "AuthenticationError" in err_msg or "api_key" in err_msg.lower() or "401" in err_msg:
            raise HTTPException(status_code=401, detail="Your OPENAI_API_KEY is missing/invalid in the .env file!")
        elif "insufficient_quota" in err_msg.lower() or "429" in err_msg or "resource_exhausted" in err_msg.lower():
            raise HTTPException(status_code=429, detail="Your Gemini API key has hit its quota limit (15 requests per minute on free tier). Please wait a minute or check your billing details.")
        else:
            raise HTTPException(status_code=500, detail=f"Langchain / Database Error: {err_msg}")
