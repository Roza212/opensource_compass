import os
import re
from fastapi import APIRouter, HTTPException
from app.utils.errors import sanitize_error

try:
    from radon.complexity import cc_visit
except ImportError:
    cc_visit = None

router = APIRouter()

SUPPORTED_EXTS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.go', '.java', '.rs', '.c', '.h', '.cpp', '.hpp', '.rb', '.md'}

def calculate_python_complexity(code: str) -> float:
    if not cc_visit:
        return 1.0
    try:
        blocks = cc_visit(code)
        if not blocks:
            return 1.0
        # Average complexity of all blocks (functions, classes, etc.)
        total_cc = sum(block.complexity for block in blocks)
        return total_cc / len(blocks)
    except Exception:
        return 1.0

def calculate_generic_complexity(code: str) -> float:
    # A rough heuristic for cyclomatic complexity in other languages
    keywords = ['if ', 'for ', 'while ', 'case ', 'switch ', 'catch ', '&&', '||', '?']
    count = sum(code.count(k) for k in keywords)
    # Assume every 10 lines of code has a base complexity of 1 + keywords
    lines = code.splitlines()
    loc = max(len(lines), 1)
    # roughly normalize it to look like radon complexity (1-10+)
    return max(1.0, count / (loc / 20.0))

def count_dependencies(code: str, ext: str) -> int:
    lines = code.splitlines()
    count = 0
    for line in lines:
        line = line.strip()
        if ext == '.py' and (line.startswith('import ') or line.startswith('from ')):
            count += 1
        elif ext in {'.js', '.jsx', '.ts', '.tsx'} and ('import ' in line or 'require(' in line):
            count += 1
        elif ext == '.go' and 'import' in line: # rough check, go usually uses blocks
            count += 1
        elif ext == '.java' and line.startswith('import '):
            count += 1
        elif ext == '.rs' and line.startswith('use '):
            count += 1
        elif ext in {'.c', '.cpp', '.h', '.hpp'} and line.startswith('#include'):
            count += 1
        elif ext == '.rb' and (line.startswith('require ') or line.startswith('require_relative ')):
            count += 1
    return count

@router.get("/analyze/{repo_name}")
def analyze_repo(repo_name: str):
    repo_path = os.path.join(".temp_repos", repo_name)
    
    if not os.path.exists(repo_path):
        raise HTTPException(status_code=404, detail="Repository not found. Please ingest it first.")
        
    files_data = []
    all_issues = []
    
    total_health = 0
    file_count = 0
    
    for root, _, files in os.walk(repo_path):
        for file in files:
            _, ext = os.path.splitext(file)
            ext = ext.lower()
            if ext in SUPPORTED_EXTS and ext != '.md': # skip markdown for health metrics
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, repo_path)
                
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        code = f.read()
                        
                    lines = code.splitlines()
                    loc = len(lines)
                    if loc == 0:
                        continue
                        
                    # Comments
                    comment_lines = sum(1 for line in lines if line.strip().startswith(('#', '//', '*', '/*')))
                    comment_ratio = comment_lines / loc
                    
                    # Dependencies
                    dep_count = count_dependencies(code, ext)
                    
                    # Complexity
                    if ext == '.py':
                        complexity = calculate_python_complexity(code)
                    else:
                        complexity = calculate_generic_complexity(code)
                        
                    # Normalization
                    norm_complexity = max(0, min(100, 100 - ((complexity - 2) * 8)))
                    norm_comments = min(100, comment_ratio * 500) # 20% comments = 100 score
                    norm_deps = max(0, min(100, 100 - (dep_count * 4))) # 25 deps = 0 score
                    
                    health = int((norm_complexity * 0.4) + (norm_comments * 0.2) + (norm_deps * 0.4))
                    
                    # Identify issues
                    issues = []
                    if complexity > 10:
                        issues.append("High cyclomatic complexity")
                    if loc > 500:
                        issues.append("File is too long (>500 lines)")
                    if comment_ratio < 0.02 and loc > 50:
                        issues.append("Very few comments")
                    if dep_count > 15:
                        issues.append("Too many dependencies")
                        
                    files_data.append({
                        "path": rel_path.replace("\\", "/"),
                        "loc": loc,
                        "complexity": round(complexity, 1),
                        "health": health,
                        "issues": issues
                    })
                    
                    for issue in issues:
                        all_issues.append(f"{rel_path}: {issue}")
                        
                    total_health += health
                    file_count += 1
                    
                except Exception as e:
                    # Ignore unreadable files
                    pass

    overall_health = int(total_health / file_count) if file_count > 0 else 0
    
    # Get top 5 issues (could rank by severity, but for now just take the first 5 or random)
    top_issues = all_issues[:5] if len(all_issues) > 0 else ["No critical issues found!"]

    return {
        "repo_name": repo_name,
        "overall_health": overall_health,
        "files": sorted(files_data, key=lambda x: x['health']), # Worst health first
        "top_issues": top_issues
    }
