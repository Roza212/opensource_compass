import networkx as nx
import os
import json

# Mocking the functions and constants from graph_builder
EXT_TO_LANG = {'.py': 'python'}
MAX_TREE_DEPTH = 8

def get_node_metadata(node_path, repo_path, G):
    return {"loc": 100, "language": "python", "imports": G.out_degree(node_path)}

def graph_to_tree(G, repo_name, repo_path):
    # Mocking internal_nodes check
    internal_nodes = list(G.nodes())
    roots = [n for n in G.nodes() if G.in_degree(n) == 0]
    
    if not roots and internal_nodes:
        roots = internal_nodes[:1]

    stats = {"total_files": len(internal_nodes), "max_depth": 0, "languages": {"py": len(internal_nodes)}}

    def _build_recursive(node_id, visited, depth):
        stats["max_depth"] = max(stats["max_depth"], depth)
        node_data = {
            "id": node_id,
            "name": os.path.basename(node_id),
            "path": node_id,
            "metadata": get_node_metadata(node_id, repo_path, G)
        }
        if node_id in visited:
            node_data["is_cycle_ref"] = True
            return node_data
        if depth >= MAX_TREE_DEPTH:
            return node_data
        new_visited = visited | {node_id}
        children = []
        for successor in G.successors(node_id):
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

# Test 1: Simple Tree
G1 = nx.DiGraph()
G1.add_edges_from([("a.py", "b.py"), ("a.py", "c.py"), ("b.py", "d.py")])
res1 = graph_to_tree(G1, "test_repo", "/fake/path")
print("Simple Tree Result:")
print(json.dumps(res1, indent=2))

# Test 2: Cycle
G2 = nx.DiGraph()
G2.add_edges_from([("a.py", "b.py"), ("b.py", "a.py")])
res2 = graph_to_tree(G2, "cycle_repo", "/fake/path")
print("\nCycle Tree Result:")
print(json.dumps(res2, indent=2))
