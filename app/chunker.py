import os
import ast

def chunk_python_file(file_path: str) -> list:
    """
    Reads a Python file and extracts its functions and classes as individual text chunks.
    If the file has no functions/classes or fails to parse, the entire file is returned as a single chunk.
    """
    chunks = []
    file_name = os.path.basename(file_path)
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            source_code = f.read()

        # Parse the source code into an Abstract Syntax Tree
        tree = ast.parse(source_code)
        
        # Iterate through all AST nodes
        for node in ast.walk(tree):
            # Check for standard functions, async functions, and classes
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                # Extract the exact string of the source code for this specific node
                chunk_text = ast.get_source_segment(source_code, node)
                
                if chunk_text:
                    chunks.append({
                        "file_name": file_name,
                        "chunk_text": chunk_text
                    })
                    
        # If the file is a simple script with no classes or functions (or if they are empty)
        if not chunks and source_code.strip():
            chunks.append({
                "file_name": file_name,
                "chunk_text": source_code
            })

    except Exception:
        # If parsing fails (e.g. invalid syntax), return the entire file as one chunk to be safe
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                source_code = f.read()
                
            if source_code.strip():
                chunks.append({
                    "file_name": file_name,
                    "chunk_text": source_code
                })
        except Exception:
            # File is completely unreadable or doesn't exist anymore
            pass
            
    return chunks
