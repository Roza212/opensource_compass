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
    # 1. Retrieve the top 5 most mathematically relevant python chunks from Supabase
    search_results = search_code(user_question, match_count=5)
    
    # 2. Format them flawlessly using the bridging logic we just built
    context_string = format_context(search_results)
    
    # 3. Pull our preferred Gemini AI model from the environment, defaulting to gemini-3-flash-preview
    model_name = os.environ.get("GEMINI_MODEL_NAME", "gemini-3-flash-preview")
    llm = ChatGoogleGenerativeAI(model=model_name, temperature=0.3, max_retries=2)
    
    # 4. Bind our customized Senior Developer personality into the prompt architecture
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "Here is the code context from the repository:\n\n{context}\n\nUser Question: {question}")
    ])
    
    # 5. Connect the pieces cleanly into a LangChain pipeline (LCEL)
    chain = prompt | llm | StrOutputParser()
    
    # 6. Fire the execution request strictly passing in both dynamic variables
    final_explanation = chain.invoke({
        "context": context_string, 
        "question": user_question
    })
    
    return final_explanation
