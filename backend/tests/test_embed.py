import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.chunker import chunk_python_file
from app.vector_store import store_chunks_in_supabase, search_code

print("1. Scraping and Chunking 'main.py'...")
chunks = chunk_python_file("main.py")
print(f"✅ Extracted {len(chunks)} functional chunks from main.py!\n")

print("2. Generating AI Embeddings and Storing in Supabase...")
# Note: The very first time sentence-transformers runs, it will download the small 80MB model to your cache.
store_chunks_in_supabase("opensource_compass_backend", chunks)
print("✅ Successfully stored chunks in pgvector!\n")

print("3. Testing Vector Similarity Search...")
search_query = "Where is the health check endpoint?"
print(f"Query: '{search_query}'\n")

# This will call the Supabase RPC function to find the most relevant chunks
results = search_code(search_query, match_count=2)

print("🏆 Top Results:")
if results:
    for idx, result in enumerate(results, 1):
        # The RPC template usually returns a 'similarity' score implicitly
        similarity = result.get("similarity", 0) 
        file_name = result.get("file_name", "Unknown")
        code = result.get("chunk_text", "").strip()
        print(f"\n--- Match {idx} | File: {file_name} | Similarity: {similarity:.2f} ---")
        print(code)
        print("-" * 50)
else:
    print("No results found. Double check your Supabase RPC function definition!")
