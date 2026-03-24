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

# Initialize the embedding model globally
model = SentenceTransformer('all-MiniLM-L6-v2')

def store_chunks_in_supabase(repo_name: str, chunks: list):
    """
    Generate embeddings for extracted AST code chunks and insert them into the database.
    """
    for chunk in chunks:
        file_name = chunk.get("file_name", "")
        chunk_text = chunk.get("chunk_text", "")
        
        if chunk_text.strip():
            # Generate the vector embedding
            embedding = model.encode(chunk_text).tolist()
            
            # Insert into Supabase 'code_chunks' table
            supabase.table("code_chunks").insert({
                "repo_name": repo_name,
                "file_name": file_name,
                "chunk_text": chunk_text,
                "embedding": embedding
            }).execute()

def search_code(query: str, match_count: int = 3) -> list:
    """
    Search for relevant code snippets using vector similarity search via Supabase RPC.
    """
    # Embed the natural language search query
    query_embedding = model.encode(query).tolist()
    
    # Call the Remote Procedure Call (RPC) pgvector function in Supabase
    response = supabase.rpc("match_code_chunks", {
        "query_embedding": query_embedding,
        "match_count": match_count
    }).execute()
    
    return response.data
