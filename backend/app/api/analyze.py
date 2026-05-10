import os
import re
import ast
import statistics
import datetime
import networkx as nx
from fastapi import APIRouter, HTTPException
from app.utils.errors import sanitize_error
from app.utils.chunker import LANGUAGE_MAP, FALLBACK_EXTENSIONS
from app.services.vector_store import get_repo_commit_sha, supabase, safe_execute
from app.utils.graph_builder import build_repo_graph

try:
    from radon.complexity import cc_visit
except ImportError:
    cc_visit = None

router = APIRouter()

from app.core.config import TEMP_REPO_DIR

SUPPORTED_EXTS = set(LANGUAGE_MAP.keys()) | set(FALLBACK_EXTENSIONS.keys())

def get_python_metrics(source: str):
    issues = []
    scores = {"complexity": 100, "size": 100, "docs": 100}
    
    # 1. Complexity
    avg_cc = 1.0
    if cc_visit:
        try:
            blocks = cc_visit(source)
            if blocks:
                avg_cc = sum(b.complexity for b in blocks) / len(blocks)
                for b in blocks:
                    if b.complexity > 10:
                        issues.append(f"High complexity in {b.name}() — consider splitting")
        except Exception:
            pass
    # Score: <5 = 100, >20 = 0
    scores["complexity"] = int(max(0, min(100, 100 - (avg_cc - 5) * (100 / 15))))

    # 2. Size & Docs via AST
    try:
        tree = ast.parse(source)
        # Non-blank non-comment lines (approx via source lines)
        lines = [l for l in source.splitlines() if l.strip() and not l.strip().startswith('#')]
        loc = len(lines)
        scores["size"] = int(max(0, min(100, 100 - (loc - 100) * (100 / 500))))

        # Function length check
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                start = node.lineno
                end = getattr(node, 'end_lineno', start + 5)
                f_len = end - start
                if f_len > 80:
                    issues.append(f"Function {node.name}() is {f_len} lines — consider splitting")

        # Docs
        func_count = 0
        doc_count = 0
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                func_count += 1
                if ast.get_docstring(node):
                    doc_count += 1
        
        doc_score = (doc_count / func_count * 100) if func_count > 0 else 100
        scores["docs"] = int(doc_score)
        if doc_score < 30:
            issues.append("Less than 30% of public functions are documented")
            
    except Exception:
        # Fallback if AST fails
        lines = [l for l in source.splitlines() if l.strip()]
        loc = len(lines)
        scores["size"] = int(max(0, min(100, 100 - (loc - 100) * (100 / 500))))

    return scores, issues, loc

def get_generic_metrics(source: str, ext: str):
    issues = []
    scores = {"complexity": 100, "size": 100, "docs": 100}
    
    lines = source.splitlines()
    # LOC = non-blank, non-comment
    if ext in ['.js', '.ts', '.jsx', '.tsx', '.go', '.java', '.cs', '.cpp', '.h', '.php']:
        clean_lines = [l for l in lines if l.strip() and not l.strip().startswith(('/', '*', '#'))]
    else:
        clean_lines = [l for l in lines if l.strip()]
    
    loc = len(clean_lines)
    
    # 1. Complexity (keyword density)
    keywords = ['if ', 'else ', 'for ', 'while ', 'case ', 'switch ', 'catch ', '&&', '||']
    count = sum(source.count(k) for k in keywords)
    density = count / max(loc, 1)
    # <0.05 = 100, >0.25 = 0
    scores["complexity"] = int(max(0, min(100, 100 - (density - 0.05) * (100 / 0.20))))
    
    # 2. Size
    scores["size"] = int(max(0, min(100, 100 - (loc - 100) * (100 / 500))))
    
    # 3. Docs
    if ext in ['.js', '.ts', '.jsx', '.tsx']:
        # JSDoc check
        func_matches = re.findall(r'(function\s+\w+|class\s+\w+|\w+\s*=\s*\(.*?\)\s*=>)', source)
        jsdoc_matches = re.findall(r'/\*\*[\s\S]*?\*/\s*(?:function|class|const|let|var)', source)
        doc_score = (len(jsdoc_matches) / len(func_matches) * 100) if func_matches else 100
        scores["docs"] = int(min(100, doc_score))
    else:
        # Comment ratio
        comment_lines = len(lines) - loc
        doc_score = (comment_lines / max(loc, 1)) * 300
        scores["docs"] = int(min(100, doc_score))
        
    if scores["docs"] < 30:
        issues.append("Less than 30% of public functions are documented")
        
    return scores, issues, loc

@router.get("/analyze/{repo_name}")
def analyze_repo(repo_name: str):
    try:
        repo_path = os.path.join(TEMP_REPO_DIR, repo_name)
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository not found. Please ingest it first.")

        # Step 3: Caching (Graceful fallback if table doesn't exist)
        commit_sha = get_repo_commit_sha(repo_name)
        if commit_sha:
            try:
                cache_query = supabase.table("analysis_cache").select("result").eq("repo_name", repo_name).eq("commit_sha", commit_sha)
                cache_res = safe_execute(cache_query)
                if cache_res.data:
                    res = cache_res.data[0]["result"]
                    res["cached"] = True
                    return res
            except Exception as e:
                print(f"Cache miss/error (likely missing table): {e}")

        # Step 1: Analysis
        G = build_repo_graph(repo_path)
        is_in_cycle = set()
        try:
            cycles = list(nx.simple_cycles(G))
            for cycle in cycles:
                is_in_cycle.update(cycle)
        except Exception:
            pass

        files_data = []
        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', 'vendor', 'dist', 'build']]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in SUPPORTED_EXTS and ext != '.md':
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, repo_path).replace('\\', '/')
                    
                    try:
                        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                            source = f.read()
                        
                        if ext == '.py':
                            scores, issues, loc = get_python_metrics(source)
                        else:
                            scores, issues, loc = get_generic_metrics(source, ext)
                        
                        # Coupling Score
                        ca = G.in_degree(rel_path) if rel_path in G else 0
                        ce = G.out_degree(rel_path) if rel_path in G else 0
                        # 100 if Ca <= 8 and Ce <= 6. 0 at Ca > 20 or Ce > 15.
                        ca_score = 100 - max(0, (ca - 8) * (100 / 12))
                        ce_score = 100 - max(0, (ce - 6) * (100 / 9))
                        scores["coupling"] = int(max(0, min(ca_score, ce_score)))
                        
                        if ca > 15:
                            issues.append(f"Critical dependency — {ca} files depend on this")
                        if rel_path in is_in_cycle:
                            issues.append("Circular dependency detected")
                        
                        files_data.append({
                            "path": rel_path,
                            "language": ext.lstrip('.'),
                            "loc": loc,
                            "scores": scores,
                            "issues": issues
                        })
                    except Exception:
                        continue

        if not files_data:
            return {"repo_name": repo_name, "files": [], "summary": {}}

        # Step 2: Summary & Risks
        dimensions = ["complexity", "coupling", "size", "docs"]
        summary = {d: int(statistics.median([f["scores"][d] for f in files_data])) for d in dimensions}
        
        # Top Risks: top 5 files by worst individual dimension score
        risk_pool = []
        for f in files_data:
            worst_dim = min(dimensions, key=lambda d: f["scores"][d])
            worst_score = f["scores"][worst_dim]
            # Create a reason string based on worst dimension
            reason = f["issues"][0] if f["issues"] else f"Low {worst_dim} score ({worst_score})"
            risk_pool.append({
                "path": f["path"],
                "reason": reason,
                "dimension": worst_dim,
                "score": worst_score
            })
        
        top_risks = sorted(risk_pool, key=lambda x: x["score"])[:5]
        # Remove score from top_risks output to match user request
        for r in top_risks: del r["score"]

        result = {
            "repo_name": repo_name,
            "summary": summary,
            "top_risks": top_risks,
            "cached": False,
            "analyzed_at": datetime.datetime.now().isoformat(),
            "files": files_data
        }

        # Cache the result (Graceful if table doesn't exist)
        if commit_sha:
            try:
                upsert_query = supabase.table("analysis_cache").upsert({
                    "repo_name": repo_name,
                    "commit_sha": commit_sha,
                    "result": result
                })
                safe_execute(upsert_query)
            except Exception as e:
                print(f"Could not save to cache: {e}")

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=sanitize_error(e))
