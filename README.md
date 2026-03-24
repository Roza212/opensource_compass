# OpenSource Compass 🧭

**OpenSource Compass** is an advanced, AI-powered backend engine designed to ingest, chunk, embed, and interactively explore entire open-source physical codebases. Built with modern async Python, it bridges the gap between raw abstract syntax trees (AST) and generative AI, allowing users to accurately chat with and search through vast amounts of structural code context.

## 🚀 Features
- **Git Ingestion**: Clones external repositories and counts Python scripts natively.
- **AST Parsing & Chunking**: Utilizes `tree-sitter` to analyze syntax and flawlessly extract functional chunks (classes, async functions, etc.).
- **Vector Database (pgvector)**: Integrates with Supabase to generate and store high-dimensional text embeddings locally via `SentenceTransformers` (`all-MiniLM-L6-v2`).
- **Semantic Code Search**: Employs Supabase RPC vector similarity search to instantly retrieve the most relevant codebase blocks matching natural language queries.
- **LCEL RAG Chat Engine**: Pipes retrieved technical context securely through LangChain into **Google's Gemini 3 Flash Preview** model to provide senior-developer level interactive explanations.
- **Mermaid Architecture Maps**: Instantly transforms complex AST python module imports into beautiful, interactive `graph TD` flowcharts via the `/diagram` endpoint!

## 🏗️ Architecture Stack
- **API Framework**: FastAPI & Uvicorn (Fully Async)
- **AI Models**: Google GenAI (`gemini-3-flash-preview`), Local MiniLM embeddings
- **Orchestration**: Langchain Expression Language (LCEL)
- **Storage**: Supabase Postgres (pgvector)
- **Syntax Analysis**: `tree-sitter`

## 📁 Project Structure
```text
opensource_compass_backend/
├── app/                  # Application Logic and RAG engine
│   ├── chat_engine.py    # LangChain context injection pipeline
│   ├── chunker.py        # AST based python code chunking
│   ├── git_service.py    # Repo cloning utility
│   ├── graph_builder.py  # Advanced logic graph creation
│   ├── parser.py         # Extractor for Python imports 
│   ├── prompts.py        # AI system prompt definitions
│   └── vector_store.py   # Connection to Supabase & local embeddings
├── tests/                # Verification routes
├── main.py               # Application entrypoint 
├── requirements.txt      
└── .env                  # Secrets 
```

## 🛠️ Setup & Installation

### 1. Requirements
Ensure you have Python 3.10+ installed.
```bash
git clone https://github.com/Roza212/opensource_compass.git
cd opensource_compass
pip install -r requirements.txt
```

### 2. Environment Variables
Create a `.env` file in the root directory mirroring these keys:
```env
SUPABASE_URL=your-supabase-project-url
SUPABASE_KEY=your-supabase-anon-key
GOOGLE_API_KEY=your-gemini-ai-studio-key
GEMINI_MODEL_NAME=gemini-3-flash-preview
```

### 3. Running the Backend
Boot the FastAPI application dynamically:
```bash
uvicorn main:app --reload
```
The swagger UI will be instantly available at `http://127.0.0.1:8000/docs`.

---
*Built with modern software design principles for comprehensive code exploration.*
