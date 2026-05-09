import os
import time
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "compass_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
)


@celery_app.task(bind=True, name="app.worker.run_ingestion")
def run_ingestion(self, job_id: str, github_url: str):
    """
    Background Celery task that performs the full clone + chunk + embed pipeline.
    Optimized to check SHA before cloning to avoid Windows file locks.
    """
    from app.services.vector_store import supabase, get_repo_commit_sha, delete_repo_chunks, upsert_repo_sha, store_chunks_in_supabase
    from app.services.git_service import clone_and_count_supported_files
    from app.utils.chunker import chunk_file
    from git import cmd

    def update_job(status: str, repo_name: str = None, error: str = None):
        payload = {"status": status}
        if repo_name:
            payload["repo_name"] = repo_name
        if error:
            payload["error"] = error
        supabase.table("jobs").update(payload).eq("id", job_id).execute()

    try:
        update_job("running")
        
        # 1. Extract repo name from URL
        repo_name = github_url.rstrip("/").split("/")[-1].replace(".git", "")
        
        # 2. Check current SHA on GitHub (without cloning)
        try:
            g = cmd.Git()
            # ls-remote returns "sha\trefs/heads/main"
            remote_info = g.ls_remote(github_url, "HEAD")
            current_github_sha = remote_info.split()[0]
        except Exception as e:
            # Fallback if ls-remote fails: proceed to clone anyway
            current_github_sha = None

        # 3. Check Cache
        if current_github_sha:
            existing_sha = get_repo_commit_sha(repo_name)
            if existing_sha == current_github_sha:
                # Already indexed and up to date
                update_job("completed", repo_name=repo_name)
                return

        # 4. Perform Clone (if not cached or cache check failed)
        result = clone_and_count_supported_files(github_url)

        if "error" in result:
            update_job("failed", error=f"{result['error']}: {result.get('details', '')}")
            return

        repo_name = result["repo_name"]
        commit_sha = result["commit_sha"]
        update_job("running", repo_name=repo_name)

        # 5. Clear old data if SHA changed
        existing_sha = get_repo_commit_sha(repo_name)
        if existing_sha and existing_sha != commit_sha:
            delete_repo_chunks(repo_name)

        # 6. Chunk + Embed
        repo_path = os.path.join(".temp_repos", repo_name)
        SUPPORTED_EXTS = {'.py', '.js', '.jsx', '.ts', '.tsx', '.go', '.java', '.rs', '.c', '.h', '.cpp', '.hpp', '.rb', '.md'}

        for root, _, files in os.walk(repo_path):
            for file in files:
                _, ext = os.path.splitext(file)
                if ext.lower() in SUPPORTED_EXTS:
                    full_path = os.path.join(root, file)
                    chunks = chunk_file(full_path)
                    if chunks:
                        store_chunks_in_supabase(repo_name, chunks)

        # 7. Finalize
        upsert_repo_sha(repo_name, commit_sha)
        update_job("completed", repo_name=repo_name)

    except Exception as e:
        update_job("failed", error=str(e))
        raise
