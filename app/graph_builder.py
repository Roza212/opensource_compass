import os
import networkx as nx
from app.parser import extract_imports_from_file

def build_repo_graph(repo_path: str) -> dict:
    G = nx.DiGraph()
    
    for root, _, files in os.walk(repo_path):
        for file in files:
            if file.endswith('.py'):
                # Get absolute path for parsing
                full_path = os.path.join(root, file)
                
                # Use the relative path to keep the graph node generic
                relative_filename = os.path.relpath(full_path, repo_path)
                
                # Normalize slashes for cross-platform consistency
                current_file = relative_filename.replace('\\', '/')
                
                # Add the relative filename as a node
                G.add_node(current_file)
                
                # Extract the imports from this file
                imported_modules = extract_imports_from_file(full_path)
                
                # Add directed edges from the file to the modules it imports
                for imported_module in imported_modules:
                    G.add_edge(current_file, imported_module)
                    
    # Return a native Python dictionary that is JSON-serializable
    return nx.node_link_data(G)
