import os
from fastapi import APIRouter, HTTPException
from app.models.schemas import RepoRequest
from app.utils.errors import sanitize_error
from app.services.git_service import clone_and_count_python_files
from app.utils.chunker import chunk_python_file
from app.services.vector_store import store_chunks_in_supabase

router = APIRouter()

@router.post("/ingest")
def ingest_repo(request: RepoRequest):
    try:
        print(f"Attempting to ingest: {request.github_url}")
        result = clone_and_count_python_files(request.github_url)
        if "error" in result:
            detail_msg = f"{result['error']} - {result.get('details', '')}" 
            print(f"❌ Ingest Error: {detail_msg}")
            raise HTTPException(status_code=500, detail=detail_msg.strip(" - "))
        print(f"✅ Ingest Success: {result}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Ingest Exception: {str(e)}")
        raise HTTPException(status_code=500, detail=sanitize_error(e))

@router.post("/embed/{repo_name}")
def embed_repo(repo_name: str):
    try:
        repo_path = os.path.join(".temp_repos", repo_name)
        
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository not found. Please ingest it first.")
            
        total_chunks = 0
        
        # Scan the repo for Python files
        for root, _, files in os.walk(repo_path):
            for file in files:
                if file.endswith('.py'):
                    full_path = os.path.join(root, file)
                    
                    chunks = chunk_python_file(full_path)
                    
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
        raise HTTPException(status_code=500, detail=sanitize_error(e))
