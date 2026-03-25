# OpenSource Compass 🧭

**OpenSource Compass** is a full-stack, AI-powered mentorship tool designed to help junior developers explore, understand, and learn from any open-source Python codebase. Paste a GitHub repo URL, and instantly get an interactive architecture diagram and an AI mentor that can explain the code in simple terms.

## ✨ Features

### 🎨 Frontend (React + Tailwind CSS)
- **Landing View**: Sleek dark-mode input with glowing neon accents — paste a GitHub URL and click Analyze
- **Split-Screen Dashboard**:
  - **AI Mentor Chat** (left panel): Chat with Gemini 3 about the repo's architecture, patterns, and modules
  - **System Architecture Canvas** (right panel): Auto-rendered Mermaid.js dependency flowchart

### ⚙️ Backend (FastAPI + Python)
- **Git Ingestion**: Clones repositories and scans for Python files
- **AST Parsing & Chunking**: Uses `tree-sitter` to extract classes, functions, and imports
- **Vector Embeddings**: Generates embeddings via `SentenceTransformers` and stores them in Supabase pgvector
- **Semantic Code Search**: Natural language queries matched against embedded code chunks
- **LCEL RAG Chat**: LangChain pipeline with **Gemini 3 Flash Preview** for senior-developer-level explanations
- **Mermaid Architecture Maps**: Auto-generates interactive `graph LR` flowcharts from Python import graphs

## 🏗️ Architecture Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React, Vite, Tailwind CSS, Mermaid.js, Lucide Icons |
| **Backend API** | FastAPI, Uvicorn (async), CORS enabled |
| **AI Models** | Google Gemini 3 Flash Preview, SentenceTransformers (MiniLM) |
| **Orchestration** | LangChain Expression Language (LCEL) |
| **Database** | Supabase Postgres (pgvector) |
| **Syntax Analysis** | tree-sitter |

## 📁 Project Structure
```text
opensource_compass/
├── backend/
│   ├── main.py                  # FastAPI entry point (CORS enabled)
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # API keys (gitignored)
│   ├── app/
│   │   ├── git_service.py       # Repo cloning & scanning
│   │   ├── parser.py            # AST import extraction
│   │   ├── graph_builder.py     # NetworkX dependency graph
│   │   ├── chunker.py           # AST code chunking
│   │   ├── vector_store.py      # Supabase pgvector (2-strategy search)
│   │   ├── prompts.py           # LangChain prompt templates
│   │   ├── chat_engine.py       # Gemini RAG pipeline
│   │   └── diagram_generator.py # Mermaid.js chart generator
│   └── tests/
│       ├── test_chat.py
│       └── test_embed.py
│
└── frontend/
    ├── index.html
    ├── package.json
    └── src/
        ├── App.jsx              # Landing ↔ Dashboard state controller
        ├── index.css            # Dark-mode design system
        └── components/
            ├── LandingView.jsx  # Glowing input + chained ingest/embed
            └── DashboardView.jsx # Chat + Mermaid canvas
```

## 🛠️ Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Clone the Repository
```bash
git clone https://github.com/Roza212/opensource_compass.git
cd opensource_compass
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
SUPABASE_URL=your-supabase-project-url
SUPABASE_KEY=your-supabase-anon-key
GOOGLE_API_KEY=your-gemini-ai-studio-key
GEMINI_MODEL_NAME=gemini-3-flash-preview
```

Start the API server:
```bash
uvicorn main:app --reload --reload-exclude "temp_repos"
```
Swagger UI available at `http://127.0.0.1:8000/docs`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
App available at `http://localhost:5173`

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/ingest` | Clone a GitHub repo |
| `GET` | `/graph/{repo}` | Get dependency graph JSON |
| `GET` | `/diagram/{repo}?raw=true` | Get Mermaid flowchart |
| `POST` | `/embed/{repo}` | Generate vector embeddings |
| `POST` | `/search` | Semantic code search |
| `POST` | `/chat` | AI mentor chat (RAG) |

## 📄 License
MIT

---
*Built for junior developers who want to understand open-source code, not just read it.*
