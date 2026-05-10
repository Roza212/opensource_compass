import os

# Define the temporary repository storage path
# We place it outside the backend/ directory to prevent uvicorn reloads during ingestion
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMP_REPO_DIR = os.path.join(BASE_DIR, "..", ".temp_repos")

# Ensure the directory exists
os.makedirs(TEMP_REPO_DIR, exist_ok=True)
