import re

def sanitize_mermaid_id(name: str) -> str:
    """
    Sanitizes a string by replacing invalid Mermaid characters 
    (slashes, dashes, dots, spaces) with underscores.
    """
    return re.sub(r'[^a-zA-Z0-9_]', '_', name)

def generate_mermaid_chart(graph_data: dict) -> str:
    """
    Converts NetworkX node_link_data dictionary into a Mermaid flowchart string.
    """
    mermaid_str = 'graph TD;\n'
    
    # NetworkX node_link_data stores connections in a 'links' list
    for link in graph_data.get('links', []):
        source = str(link.get('source', ''))
        target = str(link.get('target', ''))
        
        if not source or not target:
            continue
            
        # Create safe Node IDs
        source_id = sanitize_mermaid_id(source)
        target_id = sanitize_mermaid_id(target)
        
        # Append connection using NodeID["Display Name"] syntax cleanly
        mermaid_str += f'    {source_id}["{source}"] --> {target_id}["{target}"];\n'
        
    return mermaid_str
