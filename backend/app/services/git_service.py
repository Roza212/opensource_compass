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

def clone_and_count_python_files(github_url: str) -> dict:
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
            shutil.rmtree(target_dir, onerror=on_rm_error)
            
        # Ensure the parent directory .temp_repos/ exists
        os.makedirs(".temp_repos", exist_ok=True)

        # Clone the repository (use shallow clone for massive speedup)
        Repo.clone_from(github_url, target_dir, depth=1)

        # Traverse the directory and count exactly how many .py files exist
        python_file_count = 0
        for root, dirs, files in os.walk(target_dir):
            for file in files:
                if file.endswith('.py'):
                    python_file_count += 1

        # Return the resulting dictionary
        return {
            "repo_name": repo_name,
            "local_path": target_dir,
            "python_file_count": python_file_count
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
