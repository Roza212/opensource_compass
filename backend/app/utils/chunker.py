import os
import importlib
from typing import List, Optional
from tree_sitter import Language, Parser
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LANGUAGE_MAP = {
    ".py":   "tree_sitter_python",
    ".js":   "tree_sitter_javascript",
    ".jsx":  "tree_sitter_javascript",
    ".ts":   "tree_sitter_typescript.language_typescript",
    ".tsx":  "tree_sitter_typescript.language_tsx",
    ".go":   "tree_sitter_go",
    ".rs":   "tree_sitter_rust",
    ".java": "tree_sitter_java",
    ".cpp":  "tree_sitter_cpp",
    ".cc":   "tree_sitter_cpp",
    ".c":    "tree_sitter_c",
    ".rb":   "tree_sitter_ruby",
    ".cs":   "tree_sitter_c_sharp",
    ".php":  "tree_sitter_php",
}

FALLBACK_EXTENSIONS = {
    ".md": "markdown", ".json": "json", ".yaml": "yaml", ".yml": "yaml", 
    ".toml": "toml", ".env": "env", ".sh": "bash", ".bash": "bash", 
    ".txt": "text", ".html": "html", ".css": "css", ".scss": "scss", ".sql": "sql"
}

class UnsupportedLanguageError(Exception):
    pass

def get_language(file_path: str) -> Optional[Language]:
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    if ext in LANGUAGE_MAP:
        module_path = LANGUAGE_MAP[ext]
        try:
            # Handle nested attributes like language_typescript
            if '.' in module_path:
                mod_name, attr_name = module_path.split('.')
                module = importlib.import_module(mod_name)
                # tree-sitter 0.22+ uses single arg constructor
                return Language(getattr(module, attr_name)())
            else:
                module = importlib.import_module(module_path)
                # tree-sitter 0.22+ uses module.language instead of module.language()
                # but many grammars still have language() method
                lang_obj = getattr(module, 'language', None)
                if callable(lang_obj):
                    return Language(lang_obj())
                return Language(module.language())
        except (ImportError, AttributeError, TypeError) as e:
            # Fallback for older tree-sitter or different grammar structures
            try:
                module = importlib.import_module(module_path.split('.')[0])
                return Language(module.language())
            except Exception:
                logger.warning(f"Could not load tree-sitter grammar for {ext}: {e}")
                return None
    
    if ext in FALLBACK_EXTENSIONS:
        return None
    
    raise UnsupportedLanguageError(f"Extension {ext} is not supported.")

def chunk_code(file_path: str, source_code: str) -> List[dict]:
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()
    
    try:
        lang = get_language(file_path)
    except UnsupportedLanguageError:
        logger.warning(f"Skipping unsupported file: {file_path}")
        return []

    # If it's a fallback or lang failed to load, use line-based
    if lang is None:
        lang_name = FALLBACK_EXTENSIONS.get(ext, ext.strip('.'))
        return line_based_chunking(file_path, source_code, lang_name)

    # AST-based chunking
    parser = Parser()
    # tree-sitter 0.22+
    parser.language = lang
    
    try:
        tree = parser.parse(bytes(source_code, "utf8"))
    except Exception as e:
        logger.warning(f"Tree-sitter parse error for {file_path}: {e}. Falling back to line-based.")
        lang_name = ext.strip('.')
        return line_based_chunking(file_path, source_code, lang_name)

    chunks = []
    
    # Language-specific node types
    node_types = {
        'python': ['function_definition', 'class_definition'],
        'javascript': ['function_declaration', 'class_declaration', 'arrow_function', 'export_statement'],
        'typescript': ['function_declaration', 'class_declaration', 'arrow_function', 'export_statement'],
        'go': ['function_declaration', 'method_declaration', 'type_declaration'],
        'rust': ['function_item', 'impl_item', 'struct_item', 'enum_item'],
        'java': ['class_declaration', 'method_declaration', 'interface_declaration'],
        'c-sharp': ['class_declaration', 'method_declaration', 'interface_declaration'],
        'cpp': ['function_definition', 'class_specifier', 'struct_specifier'],
        'c': ['function_definition'],
        'ruby': ['method', 'class', 'module'],
        'php': ['function_definition', 'class_declaration', 'method_declaration']
    }
    
    # In tree-sitter 0.22+, Language doesn't have .name property easily accessible
    # We'll map from the module path
    target_lang = "unknown"
    for e, m in LANGUAGE_MAP.items():
        if e == ext:
            target_lang = m.split('_')[-1].split('.')[0]
            if target_lang == 'c-sharp': target_lang = 'c-sharp' # manual fix if needed
            break
            
    target_types = node_types.get(target_lang, [])
    
    root_node = tree.root_node
    
    def traverse(node):
        if node.type in target_types:
            start_line = node.start_point[0] + 1
            end_line = node.end_point[0] + 1
            content = source_code.splitlines()[node.start_point[0]:node.end_point[0]+1]
            
            chunks.append({
                "content": "\n".join(content),
                "start_line": start_line,
                "end_line": end_line,
                "chunk_type": node.type,
                "language": target_lang,
                "file_path": file_path
            })
        else:
            for child in node.children:
                traverse(child)

    traverse(root_node)
    
    # If no semantic chunks found, fallback to line-based for the whole file
    if not chunks:
        return line_based_chunking(file_path, source_code, target_lang)
        
    return chunks

def line_based_chunking(file_path: str, source_code: str, language: str) -> List[dict]:
    lines = source_code.splitlines()
    chunks = []
    
    # Split by double newlines into blocks, but cap at 60 lines
    blocks = source_code.split('\n\n')
    
    line_idx = 0
    for block in blocks:
        block_lines = block.splitlines()
        if not block_lines: 
            line_idx += 1
            continue
            
        if len(block_lines) > 60:
            for i in range(0, len(block_lines), 60):
                sub_lines = block_lines[i:i+60]
                chunks.append({
                    "content": "\n".join(sub_lines),
                    "start_line": line_idx + 1,
                    "end_line": line_idx + len(sub_lines),
                    "chunk_type": "line_block",
                    "language": language,
                    "file_path": file_path
                })
                line_idx += len(sub_lines)
        else:
            chunks.append({
                "content": block,
                "start_line": line_idx + 1,
                "end_line": line_idx + len(block_lines),
                "chunk_type": "line_block",
                "language": language,
                "file_path": file_path
            })
            line_idx += len(block_lines) + 1

    return chunks
