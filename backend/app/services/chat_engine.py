import os
import logging
from sentence_transformers import CrossEncoder
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.services.vector_store import search_code
from app.core.prompts import SYSTEM_PROMPT, format_context

logger = logging.getLogger(__name__)

# Lazy-loaded cross-encoder model
_cross_encoder = None

def get_cross_encoder():
    global _cross_encoder
    if _cross_encoder is None:
        print("⚡ Loading CrossEncoder AI into memory for the first time...")
        _cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
    return _cross_encoder

def generate_explanation(repo_name: str, user_question: str, history: list = None) -> tuple[str, list]:
    """
    RAG Pipeline: Searches the backend for semantic vectors, 
    reranks them using a cross-encoder, injects them into Langchain, 
    and generates an AI answer. Returns (answer, rerank_scores).
    """
    history = history or []
    recent_history = history[-10:]
    history_str = ""
    for msg in recent_history:
        role = "Human" if msg.get("role") == "user" else "AI Mentor"
        history_str += f"{role}: {msg.get('text')}\n"
        
    # 1. Retrieve the top 15 most relevant chunks from Supabase (broad net)
    search_results = search_code(user_question, match_count=15, repo_name=repo_name)
    
    top_scores = []
    
    if search_results:
        # 2. Prepare pairs for cross-encoder scoring
        pairs = [[user_question, chunk.get("chunk_text", "")] for chunk in search_results]
        
        # 3. Predict relevance scores
        scores = get_cross_encoder().predict(pairs)
        
        # 4. Attach scores to results and sort descending
        scored_results = list(zip(search_results, scores))
        scored_results.sort(key=lambda x: x[1], reverse=True)
        
        # 5. Extract top 5 and their scores
        top_5_results = [res[0] for res in scored_results[:5]]
        # Convert float32 scores to standard python floats for JSON serialization
        top_scores = [float(res[1]) for res in scored_results[:5]]
        
        # 6. Check for low relevance
        if all(score < 0.3 for score in top_scores):
            logger.warning(f"⚠️ Low relevance scores for question '{user_question}' in repo '{repo_name}'. Max score: {max(top_scores):.4f}. The question might be out of scope.")
            
        search_results = top_5_results
    
    # 7. Format them for the LLM context
    context_string = format_context(search_results)
    
    # 8. If no context was found, add a helpful note
    if not context_string.strip():
        context_string = f"[No code chunks found in the database for repository '{repo_name}'. The embeddings may not have been generated yet. Please answer based on general knowledge about the repository name.]"
    
    # 9. Pull our preferred Gemini AI model from the environment
    model_name = os.environ.get("GEMINI_MODEL_NAME", "gemini-3-flash-preview")
    llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.3, max_retries=2)
    
    # 10. Bind our customized Senior Developer personality into the prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "Conversation History:\n{history}\n\nRepository being analyzed: {repo_name}\n\nHere is the code context from the repository:\n\n{context}\n\nUser Question: {question}")
    ])
    
    # 11. Connect the pieces into a LangChain pipeline (LCEL)
    chain = prompt | llm | StrOutputParser()
    
    # 12. Execute with all dynamic variables
    final_explanation = chain.invoke({
        "history": history_str.strip() or "No previous history.",
        "repo_name": repo_name,
        "context": context_string, 
        "question": user_question
    })
    
    return final_explanation, top_scores
