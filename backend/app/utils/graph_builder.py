import os
import networkx as nx
from app.utils.parser import extract_imports_from_file

# File extensions -> language name mapping
EXT_TO_LANG = {
    '.py': 'python', '.js': 'javascript', '.jsx': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript', '.go': 'go',
    '.java': 'java', '.rs': 'rust', '.c': 'c', '.h': 'c',
    '.cpp': 'cpp', '.hpp': 'cpp', '.rb': 'ruby', '.md': 'markdown',
}

MAX_TREE_DEPTH = 8

def build_repo_graph(repo_path: str) -> nx.DiGraph:
    """
    Builds a NetworkX DiGraph from the repository files and their imports.
    Returns the NetworkX object itself for further processing.
    """
    G = nx.DiGraph()
    
    for root, _, files in os.walk(repo_path):
        for file in files:
            if file.endswith('.py'):
                full_path = os.path.join(root, file)
                relative_filename = os.path.relpath(full_path, repo_path)
                current_file = relative_filename.replace('\\', '/')
                
                G.add_node(current_file)
                
                imported_modules = extract_imports_from_file(full_path)
                for imported_module in imported_modules:
                    G.add_edge(current_file, imported_module)
                    
    return G

def get_node_metadata(node_path: str, repo_path: str, G: nx.DiGraph) -> dict:
    """Helper to extract metadata for a node."""
    ext = os.path.splitext(node_path)[1].lower()
    language = EXT_TO_LANG.get(ext, 'unknown')
    loc = 0
    full_path = os.path.join(repo_path, node_path.replace('/', os.sep))
    
    if os.path.isfile(full_path):
        try:
            with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                loc = sum(1 for _ in f)
        except Exception:
            loc = 0
            
    return {
        "loc": loc,
        "language": language,
        "imports": G.out_degree(node_path) if node_path in G else 0
    }

def graph_to_tree(G: nx.DiGraph, repo_name: str, repo_path: str) -> dict:
    """
    Transforms a directed graph into a hierarchical tree structure for D3.
    """
    # 1. Identify root nodes (in-degree 0 among internal files)
    # We only care about nodes that exist as files in the repo
    internal_nodes = [n for n in G.nodes() if os.path.isfile(os.path.join(repo_path, n.replace('/', os.sep)))]
    
    # Create a subgraph of only internal files to find true entry points
    SG = G.subgraph(internal_nodes)
    roots = [n for n in SG.nodes() if SG.in_degree(n) == 0]
    
    if not roots and internal_nodes:
        # If everything is cyclic, just pick the first few nodes as roots
        roots = internal_nodes[:1]

    stats = {
        "total_files": len(internal_nodes),
        "max_depth": 0,
        "languages": {}
    }

    def _build_recursive(node_id: str, visited: set, depth: int) -> dict:
        stats["max_depth"] = max(stats["max_depth"], depth)
        
        # Track languages
        ext = os.path.splitext(node_id)[1].lower().lstrip('.')
        if ext:
            stats["languages"][ext] = stats["languages"].get(ext, 0) + 1

        node_data = {
            "id": node_id,
            "name": os.path.basename(node_id),
            "path": node_id,
            "metadata": get_node_metadata(node_id, repo_path, G),
            "dependents": [p for p in G.predecessors(node_id) if p in internal_nodes]
        }

        # Cycle detection
        if node_id in visited:
            node_data["is_cycle_ref"] = True
            return node_data

        # Depth cap
        if depth >= MAX_TREE_DEPTH:
            return node_data

        new_visited = visited | {node_id}
        children = []
        for successor in G.successors(node_id):
            # Only include internal files as children in the tree
            if successor in internal_nodes:
                children.append(_build_recursive(successor, new_visited, depth + 1))
        
        if children:
            node_data["children"] = children
            
        return node_data

    # Assemble final tree
    if len(roots) > 1:
        # Create virtual root
        tree = {
            "id": repo_name,
            "name": repo_name,
            "path": "",
            "children": [_build_recursive(r, set(), 1) for r in roots],
            "metadata": {"loc": 0, "language": "root", "imports": len(roots)}
        }
        stats["max_depth"] += 1
    elif roots:
        tree = _build_recursive(roots[0], set(), 0)
    else:
        tree = {"name": repo_name, "children": []}

    return {"tree": tree, "stats": stats}
