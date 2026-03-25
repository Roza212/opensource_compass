import re
import os

def sanitize_mermaid_id(name: str) -> str:
    """
    Sanitizes a string by replacing invalid Mermaid characters 
    (slashes, dashes, dots, spaces) with underscores.
    """
    return re.sub(r'[^a-zA-Z0-9_]', '_', name)

def shorten_label(path: str) -> str:
    """
    Converts a full file path into a short, readable label.
    e.g., 'backend/app/chat_engine.py' -> 'chat_engine.py'
    e.g., 'app.vector_store' -> 'vector_store'
    """
    # Get just the filename for file paths
    basename = os.path.basename(path)
    if basename:
        return basename
    # For module-style imports like 'app.vector_store', take the last part
    return path.split('.')[-1] if '.' in path else path

def generate_mermaid_chart(graph_data: dict) -> str:
    """
    Converts NetworkX node_link_data dictionary into a Mermaid flowchart string.
    Uses LR (left-to-right) layout and short labels for readability.
    """
    mermaid_str = 'graph LR;\n'
    
    # Track unique connections to avoid duplicates
    seen = set()
    
    # NetworkX node_link_data stores connections in a 'links' list
    for link in graph_data.get('links', []):
        source = str(link.get('source', ''))
        target = str(link.get('target', ''))
        
        if not source or not target:
            continue
        
        # Create safe Node IDs (must be unique per full path)
        source_id = sanitize_mermaid_id(source)
        target_id = sanitize_mermaid_id(target)
        
        # Skip self-references and duplicates
        connection_key = f"{source_id}->{target_id}"
        if source_id == target_id or connection_key in seen:
            continue
        seen.add(connection_key)
        
        # Use short labels for display
        source_label = shorten_label(source)
        target_label = shorten_label(target)
        
        # Append connection using NodeID["Display Name"] syntax
        mermaid_str += f'    {source_id}["{source_label}"] --> {target_id}["{target_label}"];\n'
        
    return mermaid_str
