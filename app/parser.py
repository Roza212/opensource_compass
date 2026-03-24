import tree_sitter
import tree_sitter_python

# Initialize the Python language parser
PY_LANGUAGE = tree_sitter.Language(tree_sitter_python.language())
parser = tree_sitter.Parser(PY_LANGUAGE)

def extract_imports_from_file(file_path: str) -> list:
    try:
        with open(file_path, 'rb') as f:
            source_code = f.read()
            
        # Parse into an Abstract Syntax Tree (AST)
        tree = parser.parse(source_code)
        imports = set()
        
        def traverse(node):
            if node.type == 'import_statement':
                for child in node.children:
                    if child.type == 'dotted_name':
                        imports.add(child.text.decode('utf-8'))
                    elif child.type == 'aliased_import':
                        # Handle cases like `import foo.bar as baz`
                        name_node = child.child_by_field_name('name')
                        if name_node:
                            imports.add(name_node.text.decode('utf-8'))
            elif node.type == 'import_from_statement':
                # Handle cases like `from foo import bar`
                module_node = node.child_by_field_name('module_name')
                if module_node:
                    imports.add(module_node.text.decode('utf-8'))
            
            for child in node.children:
                traverse(child)

        # Traverse the tree from the root node
        traverse(tree.root_node)
        
        # Return cleanly formatted list
        return sorted(list(imports))
    except Exception:
        # Handle unreadable files or parse errors gracefully
        return []
