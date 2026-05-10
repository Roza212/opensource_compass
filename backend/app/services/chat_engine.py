import os
import logging
from sentence_transformers import CrossEncoder
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.services.vector_store import search_code
from app.core.prompts import SYSTEM_PROMPT, format_context

logger = logging.getLogger(__name__)

_cross_encoder = None

def get_cross_encoder():
    global _cross_encoder
    if _cross_encoder is None:
        print("⚡ Loading CrossEncoder AI into memory for the first time...")
        _cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
    return _cross_encoder

def generate_explanation(repo_name: str, user_question: str, history: list = None, language_filter: str = None) -> tuple[str, list]:
    """
    RAG Pipeline: Searches the backend for semantic vectors, 
    reranks them using a cross-encoder, injects them into Langchain, 
    and generates an AI answer.
    """
    history = history or []
    recent_history = history[-10:]
    history_str = ""
    for msg in recent_history:
        role = "Human" if msg.get("role") == "user" else "AI Mentor"
        history_str += f"{role}: {msg.get('text')}\n"
        
    # 1. Retrieve most relevant chunks with optional language filter
    search_results = search_code(user_question, match_count=15, repo_name=repo_name, language_filter=language_filter)
    
    top_scores = []
    if search_results:
        pairs = [[user_question, chunk.get("chunk_text", "")] for chunk in search_results]
        scores = get_cross_encoder().predict(pairs)
        scored_results = list(zip(search_results, scores))
        scored_results.sort(key=lambda x: x[1], reverse=True)
        top_5_results = [res[0] for res in scored_results[:5]]
        top_scores = [float(res[1]) for res in scored_results[:5]]
        
        if all(score < 0.3 for score in top_scores):
            logger.warning(f"⚠️ Low relevance for '{user_question}' in '{repo_name}'. Max: {max(top_scores):.4f}")
            
        search_results = top_5_results
    
    context_string = format_context(search_results)
    if not context_string.strip():
        context_string = f"[No code chunks found in the database for repository '{repo_name}' (filter: {language_filter or 'none'})]"
    
    model_name = os.environ.get("GEMINI_MODEL_NAME", "gemini-3-flash-preview")
    llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.3, max_retries=2)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "Conversation History:\n{history}\n\nRepository: {repo_name}\n\nCode Context:\n\n{context}\n\nUser Question: {question}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    final_explanation = chain.invoke({
        "history": history_str.strip() or "No previous history.",
        "repo_name": repo_name,
        "context": context_string, 
        "question": user_question
    })
    
    return final_explanation, top_scores
