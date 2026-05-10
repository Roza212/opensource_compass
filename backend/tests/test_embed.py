import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.utils.chunker import chunk_code
from app.services.vector_store import store_chunks_in_supabase, search_code

# main.py is in backend/
try:
    with open("backend/main.py", "r") as f:
        content = f.read()
except FileNotFoundError:
    # If run from backend/ dir
    with open("main.py", "r") as f:
        content = f.read()
chunks = chunk_code(content, "main.py")
print(f"✅ Extracted {len(chunks)} functional chunks from main.py!\n")

print("2. Generating AI Embeddings and Storing in Supabase...")
store_chunks_in_supabase("opensource_compass_backend", chunks)
print("✅ Successfully stored chunks in pgvector!\n")

print("3. Testing Vector Similarity Search...")
search_query = "Where is the health check endpoint?"
print(f"Query: '{search_query}'\n")

results = search_code(search_query, match_count=2)

print("🏆 Top Results:")
if results:
    for idx, result in enumerate(results, 1):
        similarity = result.get("similarity", 0) 
        file_name = result.get("file_name", "Unknown")
        code = result.get("chunk_text", "").strip()
        print(f"\n--- Match {idx} | File: {file_name} | Similarity: {similarity:.4f} ---")
        print(code[:200] + "...") # print snippet
        print("-" * 50)
else:
    print("No results found.")
