from pydantic import BaseModel
from typing import Optional

class RepoRequest(BaseModel):
    github_url: str

class SearchRequest(BaseModel):
    query: str
    repo_name: Optional[str] = None
    language: Optional[str] = None

class ChatRequest(BaseModel):
    repo_name: str
    question: str
    session_id: Optional[str] = None
    language: Optional[str] = None

class TourRequest(BaseModel):
    repo_name: str
