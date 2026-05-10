import os
import dotenv
import time
import httpx
from typing import Optional, List
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer

# Load environment variables
dotenv.load_dotenv()

# Initialize the Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Lazy-loaded embedding model
_model = None

def get_model():
    global _model
    if _model is None:
        print("Loading SentenceTransformer AI into memory for the first time...")
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model

def safe_execute(query):
    """
    Helper to execute Supabase queries with a retry mechanism for transient 
    HTTP/2 protocol errors (like ConnectionTerminated).
    """
    for i in range(3):
        try:
            return query.execute()
        except (httpx.RemoteProtocolError, httpx.ReadError, httpx.WriteError, httpx.PoolTimeout) as e:
            # Check for protocol termination or timeout
            if i < 2:
                time.sleep(0.5 * (i + 1))
                continue
            raise
    return query.execute()

def get_repo_commit_sha(repo_name: str) -> str:
    try:
        query = supabase.table("repos").select("last_commit_sha").eq("repo_name", repo_name)
        response = safe_execute(query)
        if response.data:
            return response.data[0].get("last_commit_sha")
    except Exception as e:
        print(f"Error fetching repo SHA: {e}")
    return None

def upsert_repo_sha(repo_name: str, sha: str):
    try:
        query = supabase.table("repos").upsert({
            "repo_name": repo_name,
            "last_commit_sha": sha
        })
        safe_execute(query)
    except Exception as e:
        print(f"Error upserting repo SHA: {e}")

def delete_repo_chunks(repo_name: str):
    try:
        query = supabase.table("code_chunks").delete().eq("repo_name", repo_name)
        safe_execute(query)
    except Exception as e:
        print(f"Error deleting repo chunks: {e}")

def store_chunks_in_supabase(repo_name: str, chunks: List[dict]):
    """
    Generate embeddings for extracted AST code chunks and insert them into the database.
    """
    valid_chunks = [c for c in chunks if c.get("content", "").strip()]
    if not valid_chunks:
        return
        
    texts = [c["content"] for c in valid_chunks]
    embeddings = get_model().encode(texts).tolist()
    
    rows_to_insert = []
    for chunk, embedding in zip(valid_chunks, embeddings):
        rows_to_insert.append({
            "repo_name": repo_name,
            "file_name": chunk.get("file_path", ""),
            "chunk_text": chunk["content"],
            "embedding": embedding,
            "language": chunk.get("language", "text")
        })
        
    if rows_to_insert:
        try:
            # Batch insert in chunks of 100 to avoid large payload timeouts
            for i in range(0, len(rows_to_insert), 100):
                batch = rows_to_insert[i:i+100]
                query = supabase.table("code_chunks").insert(batch)
                safe_execute(query)
        except Exception as e:
            print(f"Error inserting chunks: {e}")

def search_code(query: str, match_count: int = 5, repo_name: str = None, language_filter: Optional[str] = None) -> list:
    """
    Search for relevant code snippets using vector similarity search via Supabase RPC.
    Optionally filters by language.
    """
    query_embedding = get_model().encode(query).tolist()
    
    try:
        rpc_params = {
            "query_embedding": query_embedding,
            "match_count": match_count * 5
        }
        query = supabase.rpc("match_code_chunks", rpc_params)
        response = safe_execute(query)
        results = response.data or []
        
        if repo_name:
            results = [r for r in results if r.get("repo_name") == repo_name]
        
        if language_filter:
            results = [r for r in results if r.get("language") == language_filter]
            
        return results[:match_count]
    except Exception as e:
        print(f"RPC search failed: {e}")
    
    if repo_name:
        try:
            query_builder = supabase.table("code_chunks").select("repo_name, file_name, chunk_text, language").eq("repo_name", repo_name)
            if language_filter:
                query_builder = query_builder.eq("language", language_filter)
            
            response = safe_execute(query_builder.limit(match_count))
            return response.data or []
        except Exception as e:
            print(f"Table query failed: {e}")
    
    return []
