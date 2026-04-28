from pydantic import BaseModel

class RepoRequest(BaseModel):
    github_url: str

class SearchRequest(BaseModel):
    query: str

class ChatRequest(BaseModel):
    repo_name: str
    question: str
