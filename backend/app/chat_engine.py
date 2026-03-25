import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.vector_store import search_code
from app.prompts import SYSTEM_PROMPT, format_context

def generate_explanation(repo_name: str, user_question: str) -> str:
    """
    RAG Pipeline: Searches the backend for semantic vectors related to the question, 
    injects them cleanly into Langchain, and generates an AI answer.
    """
    # 1. Retrieve the top 5 most relevant python chunks from Supabase (filtered by repo)
    search_results = search_code(user_question, match_count=5, repo_name=repo_name)
    
    # 2. Format them for the LLM context
    context_string = format_context(search_results)
    
    # 3. If no context was found, add a helpful note
    if not context_string.strip():
        context_string = f"[No code chunks found in the database for repository '{repo_name}'. The embeddings may not have been generated yet. Please answer based on general knowledge about the repository name.]"
    
    # 4. Pull our preferred Gemini AI model from the environment
    model_name = os.environ.get("GEMINI_MODEL_NAME", "gemini-3-flash-preview")
    llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.3, max_retries=2)
    
    # 5. Bind our customized Senior Developer personality into the prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "Repository being analyzed: {repo_name}\n\nHere is the code context from the repository:\n\n{context}\n\nUser Question: {question}")
    ])
    
    # 6. Connect the pieces into a LangChain pipeline (LCEL)
    chain = prompt | llm | StrOutputParser()
    
    # 7. Execute with all dynamic variables
    final_explanation = chain.invoke({
        "repo_name": repo_name,
        "context": context_string, 
        "question": user_question
    })
    
    return final_explanation
