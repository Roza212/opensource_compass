import os
import dotenv
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
        print("⚡ Loading SentenceTransformer AI into memory for the first time...")
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model

def store_chunks_in_supabase(repo_name: str, chunks: list):
    """
    Generate embeddings for extracted AST code chunks and insert them into the database.
    """
    valid_chunks = [c for c in chunks if c.get("chunk_text", "").strip()]
    if not valid_chunks:
        return
        
    # Batch encode ALL chunks for this file at once (Massive CPU speedup)
    texts = [c["chunk_text"] for c in valid_chunks]
    embeddings = get_model().encode(texts).tolist()
    
    rows_to_insert = []
    for chunk, embedding in zip(valid_chunks, embeddings):
        rows_to_insert.append({
            "repo_name": repo_name,
            "file_name": chunk.get("file_name", ""),
            "chunk_text": chunk["chunk_text"],
            "embedding": embedding
        })
        
    # Batch insert into Supabase (Massive Network speedup)
    if rows_to_insert:
        supabase.table("code_chunks").insert(rows_to_insert).execute()

def search_code(query: str, match_count: int = 5, repo_name: str = None) -> list:
    """
    Search for relevant code snippets using vector similarity search via Supabase RPC.
    If repo_name is provided, tries RPC filtering first, then falls back to table query.
    """
    query_embedding = get_model().encode(query).tolist()
    
    # Strategy 1: Try RPC search (fast pgvector similarity)
    try:
        rpc_params = {
            "query_embedding": query_embedding,
            "match_count": match_count * 3  # fetch extra for filtering
        }
        response = supabase.rpc("match_code_chunks", rpc_params).execute()
        results = response.data or []
        
        if repo_name and results:
            # Check if results have repo_name field for filtering
            if "repo_name" in results[0]:
                filtered = [r for r in results if r.get("repo_name") == repo_name]
                if filtered:
                    return filtered[:match_count]
            # RPC can't filter by repo — fall through to Strategy 2
        elif results:
            return results[:match_count]
    except Exception as e:
        print(f"⚠️ RPC search failed: {e}")
    
    # Strategy 2: Direct table query filtered by repo_name
    if repo_name:
        try:
            response = (
                supabase.table("code_chunks")
                .select("repo_name, file_name, chunk_text")
                .eq("repo_name", repo_name)
                .limit(match_count)
                .execute()
            )
            return response.data or []
        except Exception as e:
            print(f"⚠️ Table query failed: {e}")
    
    return []
