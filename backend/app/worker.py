import os
import time
import logging
from celery import Celery
from dotenv import load_dotenv
from app.utils.chunker import chunk_code, LANGUAGE_MAP, FALLBACK_EXTENSIONS

load_dotenv()
logger = logging.getLogger(__name__)

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
    from app.services.vector_store import supabase, get_repo_commit_sha, delete_repo_chunks, upsert_repo_sha, store_chunks_in_supabase, safe_execute
    from app.services.git_service import clone_and_count_supported_files
    from git import cmd

    def update_job(status: str, repo_name: str = None, error: str = None, languages: dict = None):
        payload = {"status": status}
        if repo_name:
            payload["repo_name"] = repo_name
        if error:
            payload["error"] = error
        
        try:
            query = supabase.table("jobs").update(payload).eq("id", job_id)
            safe_execute(query)
        except Exception as e:
            logger.error(f"Failed to update job status in DB: {e}")

    try:
        update_job("running")
        repo_name = github_url.rstrip("/").split("/")[-1].replace(".git", "")
        
        # Check Cache
        try:
            g = cmd.Git()
            remote_info = g.ls_remote(github_url, "HEAD")
            current_github_sha = remote_info.split()[0]
        except Exception:
            current_github_sha = None

        if current_github_sha:
            existing_sha = get_repo_commit_sha(repo_name)
            if existing_sha == current_github_sha:
                update_job("completed", repo_name=repo_name)
                return

        # Perform Clone
        result = clone_and_count_supported_files(github_url)
        if "error" in result:
            update_job("failed", error=f"{result['error']}: {result.get('details', '')}")
            return

        repo_name = result["repo_name"]
        commit_sha = result["commit_sha"]
        languages_found = result.get("languages_found", {})
        update_job("running", repo_name=repo_name)

        # Clear old data
        delete_repo_chunks(repo_name)

        # Multi-language Ingestion
        repo_path = result["local_path"]
        SUPPORTED_EXTS = set(LANGUAGE_MAP.keys()) | set(FALLBACK_EXTENSIONS.keys())

        for root, dirs, files in os.walk(repo_path):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', 'vendor', '__pycache__', 'dist', 'build']]
            
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in SUPPORTED_EXTS:
                    full_path = os.path.join(root, file)
                    
                    try:
                        if os.path.getsize(full_path) > 500 * 1024:
                            continue
                    except OSError:
                        continue
                        
                    try:
                        with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                            source_code = f.read()
                            rel_path = os.path.relpath(full_path, repo_path).replace('\\', '/')
                            chunks = chunk_code(rel_path, source_code)
                            if chunks:
                                store_chunks_in_supabase(repo_name, chunks)
                    except Exception as e:
                        logger.warning(f"Error processing {full_path}: {e}")

        # Finalize
        upsert_repo_sha(repo_name, commit_sha)
        update_job("completed", repo_name=repo_name)

    except Exception as e:
        update_job("failed", error=str(e))
        raise
