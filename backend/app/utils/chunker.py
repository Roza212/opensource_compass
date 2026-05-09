import os
import tree_sitter
import tree_sitter_python
import tree_sitter_javascript
import tree_sitter_typescript
import tree_sitter_go
import tree_sitter_java
import tree_sitter_rust
import tree_sitter_c
import tree_sitter_cpp
import tree_sitter_ruby

# Map extensions to their respective tree-sitter languages and a friendly name
LANGUAGE_MAP = {
    '.py': ('python', tree_sitter.Language(tree_sitter_python.language())),
    '.js': ('javascript', tree_sitter.Language(tree_sitter_javascript.language())),
    '.jsx': ('javascript', tree_sitter.Language(tree_sitter_javascript.language())),
    '.ts': ('typescript', tree_sitter.Language(tree_sitter_typescript.language_typescript())),
    '.tsx': ('tsx', tree_sitter.Language(tree_sitter_typescript.language_tsx())),
    '.go': ('go', tree_sitter.Language(tree_sitter_go.language())),
    '.java': ('java', tree_sitter.Language(tree_sitter_java.language())),
    '.rs': ('rust', tree_sitter.Language(tree_sitter_rust.language())),
    '.c': ('c', tree_sitter.Language(tree_sitter_c.language())),
    '.h': ('c', tree_sitter.Language(tree_sitter_c.language())),
    '.cpp': ('cpp', tree_sitter.Language(tree_sitter_cpp.language())),
    '.hpp': ('cpp', tree_sitter.Language(tree_sitter_cpp.language())),
    '.rb': ('ruby', tree_sitter.Language(tree_sitter_ruby.language())),
}

# Generic AST node types representing chunks we want to keep together
TARGET_NODE_TYPES = {
    'function_definition', 'class_definition', 'function_declaration', 
    'method_declaration', 'class_declaration', 'method_definition', 
    'arrow_function', 'function_item', 'struct_item', 'impl_item', 
    'class_specifier', 'struct_specifier', 'method', 'class', 
    'func_literal', 'interface_declaration', 'type_declaration'
}

def line_based_fallback_chunker(file_path: str, file_name: str, ext: str) -> list:
    """Fallback chunker for unsupported files, splitting into ~50 line blocks."""
    chunks = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        current_chunk = []
        for line in lines:
            current_chunk.append(line)
            # Break chunk at ~50 lines, preferably on an empty line
            if len(current_chunk) >= 50 and line.strip() == "":
                chunks.append({
                    "file_name": file_name,
                    "chunk_text": "".join(current_chunk),
                    "detected_language": ext.lstrip('.') or "text"
                })
                current_chunk = []
                
        # Append remainder
        if current_chunk and "".join(current_chunk).strip():
            chunks.append({
                "file_name": file_name,
                "chunk_text": "".join(current_chunk),
                "detected_language": ext.lstrip('.') or "text"
            })
    except Exception:
        pass
    return chunks

def chunk_file(file_path: str) -> list:
    """
    Reads a file and extracts its functions/classes as individual text chunks.
    Automatically detects language by extension.
    """
    file_name = os.path.basename(file_path)
    _, ext = os.path.splitext(file_name)
    ext = ext.lower()
    
    # Check if we support tree-sitter AST parsing for this file
    if ext not in LANGUAGE_MAP:
        return line_based_fallback_chunker(file_path, file_name, ext)
        
    lang_name, ts_language = LANGUAGE_MAP[ext]
    parser = tree_sitter.Parser(ts_language)
    chunks = []
    
    try:
        with open(file_path, 'rb') as f:
            source_bytes = f.read()
            
        tree = parser.parse(source_bytes)
        
        def traverse(node):
            if node.type in TARGET_NODE_TYPES:
                # Extract chunk using byte indices
                chunk_bytes = source_bytes[node.start_byte:node.end_byte]
                chunk_text = chunk_bytes.decode('utf-8', errors='replace')
                if chunk_text.strip():
                    chunks.append({
                        "file_name": file_name,
                        "chunk_text": chunk_text,
                        "detected_language": lang_name
                    })
            
            # Continue traversing children
            for child in node.children:
                traverse(child)
                
        traverse(tree.root_node)
        
        # If no targeted nodes were found, return the whole file as one chunk
        if not chunks and source_bytes.strip():
            chunks.append({
                "file_name": file_name,
                "chunk_text": source_bytes.decode('utf-8', errors='replace'),
                "detected_language": lang_name
            })
            
    except Exception:
        # Final fallback
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            if content.strip():
                chunks.append({
                    "file_name": file_name,
                    "chunk_text": content,
                    "detected_language": lang_name
                })
        except Exception:
            pass
            
    return chunks

# Keep old function name for backwards compatibility during refactor
chunk_python_file = chunk_file
