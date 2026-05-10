import os
import re
import networkx as nx
from typing import List
from app.utils.chunker import LANGUAGE_MAP, FALLBACK_EXTENSIONS

# File extensions -> language name mapping
EXT_TO_LANG = {
    '.py': 'python', '.js': 'javascript', '.jsx': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript', '.go': 'go',
    '.java': 'java', '.rs': 'rust', '.c': 'c', '.h': 'c',
    '.cpp': 'cpp', '.hpp': 'cpp', '.rb': 'ruby', '.md': 'markdown',
    '.cs': 'c-sharp', '.php': 'php'
}

MAX_TREE_DEPTH = 8
SUPPORTED_EXTENSIONS = set(LANGUAGE_MAP.keys()) | set(FALLBACK_EXTENSIONS.keys())

def extract_imports(source: str, language: str) -> List[str]:
    imports = []
    if language == 'python':
        imports.extend(re.findall(r'^\s*import\s+([\w\.]+)', source, re.MULTILINE))
        imports.extend(re.findall(r'^\s*from\s+([\w\.]+)\s+import', source, re.MULTILINE))
    elif language in ['javascript', 'typescript']:
        # import ... from '...'
        imports.extend(re.findall(r"import\s+.*?\s+from\s+['\"](.*?)['\"]", source))
        # require('...')
        imports.extend(re.findall(r"require\(['\"](.*?)['\"]\)", source))
    elif language == 'go':
        # Single import
        imports.extend(re.findall(r'import\s+["\'](.*?)["\']', source))
        # Multi-import blocks
        multi = re.findall(r'import\s+\((.*?)\)', source, re.DOTALL)
        for block in multi:
            imports.extend(re.findall(r'["\'](.*?)["\']', block))
    elif language == 'rust':
        imports.extend(re.findall(r'^\s*use\s+([\w\:]+)', source, re.MULTILINE))
        imports.extend(re.findall(r'^\s*mod\s+(\w+)', source, re.MULTILINE))
    elif language in ['java', 'c-sharp']:
        imports.extend(re.findall(r'^\s*import\s+([\w\.]+);', source, re.MULTILINE))
        imports.extend(re.findall(r'^\s*using\s+([\w\.]+);', source, re.MULTILINE))
    elif language == 'ruby':
        imports.extend(re.findall(r"require\s+['\"](.*?)['\"]", source))
        imports.extend(re.findall(r"require_relative\s+['\"](.*?)['\"]", source))
    else:
        # Generic regex matching quoted strings that look like relative paths
        imports.extend(re.findall(r"['\"](\.\.?\/.*?)['\"]", source))
    
    return [i.strip() for i in imports if i.strip()]

def build_repo_graph(repo_path: str) -> nx.DiGraph:
    G = nx.DiGraph()
    
    for root, dirs, files in os.walk(repo_path):
        # Skip hidden and vendor dirs
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', 'vendor', '__pycache__', 'dist', 'build']]
        
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                full_path = os.path.join(root, file)
                relative_filename = os.path.relpath(full_path, repo_path)
                current_file = relative_filename.replace('\\', '/')
                
                G.add_node(current_file)
                
                language = EXT_TO_LANG.get(ext, 'text')
                try:
                    with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                        source = f.read()
                        imported_modules = extract_imports(source, language)
                        for imported_module in imported_modules:
                            # Heuristic: try to resolve internal paths
                            # This is a simplification; a full resolver would be language-specific
                            G.add_edge(current_file, imported_module)
                except Exception:
                    continue
                    
    return G

def get_node_metadata(node_path: str, repo_path: str, G: nx.DiGraph) -> dict:
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
    internal_nodes = [n for n in G.nodes() if os.path.isfile(os.path.join(repo_path, n.replace('/', os.sep)))]
    SG = G.subgraph(internal_nodes)
    roots = [n for n in SG.nodes() if SG.in_degree(n) == 0]
    
    if not roots and internal_nodes:
        roots = internal_nodes[:1]

    stats = {
        "total_files": len(internal_nodes),
        "max_depth": 0,
        "languages": {}
    }

    def _build_recursive(node_id: str, visited: set, depth: int) -> dict:
        stats["max_depth"] = max(stats["max_depth"], depth)
        
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

        if node_id in visited or depth >= MAX_TREE_DEPTH:
            if node_id in visited: node_data["is_cycle_ref"] = True
            return node_data

        new_visited = visited | {node_id}
        children = []
        for successor in G.successors(node_id):
            if successor in internal_nodes:
                children.append(_build_recursive(successor, new_visited, depth + 1))
        
        if children:
            node_data["children"] = children
        return node_data

    if len(roots) > 1:
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
