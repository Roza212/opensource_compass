import re
from fastapi import APIRouter, HTTPException, Request
from app.models.schemas import SearchRequest, ChatRequest
from app.utils.errors import sanitize_error
from app.services.vector_store import search_code, supabase
from app.services.chat_engine import generate_explanation
from app.core.limiter import limiter

router = APIRouter()

@router.post("/search")
@limiter.limit("500/hour")
def search_repository(request: Request, body: SearchRequest):
    try:
        results = search_code(body.query)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=sanitize_error(e))

@router.get("/sessions/{repo_name}")
def get_sessions(repo_name: str):
    try:
        response = supabase.table("chat_sessions").select("id, created_at, updated_at").eq("repo_name", repo_name).order("updated_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/messages/{session_id}")
def get_session_messages(session_id: str):
    try:
        response = supabase.table("chat_sessions").select("messages").eq("id", session_id).execute()
        if response.data:
            return response.data[0].get("messages", [])
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat")
@limiter.limit("500/hour")
def chat_with_repo(request: Request, body: ChatRequest):
    try:
        history = []
        if body.session_id:
            try:
                response = supabase.table("chat_sessions").select("messages").eq("id", body.session_id).execute()
                if response.data:
                    history = response.data[0].get("messages", [])
            except Exception as e:
                print(f"⚠️ Error fetching history: {e}")

        answer_string, rerank_scores = generate_explanation(body.repo_name, body.question, history)
        
        sources = []
        parts = re.split(r'\n#*\s*Sources:?\s*\n', answer_string, flags=re.IGNORECASE)
        if len(parts) > 1:
            answer_string = parts[0].strip()
            sources_text = parts[1]
            sources_list = re.findall(r'-\s*(.+)', sources_text)
            sources = [s.strip('`* ') for s in sources_list]
            
        new_human_msg = {"role": "user", "text": body.question}
        new_ai_msg = {"role": "ai", "text": answer_string, "sources": sources}
        history.extend([new_human_msg, new_ai_msg])
        
        session_id = body.session_id
        try:
            if session_id:
                supabase.table("chat_sessions").update({"messages": history}).eq("id", session_id).execute()
            else:
                response = supabase.table("chat_sessions").insert({"repo_name": body.repo_name, "messages": history}).execute()
                if response.data:
                    session_id = response.data[0].get("id")
        except Exception as e:
            print(f"⚠️ Error saving session: {e}")
            
        return {"answer": answer_string, "rerank_scores": rerank_scores, "sources": sources, "session_id": session_id}
    except Exception as e:
        err_msg = str(e)
        if "AuthenticationError" in err_msg or "api_key" in err_msg.lower() or "401" in err_msg:
            raise HTTPException(status_code=401, detail="Your OPENAI_API_KEY is missing/invalid in the .env file!")
        elif "insufficient_quota" in err_msg.lower() or "429" in err_msg or "resource_exhausted" in err_msg.lower():
            raise HTTPException(status_code=429, detail="Your Gemini API key has hit its quota limit (15 requests per minute on free tier). Please wait a minute or check your billing details.")
        else:
            raise HTTPException(status_code=500, detail=f"Langchain / Database Error: {err_msg}")

import os
import json
import networkx as nx
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from app.utils.graph_builder import build_repo_graph
from app.models.schemas import TourRequest

@router.post("/tour")
def generate_tour(request: TourRequest):
    try:
        repo_path = os.path.join(".temp_repos", request.repo_name)
        if not os.path.exists(repo_path):
            raise HTTPException(status_code=404, detail="Repository not found.")
            
        G = build_repo_graph(repo_path)
        centrality = nx.degree_centrality(G)
        
        top_files = sorted(centrality.items(), key=lambda x: x[1], reverse=True)[:10]
        
        context_snippets = []
        for file_path, score in top_files:
            full_path = os.path.join(repo_path, file_path)
            try:
                with open(full_path, 'r', encoding='utf-8') as f:
                    head = "".join(f.readlines()[:50])
                    context_snippets.append(f"--- File: {file_path} ---\n{head}")
            except Exception:
                pass
                
        context_text = "\n\n".join(context_snippets)
        
        system_prompt = """You are an expert software architect. Given this codebase context, generate a 5-step guided tour for a new developer. 
Each step should cover one key file or concept. Format exactly as a JSON array of objects:
[
  {{"step": 1, "title": "...", "explanation": "...", "key_file": "..."}}
]
Return ONLY raw JSON. No markdown blocks."""
        
        model_name = os.environ.get("GEMINI_MODEL_NAME", "gemini-3-flash-preview")
        llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.2)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", "Codebase Context:\n{context}")
        ])
        
        from langchain_core.output_parsers import StrOutputParser
        chain = prompt | llm | StrOutputParser()
        raw_output = chain.invoke({"context": context_text}).strip()
        
        if raw_output.startswith("```json"):
            raw_output = raw_output[7:-3].strip()
        elif raw_output.startswith("```"):
            raw_output = raw_output[3:-3].strip()
            
        return json.loads(raw_output)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
