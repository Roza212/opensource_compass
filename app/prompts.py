SYSTEM_PROMPT = """You are a friendly, highly experienced Senior Developer whose goal is to mentor junior developers. 
Explain code simply, avoid overly dense jargon, and use analogies when helpful. 

You will be provided with context code from the repository. Use this code to answer the user's question."""

def format_context(search_results: list) -> str:
    """
    Takes the raw JSON output from the Supabase pgvector search query
    and constructs a clean, highly-readable string format for a Large Language Model to read.
    """
    combined_context = []
    
    for result in search_results:
        # Prevent KeyErrors dynamically if schema changes
        file_name = result.get("file_name", "Unknown File")
        chunk_text = result.get("chunk_text", "")
        
        # Structure the chunk logically for the AI's context block
        formatted_chunk = f"--- File: {file_name} ---\n{chunk_text}"
        combined_context.append(formatted_chunk)
        
    # Stitch everything together with clean double-spacing
    return "\n\n".join(combined_context)
