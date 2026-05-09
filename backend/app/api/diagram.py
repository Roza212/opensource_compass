import os
import networkx as nx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from app.utils.errors import sanitize_error
from app.utils.graph_builder import build_repo_graph, graph_to_tree
from app.utils.diagram_generator import generate_mermaid_chart
from app.core.limiter import limiter

router = APIRouter()

@router.get("/graph/{repo_name}")
@limiter.limit("200/hour")
def get_repo_graph(request: Request, repo_name: str):
    """Returns the raw NetworkX node-link data for the repository."""
    try:
        repo_path = os.path.join(".temp_repos", repo_name)
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository not found. Please ingest it first.")
            
        G = build_repo_graph(repo_path)
        return nx.node_link_data(G)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=sanitize_error(e))

@router.get("/diagram/{repo_name}")
@limiter.limit("200/hour")
def get_mermaid_diagram(request: Request, repo_name: str, raw: bool = False):
    """Returns a Mermaid.js syntax string for the repository diagram."""
    try:
        repo_path = os.path.join(".temp_repos", repo_name)
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository not found. Please ingest it first.")
            
        G = build_repo_graph(repo_path)
        graph_dict = nx.node_link_data(G)
        mermaid_code = generate_mermaid_chart(graph_dict)
        
        if raw:
            return PlainTextResponse(content=mermaid_code)
            
        return {"mermaid_code": mermaid_code}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=sanitize_error(e))

@router.get("/tree")
@limiter.limit("100/hour")
def get_repo_tree(request: Request, repo_name: str):
    """
    Returns a hierarchical JSON structure of the repository's internal 
    import graph, suitable for D3.js collapsible trees.
    """
    try:
        repo_path = os.path.join(".temp_repos", repo_name)
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository not found. Please ingest it first.")
            
        G = build_repo_graph(repo_path)
        tree_data = graph_to_tree(G, repo_name, repo_path)
        return tree_data
    except HTTPException:
        raise
    except Exception as e:
        # Rate limit messages are already friendly, but for other errors we use sanitize_error
        detail = sanitize_error(e)
        raise HTTPException(status_code=500, detail=detail)
