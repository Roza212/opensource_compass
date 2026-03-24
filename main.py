from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import os

from app.git_service import clone_and_count_python_files
from app.graph_builder import build_repo_graph
from app.chunker import chunk_python_file
from app.vector_store import store_chunks_in_supabase, search_code
from app.chat_engine import generate_explanation
from app.diagram_generator import generate_mermaid_chart

app = FastAPI()

class RepoRequest(BaseModel):
    github_url: str

class SearchRequest(BaseModel):
    query: str

class ChatRequest(BaseModel):
    repo_name: str
    question: str

@app.get("/health")
async def health_check():
    return {"status": "System is running"}

@app.post("/ingest")
def ingest_repo(request: RepoRequest):
    try:
        result = clone_and_count_python_files(request.github_url)
        if "error" in result:
            # Include technical details if available
            detail_msg = f"{result['error']} - {result.get('details', '')}" 
            raise HTTPException(status_code=500, detail=detail_msg.strip(" - "))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph/{repo_name}")
def get_repo_graph(repo_name: str):
    try:
        repo_path = os.path.join("temp_repos", repo_name)
        
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository not found. Please ingest it first.")
            
        # Build and return the graph as a JSON-serializable dictionary
        graph_dict = build_repo_graph(repo_path)
        return graph_dict
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/diagram/{repo_name}")
def get_mermaid_diagram(repo_name: str, raw: bool = False):
    from fastapi.responses import PlainTextResponse
    try:
        repo_path = os.path.join("temp_repos", repo_name)
        
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository not found. Please ingest it first.")
            
        graph_dict = build_repo_graph(repo_path)
        mermaid_code = generate_mermaid_chart(graph_dict)
        
        if raw:
            return PlainTextResponse(content=mermaid_code)
            
        return {"mermaid_code": mermaid_code}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embed/{repo_name}")
def embed_repo(repo_name: str):
    try:
        repo_path = os.path.join("temp_repos", repo_name)
        
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository not found. Please ingest it first.")
            
        total_chunks = 0
        
        # Scan the repo for Python files
        for root, _, files in os.walk(repo_path):
            for file in files:
                if file.endswith('.py'):
                    full_path = os.path.join(root, file)
                    
                    # Process the file cleanly via the AST chunker
                    chunks = chunk_python_file(full_path)
                    
                    # Push the chunks to vector DB
                    if chunks:
                        store_chunks_in_supabase(repo_name, chunks)
                        total_chunks += len(chunks)
                        
        return {
            "message": "Successfully embedded repository.",
            "total_chunks_processed": total_chunks
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search")
def search_repository(request: SearchRequest):
    try:
        # Perform semantic pgvector search
        results = search_code(request.query)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
def chat_with_repo(request: ChatRequest):
    try:
        # Launch our LCEL RAG pipeline with custom GPT prompts & context injection
        answer_string = generate_explanation(request.repo_name, request.question)
        return {"answer": answer_string}
    except Exception as e:
        # Elegantly intercept Langchain or Authentication errors directly to Swagger UI
        err_msg = str(e)
        if "AuthenticationError" in err_msg or "api_key" in err_msg.lower() or "401" in err_msg:
            raise HTTPException(status_code=401, detail="Your OPENAI_API_KEY is missing/invalid in the .env file!")
        elif "insufficient_quota" in err_msg.lower() or "429" in err_msg or "resource_exhausted" in err_msg.lower():
            raise HTTPException(status_code=429, detail="Your Gemini API key has hit its quota limit (15 requests per minute on free tier). Please wait a minute or check your billing details.")
        else:
            raise HTTPException(status_code=500, detail=f"Langchain / Database Error: {err_msg}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
