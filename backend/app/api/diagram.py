import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from app.utils.errors import sanitize_error
from app.utils.graph_builder import build_repo_graph
from app.utils.diagram_generator import generate_mermaid_chart

router = APIRouter()

@router.get("/graph/{repo_name}")
def get_repo_graph(repo_name: str):
    try:
        repo_path = os.path.join(".temp_repos", repo_name)
        
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository not found. Please ingest it first.")
            
        graph_dict = build_repo_graph(repo_path)
        return graph_dict
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=sanitize_error(e))

@router.get("/diagram/{repo_name}")
def get_mermaid_diagram(repo_name: str, raw: bool = False):
    try:
        repo_path = os.path.join(".temp_repos", repo_name)
        
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
        raise HTTPException(status_code=500, detail=sanitize_error(e))
