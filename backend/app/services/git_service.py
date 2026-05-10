import os
import stat
import shutil
import logging
import time
import uuid
from git import Repo, exc
from app.utils.chunker import LANGUAGE_MAP, FALLBACK_EXTENSIONS
from app.core.config import TEMP_REPO_DIR

logger = logging.getLogger(__name__)

SUPPORTED_EXTS = set(LANGUAGE_MAP.keys()) | set(FALLBACK_EXTENSIONS.keys())

def on_rm_error(func, path, exc_info):
    """
    Error handler for shutil.rmtree to force Windows read-only .git files to correctly delete.
    """
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception as e:
        logger.warning(f"Failed to delete {path}: {e}")

def clone_and_count_supported_files(github_url: str) -> dict:
    try:
        repo_name = github_url.rstrip('/').split('/')[-1]
        if repo_name.endswith('.git'):
            repo_name = repo_name[:-4]

        target_dir = os.path.join(TEMP_REPO_DIR, repo_name)

        if os.path.exists(target_dir):
            # Windows Workaround: Rename directory before deleting to release hooks 
            # from other processes like uvicorn or explorers.
            trash_dir = target_dir + "_trash_" + str(uuid.uuid4())[:8]
            try:
                os.rename(target_dir, trash_dir)
                shutil.rmtree(trash_dir, onerror=on_rm_error)
            except Exception:
                # Fallback to direct deletion with retries
                for i in range(5):
                    try:
                        shutil.rmtree(target_dir, onerror=on_rm_error)
                        break
                    except Exception as e:
                        if i == 4:
                            return {
                                "error": "Directory is locked by another process (Windows WinError 32).",
                                "details": f"Please close any programs (VS Code, Explorer) or browser tabs using this repository and try again. Error: {str(e)}"
                            }
                        time.sleep(1)
            
        os.makedirs(TEMP_REPO_DIR, exist_ok=True)

        # Clone (shallow)
        repo = Repo.clone_from(github_url, target_dir, depth=1)
        commit_sha = repo.head.commit.hexsha
        
        # Release Git hooks
        repo.close()

        # Count and track languages
        languages_found = {}
        supported_file_count = 0
        
        for root, dirs, files in os.walk(target_dir):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', 'vendor', '__pycache__', 'dist', 'build', '.git']]
            
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in SUPPORTED_EXTS:
                    full_path = os.path.join(root, file)
                    
                    try:
                        if os.path.getsize(full_path) > 500 * 1024:
                            continue
                    except OSError:
                        continue
                        
                    supported_file_count += 1
                    ext_key = ext.lstrip('.')
                    languages_found[ext_key] = languages_found.get(ext_key, 0) + 1

        return {
            "repo_name": repo_name,
            "local_path": target_dir,
            "commit_sha": commit_sha,
            "supported_file_count": supported_file_count,
            "languages_found": languages_found
        }

    except exc.GitCommandError as e:
        return {"error": "Failed to clone repository.", "details": str(e)}
    except Exception as e:
        return {"error": "An unexpected error occurred.", "details": str(e)}
