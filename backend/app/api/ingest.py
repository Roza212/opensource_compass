import os
from fastapi import APIRouter, HTTPException, Request
from app.models.schemas import RepoRequest
from app.services.vector_store import supabase
from app.core.limiter import limiter

router = APIRouter()


def _dispatch_task(job_id: str, github_url: str):
    from app.worker import run_ingestion
    run_ingestion.delay(job_id, github_url)


@router.post("/ingest")
@limiter.limit("20/hour")
def ingest_repo(request: Request, body: RepoRequest):
    """
    Validates the GitHub URL, creates a job record in Supabase,
    dispatches the heavy work to a Celery background task, and
    returns the job_id immediately so the frontend can poll for status.
    Rate limit: 20 requests per hour per IP.
    """
    github_url = body.github_url.strip()
    if not github_url.startswith("https://github.com/"):
        raise HTTPException(status_code=422, detail="URL must start with https://github.com/")

    repo_name = github_url.rstrip("/").split("/")[-1].replace(".git", "")

    try:
        response = supabase.table("jobs").insert({
            "status": "queued",
            "repo_name": repo_name,
        }).execute()

        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to create analysis record.")

        job_id = response.data[0]["id"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    try:
        _dispatch_task(job_id, github_url)
    except Exception as e:
        supabase.table("jobs").update({"status": "failed", "error": str(e)}).eq("id", job_id).execute()
        raise HTTPException(status_code=503, detail=f"Analysis pipeline unavailable: {str(e)}")

    return {"job_id": job_id, "status": "queued", "repo_name": repo_name}


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    """
    Polls the Supabase jobs table for the current status of an analysis job.
    Returns: queued | running | completed | failed
    """
    try:
        response = supabase.table("jobs").select("*").eq("id", job_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Analysis job not found.")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
