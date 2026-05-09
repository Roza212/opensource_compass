import os
import stat
import shutil
from git import Repo, exc

def on_rm_error(func, path, exc_info):
    """
    Error handler for shutil.rmtree to force Windows read-only .git files to correctly delete.
    """
    os.chmod(path, stat.S_IWRITE)
    func(path)

def clone_and_count_supported_files(github_url: str) -> dict:
    try:
        # Extract the repository name from the URL
        # Handles URLs ending with or without .git and trailing slashes
        repo_name = github_url.rstrip('/').split('/')[-1]
        if repo_name.endswith('.git'):
            repo_name = repo_name[:-4]

        # Define the target directory path
        target_dir = os.path.join(".temp_repos", repo_name)

        # If the target directory already exists, aggressively delete it to start fresh
        if os.path.exists(target_dir):
            import time
            for i in range(5): # Try 5 times
                try:
                    shutil.rmtree(target_dir, onerror=on_rm_error)
                    break
                except Exception as e:
                    if i == 4: # Last try failed
                        return {
                            "error": "Directory is locked by another process.",
                            "details": f"Windows cannot delete {target_dir} because it's in use. Please close any programs (VS Code, Explorer) using this folder and try again. Error: {str(e)}"
                        }
                    time.sleep(1) # Wait a second before retrying
            
        # Ensure the parent directory .temp_repos/ exists
        os.makedirs(".temp_repos", exist_ok=True)

        # Clone the repository (use shallow clone for massive speedup)
        repo = Repo.clone_from(github_url, target_dir, depth=1)
        commit_sha = repo.head.commit.hexsha

        # Supported extensions
        SUPPORTED_EXTS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.go', '.java', '.rs', '.c', '.h', '.cpp', '.hpp', '.rb', '.md'}

        # Traverse the directory and count exactly how many supported files exist
        supported_file_count = 0
        for root, dirs, files in os.walk(target_dir):
            for file in files:
                _, ext = os.path.splitext(file)
                if ext.lower() in SUPPORTED_EXTS:
                    supported_file_count += 1

        # Return the resulting dictionary
        return {
            "repo_name": repo_name,
            "local_path": target_dir,
            "commit_sha": commit_sha,
            "supported_file_count": supported_file_count
        }

    except exc.GitCommandError as e:
        # Specific handling for Git clone failures
        return {
            "error": "Failed to clone repository.",
            "details": str(e)
        }
    except Exception as e:
        # General error handling
        return {
            "error": "An unexpected error occurred.",
            "details": str(e)
        }
